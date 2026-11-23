-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Needs migrations 0100-0500 (already applied on this project). Safe to re-run.
--
-- AFTER it succeeds: create your own account at /account/signup (or Authentication -> Users ->
-- Add user), then make it an admin with the statement at the very bottom of this file.

-- ============ supabase/migrations/20261120000600_admin.sql ============
-- =============================================================================
-- 0600 Admin dashboard
--   1. Roles: is_admin(), disabled accounts, admin-only role changes
--   2. audit_log + generic change trigger + log_admin_event()
--   3. Orders: request/stripe-ready statuses, timeline, create_order_request()
--   4. Products: SEO fields, soft delete, image_count, bulk price RPC
--   5. Leads: assignee + internal notes, part request -> order link
--   6. site_settings (content + flags), image_jobs
--   7. admin_dashboard() stats in one round trip
-- Safe to re-run: every statement is guarded (if not exists / or replace / drop if exists).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists garage jsonb;

-- Disabled accounts lose staff rights immediately.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('staff', 'admin') and p.disabled_at is null
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.disabled_at is null
  )
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Only admins may change roles or disable accounts (API users; service role / SQL Editor are trusted).
create or replace function public.profiles_guard_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
    if new.disabled_at is distinct from old.disabled_at then
      raise exception 'Only admins can disable accounts' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.profiles_guard_role();

-- Staff can read every profile; only admins can write other people's profiles.
drop policy if exists "profiles: staff all" on public.profiles;
drop policy if exists "profiles: staff read" on public.profiles;
drop policy if exists "profiles: admin write" on public.profiles;
create policy "profiles: staff read" on public.profiles for select to authenticated using ((select public.is_staff()));
create policy "profiles: admin write" on public.profiles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 2. Audit log
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_email  text,
  action       text not null,                 -- insert | update | delete | <entity>.<verb>
  entity_type  text not null,                 -- table name or logical type
  entity_id    text,
  summary      text,
  before       jsonb,
  after        jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "audit_log: admin read" on public.audit_log;
create policy "audit_log: admin read" on public.audit_log for select to authenticated using ((select public.is_admin()));
-- No insert/update/delete policies: rows come only from the security-definer functions below.

-- Generic row trigger: stores only the columns that changed. Changes without a signed-in
-- actor (service role imports, SQL Editor, anonymous form posts) are skipped; imports are
-- already recorded in import_jobs / import_rows.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := auth.uid();
  v_email  text;
  v_ignore text[] := array['updated_at', 'search_vector', 'part_numbers_search'];
  v_old    jsonb;
  v_new    jsonb;
  v_before jsonb;
  v_after  jsonb;
  v_id     text;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_after := to_jsonb(new) - v_ignore;
    v_id := coalesce(v_after ->> 'id', v_after ->> 'key');
  elsif tg_op = 'DELETE' then
    v_before := to_jsonb(old) - v_ignore;
    v_id := coalesce(v_before ->> 'id', v_before ->> 'key');
  else
    v_old := to_jsonb(old) - v_ignore;
    v_new := to_jsonb(new) - v_ignore;
    select jsonb_object_agg(e.key, e.value) into v_before from jsonb_each(v_old) e where v_new -> e.key is distinct from e.value;
    select jsonb_object_agg(e.key, e.value) into v_after  from jsonb_each(v_new) e where v_old -> e.key is distinct from e.value;
    if v_after is null then
      return new; -- nothing meaningful changed (e.g. search re-index touch)
    end if;
    v_id := coalesce(v_new ->> 'id', v_new ->> 'key');
  end if;

  select p.email into v_email from public.profiles p where p.id = v_actor;
  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before, after)
  values (v_actor, v_email, lower(tg_op), tg_table_name, v_id, v_before, v_after);
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

-- Explicit events from the app (bulk actions, image uploads, logins to sensitive areas).
create or replace function public.log_admin_event(
  p_action text, p_entity_type text, p_entity_id text default null, p_summary text default null,
  p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'log_admin_event: staff only' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary, before, after)
  select auth.uid(), p.email, left(p_action, 80), left(p_entity_type, 80), left(p_entity_id, 200), left(p_summary, 500), p_before, p_after
    from public.profiles p where p.id = auth.uid();
