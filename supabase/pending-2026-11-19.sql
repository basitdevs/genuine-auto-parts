-- Run this once in Supabase Dashboard -> SQL Editor (project already has migrations 0100 + 0200).

-- ============ supabase/migrations/20261119000300_form_rate_limits.sql ============
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

-- ============ supabase/migrations/20261119000400_rls_performance.sql ============
-- =============================================================================
-- RLS performance: evaluate is_staff() once per statement instead of once per row.
--  * (select public.is_staff()) becomes an InitPlan (Supabase-recommended pattern).
--  * Staff-only policies are scoped to the authenticated role, so anonymous visitors
--    never evaluate them at all.
-- Behaviour is unchanged; only the query plans get cheaper.
-- =============================================================================

alter policy "profiles: self read" on public.profiles using ((select auth.uid()) = id or (select public.is_staff()));
alter policy "profiles: staff all" on public.profiles to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "makes: staff write" on public.makes to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "models: staff write" on public.models to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "model_years: staff write" on public.model_years to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "trims: staff write" on public.trims to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "categories: staff write" on public.categories to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "donor_vehicles: public read" on public.donor_vehicles using (status <> 'incoming' or (select public.is_staff()));
alter policy "donor_vehicles: staff write" on public.donor_vehicles to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "donor_vehicle_images: staff write" on public.donor_vehicle_images to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "products: public read" on public.products using (status in ('active', 'sold') or (select public.is_staff()));
alter policy "products: staff write" on public.products to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "product_images: public read" on public.product_images using (exists (select 1 from public.products p where p.id = product_id and (p.status in ('active', 'sold') or (select public.is_staff()))));
alter policy "product_images: staff write" on public.product_images to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "product_fitments: public read" on public.product_fitments using (exists (select 1 from public.products p where p.id = product_id and (p.status in ('active', 'sold') or (select public.is_staff()))));
alter policy "product_fitments: staff write" on public.product_fitments to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "addresses: owner" on public.addresses using ((select auth.uid()) = customer_id or (select public.is_staff())) with check ((select auth.uid()) = customer_id or (select public.is_staff()));
alter policy "carts: owner" on public.carts using ((select auth.uid()) = customer_id or (select public.is_staff())) with check ((select auth.uid()) = customer_id or (select public.is_staff()));
alter policy "cart_items: owner" on public.cart_items using (exists (select 1 from public.carts c where c.id = cart_id and ((select auth.uid()) = c.customer_id or (select public.is_staff())))) with check (exists (select 1 from public.carts c where c.id = cart_id and ((select auth.uid()) = c.customer_id or (select public.is_staff()))));
alter policy "orders: owner read" on public.orders using ((select auth.uid()) = customer_id or (select public.is_staff()));
alter policy "orders: staff write" on public.orders to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "order_items: owner read" on public.order_items using (exists (select 1 from public.orders o where o.id = order_id and ((select auth.uid()) = o.customer_id or (select public.is_staff()))));
alter policy "order_items: staff write" on public.order_items to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "sell_car_requests: staff" on public.sell_car_requests to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "part_requests: staff" on public.part_requests to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "return_requests: staff" on public.return_requests to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "contact_messages: staff" on public.contact_messages to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "newsletter: staff" on public.newsletter_subscribers to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "import_jobs: staff" on public.import_jobs to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "import_rows: staff" on public.import_rows to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
alter policy "catalog images: staff write" on storage.objects to authenticated with check (bucket_id in ('product-images', 'vehicle-images') and (select public.is_staff()));
alter policy "catalog images: staff update" on storage.objects to authenticated using (bucket_id in ('product-images', 'vehicle-images') and (select public.is_staff()));
alter policy "catalog images: staff delete" on storage.objects to authenticated using (bucket_id in ('product-images', 'vehicle-images') and (select public.is_staff()));
