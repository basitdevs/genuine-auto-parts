-- =============================================================================
-- Form spam protection: fixed-window rate limiting for public lead forms.
-- Keys are salted SHA-256 hashes of the visitor IP (computed in the app), never raw IPs.
-- =============================================================================

create table if not exists public.form_rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 1,
  primary key (key, window_start)
);

-- No policies: the table is reachable only through check_form_rate_limit().
alter table public.form_rate_limits enable row level security;

-- Returns true when the request is allowed. Also prunes old windows opportunistically.
create or replace function public.check_form_rate_limit(p_key text, p_max integer default 5, p_window_seconds integer default 600)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  if p_key is null or length(p_key) < 16 or length(p_key) > 128 then
    return false;
  end if;

  insert into public.form_rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  if random() < 0.02 then
    delete from public.form_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= least(greatest(p_max, 1), 50);
end $$;

revoke all on function public.check_form_rate_limit(text, integer, integer) from public;
grant execute on function public.check_form_rate_limit(text, integer, integer) to anon, authenticated;