end $$;
revoke execute on function public.log_admin_event(text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.log_admin_event(text, text, text, text, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Orders
-- -----------------------------------------------------------------------------
-- Status becomes text + check (enum values can't be added and used in one transaction).
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'orders' and column_name = 'status') = 'USER-DEFINED' then
    alter table public.orders alter column status drop default;
    alter table public.orders alter column status type text using (
      case status::text when 'pending' then 'new' when 'processing' then 'confirmed' when 'delivered' then 'completed' else status::text end
    );
  end if;
end $$;
alter table public.orders alter column status set default 'new';
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'));
drop type if exists public.order_status;

alter table public.orders add column if not exists source        text not null default 'manual';
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists phone         text;
alter table public.orders add column if not exists carrier       text;
alter table public.orders add column if not exists shipped_at    timestamptz;
alter table public.orders add column if not exists staff_notes   text;
alter table public.orders add column if not exists deleted_at    timestamptz;
alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source in ('request', 'stripe', 'manual', 'lead'));
create index if not exists orders_live_idx on public.orders (status, created_at desc) where deleted_at is null;
create index if not exists orders_email_idx on public.orders (lower(email));

create table if not exists public.order_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  kind         text not null check (kind in ('created', 'status', 'note', 'tracking', 'email', 'payment')),
  status       text,
  message      text,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_email  text,
  created_at   timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);
alter table public.order_events enable row level security;
drop policy if exists "order_events: staff" on public.order_events;
drop policy if exists "order_events: owner read" on public.order_events;
create policy "order_events: staff" on public.order_events for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "order_events: owner read" on public.order_events for select to authenticated
  using (kind in ('created', 'status', 'tracking')
         and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));

-- Deleting orders is admin-only (staff soft-delete via deleted_at instead).
drop policy if exists "orders: staff write" on public.orders;
drop policy if exists "orders: staff insert" on public.orders;
drop policy if exists "orders: staff update" on public.orders;
drop policy if exists "orders: admin delete" on public.orders;
create policy "orders: staff insert" on public.orders for insert to authenticated with check ((select public.is_staff()));
create policy "orders: staff update" on public.orders for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "orders: admin delete" on public.orders for delete to authenticated using ((select public.is_admin()));

-- Website order request ("Send order request" in the cart). Prices, titles and stock are
-- re-read from products, so the caller can't change what anything costs. The customer is
-- whoever is signed in (auth.uid()), never a parameter.
create or replace function public.create_order_request(
  p_email text, p_name text, p_phone text, p_postal_code text, p_notes text, p_items jsonb)
