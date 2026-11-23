-- =============================================================================
-- 0500
--   1. Hardened auth.users -> public.profiles trigger (never blocks sign-up).
--   2. catalog_summary: precomputed category counts, unfiltered facets and hero
--      stats, refreshed after imports and admin product edits.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profile trigger
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER (runs as the owner, postgres, not supabase_auth_admin), empty
-- search_path, schema-qualified names, and only columns that exist on
-- public.profiles (role, created_at and updated_at use their defaults). Any error
-- is downgraded to a warning, so a profile problem can never turn
-- "create user" into HTTP 500. The app treats a missing profile as "not staff".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user: profile insert failed for %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end
$$;

alter function public.handle_new_user() owner to postgres;
-- Trigger functions don't need EXECUTE at fire time; keep it off the public API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any auth user created while the trigger was failing gets a profile now.
insert into public.profiles (id, email, full_name)
select u.id, u.email, nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
  from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Catalog summary (single row)
-- -----------------------------------------------------------------------------
-- A table rather than a materialized view: it keeps RLS (Supabase flags matviews
-- exposed over the API), and refreshing it is a single-row upsert, so readers
-- never see an empty state.
create table if not exists public.catalog_summary (
  id               smallint primary key default 1 check (id = 1),
  category_counts  jsonb not null default '[]'::jsonb,   -- [{slug,name,description,icon,count}] top-level, active parts
  facets           jsonb not null default '{}'::jsonb,   -- search_facets() with no filters
  stats            jsonb not null default '{}'::jsonb,   -- catalog_stats()
  refreshed_at     timestamptz not null default now()
);

alter table public.catalog_summary enable row level security;
drop policy if exists "catalog_summary: public read" on public.catalog_summary;
create policy "catalog_summary: public read" on public.catalog_summary
  for select to anon, authenticated using (true);
grant select on public.catalog_summary to anon, authenticated;

-- Callable by the service role (imports), signed-in staff (admin edits) and SQL
-- Editor sessions; anonymous and non-staff API users are rejected.
create or replace function public.refresh_catalog_summary()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := auth.role();
  v_now  timestamptz := now();
begin
  if v_role in ('anon', 'authenticated') and not public.is_staff() then
    raise exception 'refresh_catalog_summary: staff only' using errcode = '42501';
  end if;

  insert into public.catalog_summary (id, category_counts, facets, stats, refreshed_at)
  values (
    1,
    coalesce((
      select jsonb_agg(
               jsonb_build_object('slug', r.slug, 'name', r.name, 'description', r.description, 'icon', r.icon, 'count', x.cnt)
               order by r.sort_order, r.name)
        from (
          select coalesce(c.parent_id, c.id) as root_id, count(*) as cnt
            from public.products p
            join public.categories c on c.id = p.category_id
           where p.status = 'active'
           group by 1
        ) x
        join public.categories r on r.id = x.root_id and r.parent_id is null
    ), '[]'::jsonb),
    public.search_facets(),
    public.catalog_stats(),
    v_now
  )
  on conflict (id) do update
    set category_counts = excluded.category_counts,
        facets          = excluded.facets,
        stats           = excluded.stats,
        refreshed_at    = excluded.refreshed_at;

  return v_now;
end
$$;

revoke execute on function public.refresh_catalog_summary() from public, anon;
grant execute on function public.refresh_catalog_summary() to authenticated, service_role;

select public.refresh_catalog_summary();