returns table (o_id uuid, o_number text, o_subtotal numeric, o_items integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_order  uuid;
  v_number text;
  v_sub    numeric(10, 2) := 0;
  v_count  integer := 0;
  r        record;
begin
  if p_email is null or length(p_email) > 254 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'create_order_request: invalid email' using errcode = '22023';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 120 then
    raise exception 'create_order_request: invalid name' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'create_order_request: invalid items' using errcode = '22023';
  end if;

  insert into public.orders (customer_id, email, customer_name, phone, status, source, notes, shipping_address, placed_at)
  values (
    auth.uid(),
    lower(btrim(p_email)),
    btrim(p_name),
    nullif(left(btrim(coalesce(p_phone, '')), 40), ''),
    'new',
    'request',
    nullif(left(btrim(coalesce(p_notes, '')), 2000), ''),
    case when nullif(btrim(coalesce(p_postal_code, '')), '') is null then null
         else jsonb_build_object('postal_code', left(btrim(p_postal_code), 10)) end,
    now()
  )
  returning id, order_number into v_order, v_number;

  for r in
    select p.id, p.sku, p.title, p.price,
           least(greatest(coalesce((i.value ->> 'quantity')::integer, 1), 1), p.quantity, 10) as qty
      from (select distinct on (value ->> 'product_id') value from jsonb_array_elements(p_items)) i
      join public.products p on p.id = (i.value ->> 'product_id')::uuid
     where p.status = 'active' and p.quantity > 0 and p.deleted_at is null
  loop
    insert into public.order_items (order_id, product_id, sku, title, unit_price, quantity)
    values (v_order, r.id, r.sku, r.title, r.price, r.qty);
    v_sub := v_sub + r.price * r.qty;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'create_order_request: no available items' using errcode = 'P0001';
  end if;

  update public.orders set subtotal = v_sub, total = v_sub where id = v_order;
  insert into public.order_events (order_id, kind, status, message)
  values (v_order, 'created', 'new', 'Order request submitted from the website');

  return query select v_order, v_number, v_sub, v_count;
end $$;
revoke execute on function public.create_order_request(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order_request(text, text, text, text, text, jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Products
-- -----------------------------------------------------------------------------
alter table public.products add column if not exists seo_title       text;
alter table public.products add column if not exists seo_description text;
alter table public.products add column if not exists deleted_at      timestamptz;
alter table public.products add column if not exists image_count     smallint not null default 0;
create index if not exists products_admin_updated_idx on public.products (updated_at desc) where deleted_at is null;
create index if not exists products_admin_status_idx on public.products (status, updated_at desc) where deleted_at is null;
create index if not exists products_no_image_idx on public.products (updated_at desc) where image_count = 0 and deleted_at is null;

create or replace function public.product_images_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.products p
     set image_count = (select count(*) from public.product_images i where i.product_id = p.id)
   where p.id in (select distinct product_id from changed_rows);
  return null;
end $$;
drop trigger if exists product_images_count_ins on public.product_images;
drop trigger if exists product_images_count_del on public.product_images;
create trigger product_images_count_ins after insert on public.product_images
  referencing new table as changed_rows for each statement execute function public.product_images_count();
create trigger product_images_count_del after delete on public.product_images
  referencing old table as changed_rows for each statement execute function public.product_images_count();
update public.products p set image_count = c.n
  from (select product_id, count(*)::smallint as n from public.product_images group by product_id) c
 where c.product_id = p.id and p.image_count is distinct from c.n;

-- Hard delete is admin-only; staff archive / soft delete.
drop policy if exists "products: staff write" on public.products;
drop policy if exists "products: staff insert" on public.products;
drop policy if exists "products: staff update" on public.products;
drop policy if exists "products: admin delete" on public.products;
create policy "products: staff insert" on public.products for insert to authenticated with check ((select public.is_staff()));
create policy "products: staff update" on public.products for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "products: admin delete" on public.products for delete to authenticated using ((select public.is_admin()));

-- Bulk "adjust price by %" (security invoker: RLS still applies). Keeps compare-at valid.
create or replace function public.admin_adjust_prices(p_ids uuid[], p_percent numeric)
returns integer language plpgsql set search_path = '' as $$
declare v_count integer;
begin
  if not public.is_staff() then
    raise exception 'admin_adjust_prices: staff only' using errcode = '42501';
  end if;
  if p_percent is null or p_percent < -90 or p_percent > 500 then
    raise exception 'admin_adjust_prices: percent out of range' using errcode = '22023';
  end if;
  update public.products
     set price = greatest(round(price * (1 + p_percent / 100.0), 2), 0),
         compare_at_price = case when compare_at_price is not null
                                  and compare_at_price < greatest(round(price * (1 + p_percent / 100.0), 2), 0)
                                 then null else compare_at_price end
   where id = any(p_ids) and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.admin_adjust_prices(uuid[], numeric) from public, anon;
grant execute on function public.admin_adjust_prices(uuid[], numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Leads
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sell_car_requests', 'part_requests', 'return_requests', 'contact_messages'] loop
    execute format('alter table public.%I add column if not exists assigned_to uuid references public.profiles (id) on delete set null', t);
    execute format('alter table public.%I add column if not exists internal_notes text', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('create index if not exists %I on public.%I (status, created_at desc)', t || '_status_idx', t);
  end loop;
end $$;
alter table public.part_requests add column if not exists order_id uuid references public.orders (id) on delete set null;
alter table public.orders add column if not exists lead_id bigint;

-- -----------------------------------------------------------------------------
-- 6. Settings + image jobs
-- -----------------------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key check (key ~ '^[a-z_]{2,40}$'),
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
alter table public.site_settings enable row level security;
drop policy if exists "site_settings: public read" on public.site_settings;
drop policy if exists "site_settings: staff read" on public.site_settings;
drop policy if exists "site_settings: admin write" on public.site_settings;
-- Notification recipients are private; everything else is public site content.
create policy "site_settings: public read" on public.site_settings for select to anon, authenticated using (key <> 'notifications');
create policy "site_settings: staff read" on public.site_settings for select to authenticated using ((select public.is_staff()));
create policy "site_settings: admin write" on public.site_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

create table if not exists public.image_jobs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'copy_external' check (kind in ('copy_external')),
  status       text not null default 'pending' check (status in ('pending', 'running', 'completed', 'completed_with_errors', 'failed')),
  total        integer not null default 0,
  done         integer not null default 0,
  failed       integer not null default 0,
  errors       jsonb not null default '[]'::jsonb,
  created_by   uuid references public.profiles (id) on delete set null,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists image_jobs_created_idx on public.image_jobs (created_at desc);
alter table public.image_jobs enable row level security;
drop policy if exists "image_jobs: admin" on public.image_jobs;
create policy "image_jobs: admin" on public.image_jobs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Imports become admin-only.
alter policy "import_jobs: staff" on public.import_jobs to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "import_rows: staff" on public.import_rows to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create index if not exists import_jobs_created_idx on public.import_jobs (created_at desc);

-- -----------------------------------------------------------------------------
-- Audit triggers (after the columns above exist)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products', 'orders', 'donor_vehicles', 'sell_car_requests', 'part_requests',
                           'return_requests', 'contact_messages', 'profiles', 'site_settings', 'categories'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Dashboard numbers in one round trip (security invoker: RLS applies)
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_staff() then
    raise exception 'admin_dashboard: staff only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'products', (select jsonb_build_object(
        'active',      count(*) filter (where status = 'active'),
        'sold',        count(*) filter (where status = 'sold'),
        'draft',       count(*) filter (where status = 'draft'),
        'archived',    count(*) filter (where status = 'archived'),
        'noPhotos',    count(*) filter (where status = 'active' and image_count = 0),
        'total',       count(*))
      from public.products where deleted_at is null),
    'leads', jsonb_build_object(
        'sell_car', (select count(*) from public.sell_car_requests where status = 'new'),
        'part',     (select count(*) from public.part_requests where status = 'new'),
        'return',   (select count(*) from public.return_requests where status = 'new'),
        'contact',  (select count(*) from public.contact_messages where status = 'new'),
        'stale',    (select count(*) from (
                       select created_at from public.sell_car_requests where status = 'new'
                       union all select created_at from public.part_requests where status = 'new'
                       union all select created_at from public.return_requests where status = 'new'
                       union all select created_at from public.contact_messages where status = 'new') l
                     where l.created_at < now() - interval '24 hours')),
    'orders', (select jsonb_build_object(
        'new',       count(*) filter (where status = 'new'),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'paid',      count(*) filter (where status = 'paid'),
        'shipped',   count(*) filter (where status = 'shipped'),
        'open',      count(*) filter (where status in ('new', 'confirmed', 'paid')),
        'revenue30', coalesce(sum(total) filter (where status in ('paid', 'shipped', 'completed') and created_at > now() - interval '30 days'), 0),
        'revenueAll', coalesce(sum(total) filter (where status in ('paid', 'shipped', 'completed')), 0))
      from public.orders where deleted_at is null),
    'imports', (select jsonb_build_object(
        'lastAt', max(created_at),
        'failed', count(*) filter (where status in ('failed', 'completed_with_errors') and created_at > now() - interval '30 days'))
      from public.import_jobs),
    'imageJobs', (select jsonb_build_object('failed', count(*) filter (where status in ('failed', 'completed_with_errors'))) from public.image_jobs),
    'vehicles', (select jsonb_build_object('dismantling', count(*) filter (where status = 'dismantling'), 'total', count(*)) from public.donor_vehicles)
  ) into v;
  return v;
end $$;
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

notify pgrst, 'reload schema';


-- =============================================================================
-- Make yourself an admin (edit the email, then run just this statement).
-- =============================================================================
-- update public.profiles set role = 'admin' where email = 'you@example.com';
