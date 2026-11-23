-- Genuine Auto & Truck Parts: full schema setup (generated from supabase/migrations).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run. For a FRESH project only;
-- existing projects: run just the new files from supabase/migrations/ instead.

-- ============ supabase/migrations/20261119000100_initial_schema.sql ============
-- =============================================================================
-- Genuine Auto & Truck Parts — initial schema
-- Catalog, fitment reference data, donor vehicles, commerce, leads, imports.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.product_condition as enum ('new', 'used', 'remanufactured', 'for_parts');
create type public.product_status    as enum ('draft', 'active', 'sold', 'archived');
create type public.vehicle_status    as enum ('incoming', 'dismantling', 'parted_out', 'crushed');
create type public.order_status      as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type public.lead_status       as enum ('new', 'in_progress', 'closed', 'spam');
create type public.import_source     as enum ('ebay_active_listings', 'ebay_file_exchange', 'generic_csv');
create type public.import_job_status as enum ('pending', 'running', 'completed', 'completed_with_errors', 'failed');
create type public.import_row_status as enum ('pending', 'created', 'updated', 'skipped', 'failed');
create type public.user_role         as enum ('customer', 'staff', 'admin');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Upper-case, alphanumerics only: "92401-J5000" and "92401 j5000" both become "92401J5000".
create or replace function public.normalize_part_number(value text)
returns text language sql immutable parallel safe as $$
  select nullif(regexp_replace(upper(coalesce(value, '')), '[^A-Z0-9]', '', 'g'), '')
$$;

-- -----------------------------------------------------------------------------
-- Profiles (customers + staff), linked 1:1 to auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by every admin-write RLS policy.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('staff', 'admin')
  )
$$;

-- -----------------------------------------------------------------------------
-- Fitment reference data
-- -----------------------------------------------------------------------------
create table public.makes (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  slug         text not null unique,
  aliases      text[] not null default '{}',        -- e.g. {CHEVY} for Chevrolet; used by importers
  logo_path    text,
  is_featured  boolean not null default false,
  sort_order   integer not null default 100,
  created_at   timestamptz not null default now()
);

create table public.models (
  id          bigint generated always as identity primary key,
  make_id     bigint not null references public.makes (id) on delete cascade,
  name        text not null,
  slug        text not null,
  aliases     text[] not null default '{}',         -- e.g. {328I,320I,F30} for 3 Series
  created_at  timestamptz not null default now(),
  unique (make_id, slug)
);
create index models_make_id_idx on public.models (make_id);

-- Known production years per model (reference; drives admin pickers and VIN prefill).
create table public.model_years (
  id        bigint generated always as identity primary key,
  model_id  bigint not null references public.models (id) on delete cascade,
  year      smallint not null check (year between 1900 and 2100),
  unique (model_id, year)
);

create table public.trims (
  id            bigint generated always as identity primary key,
  model_id      bigint not null references public.models (id) on delete cascade,
  name          text not null,                      -- "328i", "C300 4MATIC", "LT"
  year_from     smallint,
  year_to       smallint,
  engine        text,                               -- "2.0L L4 Turbo"
  drive_type    text,                               -- RWD / FWD / AWD / 4WD
  body_style    text,
  unique nulls not distinct (model_id, name, year_from, year_to, engine)
);
create index trims_model_id_idx on public.trims (model_id);

-- -----------------------------------------------------------------------------
-- Categories (hierarchical)
-- -----------------------------------------------------------------------------
create table public.categories (
  id                bigint generated always as identity primary key,
  parent_id         bigint references public.categories (id) on delete set null,
  name              text not null,
  slug              text not null unique,
  description       text,
  icon              text,                           -- lucide icon key for the UI
  image_path        text,
  ebay_category_id  integer unique,                 -- leaf mapping to eBay's category tree
  sort_order        integer not null default 100,
  created_at        timestamptz not null default now()
);
create index categories_parent_id_idx on public.categories (parent_id);

-- -----------------------------------------------------------------------------
-- Donor vehicles ("Currently Dismantling")
-- -----------------------------------------------------------------------------
create table public.donor_vehicles (
  id               bigint generated always as identity primary key,
  stock_number     text not null unique,
  slug             text not null unique,
  vin              text unique check (vin is null or char_length(vin) = 17),
  year             smallint not null,
  make_id          bigint not null references public.makes (id),
  model_id         bigint references public.models (id),
  trim             text,
  odometer         integer check (odometer is null or odometer >= 0),
  engine           text,
  transmission     text,
  drive_type       text,
  exterior_color   text,
  interior_color   text,
  status           public.vehicle_status not null default 'dismantling',
  description      text,
  is_featured      boolean not null default false,
  acquired_at      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index donor_vehicles_status_idx on public.donor_vehicles (status, acquired_at desc);
create index donor_vehicles_ymm_idx on public.donor_vehicles (make_id, model_id, year);
create trigger donor_vehicles_updated_at before update on public.donor_vehicles
  for each row execute function public.set_updated_at();

create table public.donor_vehicle_images (
  id            bigint generated always as identity primary key,
  vehicle_id    bigint not null references public.donor_vehicles (id) on delete cascade,
  storage_path  text,
  external_url  text,
  alt           text,
  position      smallint not null default 0,
  width         integer,
  height        integer,
  check (storage_path is not null or external_url is not null)
);
create index donor_vehicle_images_vehicle_idx on public.donor_vehicle_images (vehicle_id, position);

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  sku                   text not null unique,
  slug                  text not null unique,
  title                 text not null,
  description           text,
  condition             public.product_condition not null default 'used',
  condition_notes       text,
  status                public.product_status not null default 'draft',
  price                 numeric(10, 2) not null check (price >= 0),
  compare_at_price      numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  currency              char(3) not null default 'USD',
  quantity              integer not null default 1 check (quantity >= 0),
  oem_part_number       text,
  interchange_numbers   text[] not null default '{}',
  brand                 text,
  placement             text,                       -- Front Left, Rear Right, ...
  -- shipping
  weight_lb             numeric(8, 2),
  length_in             numeric(8, 2),
  width_in              numeric(8, 2),
  height_in             numeric(8, 2),
  is_freight            boolean not null default false,
  -- relations
  category_id           bigint references public.categories (id) on delete set null,
  donor_vehicle_id      bigint references public.donor_vehicles (id) on delete set null,
  -- free-form data from marketplaces
  item_specifics        jsonb not null default '{}'::jsonb,   -- {"Brand":"Mercedes-Benz","Placement on Vehicle":"Left"}
  external_ids          jsonb not null default '{}'::jsonb,   -- {"ebay_item_id":"357306170284","ebay_category_id":33610}
  source                text not null default 'manual',       -- manual | ebay | csv
  warranty_days         smallint not null default 90,
  is_featured           boolean not null default false,
  listed_at             timestamptz,
  -- search
  part_numbers_search   text,                       -- normalized OEM + interchange, space separated
  search_vector         tsvector,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (compare_at_price is null or compare_at_price >= price)
);

create index products_status_listed_idx   on public.products (status, listed_at desc nulls last);
create index products_category_idx        on public.products (category_id) where status in ('active', 'sold');
create index products_price_idx           on public.products (price) where status = 'active';
create index products_condition_idx       on public.products (condition) where status = 'active';
create index products_donor_vehicle_idx   on public.products (donor_vehicle_id);
create index products_search_vector_idx   on public.products using gin (search_vector);
create index products_title_trgm_idx      on public.products using gin (title extensions.gin_trgm_ops);
create index products_part_numbers_trgm   on public.products using gin (part_numbers_search extensions.gin_trgm_ops);
create index products_oem_norm_idx        on public.products (public.normalize_part_number(oem_part_number));
create index products_external_ebay_idx   on public.products ((external_ids ->> 'ebay_item_id'));
create index products_featured_idx        on public.products (is_featured) where is_featured;

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Keep the search document in sync (title, part numbers, brand, category, fitment makes/models).
create or replace function public.products_build_search()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  v_category text;
  v_fitment  text;
begin
  select name into v_category from public.categories where id = new.category_id;

  select string_agg(distinct concat_ws(' ', mk.name, mo.name, f.trim), ' ')
    into v_fitment
    from public.product_fitments f
    join public.makes mk on mk.id = f.make_id
    left join public.models mo on mo.id = f.model_id
   where f.product_id = new.id;

  new.part_numbers_search := nullif(concat_ws(' ',
      public.normalize_part_number(new.oem_part_number),
      (select string_agg(public.normalize_part_number(x), ' ') from unnest(new.interchange_numbers) x)
    ), '');

  new.search_vector :=
       setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('simple',  coalesce(new.oem_part_number, '') || ' ' || coalesce(new.part_numbers_search, '')), 'A')
    || setweight(to_tsvector('simple',  array_to_string(new.interchange_numbers, ' ')), 'B')
    || setweight(to_tsvector('english', coalesce(v_category, '') || ' ' || coalesce(v_fitment, '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.brand, '')), 'C')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end $$;

create trigger products_search_vector
  before insert or update of title, description, oem_part_number, interchange_numbers, brand, category_id
  on public.products for each row execute function public.products_build_search();

create table public.product_images (
  id            bigint generated always as identity primary key,
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text,                               -- path in the "product-images" bucket
  external_url  text,                               -- original marketplace URL (pre-download)
  alt           text,
  position      smallint not null default 0,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index product_images_product_idx on public.product_images (product_id, position);

-- One row per (product, year, make, model, trim, engine): simple equality filters, index friendly.
create table public.product_fitments (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  year        smallint not null check (year between 1900 and 2100),
  make_id     bigint not null references public.makes (id),
  model_id    bigint references public.models (id),
  trim        text,
  engine      text,
  notes       text,
  unique nulls not distinct (product_id, year, make_id, model_id, trim, engine)
);
create index product_fitments_ymm_idx     on public.product_fitments (make_id, model_id, year, product_id);
create index product_fitments_year_idx    on public.product_fitments (year, make_id);
create index product_fitments_product_idx on public.product_fitments (product_id);

-- Re-index parent products when fitment changes so make/model names stay searchable.
-- Statement-level with transition tables: one UPDATE per bulk insert, not one per row.
create or replace function public.touch_product_search_ins()
returns trigger language plpgsql as $$
begin
  update public.products set title = title where id in (select distinct product_id from new_rows);
  return null;
end $$;

create or replace function public.touch_product_search_del()
returns trigger language plpgsql as $$
begin
  update public.products set title = title where id in (select distinct product_id from old_rows);
  return null;
end $$;

create trigger product_fitments_touch_ins
  after insert on public.product_fitments
  referencing new table as new_rows
  for each statement execute function public.touch_product_search_ins();

create trigger product_fitments_touch_upd
  after update on public.product_fitments
  referencing new table as new_rows
  for each statement execute function public.touch_product_search_ins();

create trigger product_fitments_touch_del
  after delete on public.product_fitments
  referencing old table as old_rows
  for each statement execute function public.touch_product_search_del();

-- -----------------------------------------------------------------------------
-- Commerce (cart + orders). Checkout (Stripe) arrives in Phase 3.
-- -----------------------------------------------------------------------------
create table public.addresses (
  id           bigint generated always as identity primary key,
  customer_id  uuid not null references public.profiles (id) on delete cascade,
  label        text,
  full_name    text not null,
  line1        text not null,
  line2        text,
  city         text not null,
  region       text not null,
  postal_code  text not null,
  country      char(2) not null default 'US',
  phone        text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_customer_idx on public.addresses (customer_id);

create table public.carts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index carts_customer_unique on public.carts (customer_id) where customer_id is not null;
create trigger carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id          bigint generated always as identity primary key,
  cart_id     uuid not null references public.carts (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  added_at    timestamptz not null default now(),
  unique (cart_id, product_id)
);

create sequence public.order_number_seq start 100001;

create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  order_number                text not null unique default ('GA-' || nextval('public.order_number_seq')),
  customer_id                 uuid references public.profiles (id) on delete set null,
  email                       text not null,
  status                      public.order_status not null default 'pending',
  currency                    char(3) not null default 'USD',
  subtotal                    numeric(10, 2) not null default 0,
  shipping_total              numeric(10, 2) not null default 0,
  tax_total                   numeric(10, 2) not null default 0,
  discount_total              numeric(10, 2) not null default 0,
  total                       numeric(10, 2) not null default 0,
  shipping_address            jsonb,
  billing_address             jsonb,
  shipping_method             text,
  tracking_number             text,
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text unique,
  notes                       text,
  placed_at                   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  sku          text not null,
  title        text not null,
  unit_price   numeric(10, 2) not null,
  quantity     integer not null check (quantity > 0),
  line_total   numeric(10, 2) generated always as (unit_price * quantity) stored
);
create index order_items_order_idx on public.order_items (order_id);

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------
create table public.sell_car_requests (
  id                bigint generated always as identity primary key,
  name              text not null,
  email             text not null,
  phone             text,
  vehicle_year      smallint,
  vehicle_make      text,
  vehicle_model     text,
  vin               text,
  mileage           integer,
  pickup_location   text,
  asking_price      numeric(10, 2),
  notes             text,
  status            public.lead_status not null default 'new',
  created_at        timestamptz not null default now()
);

create table public.part_requests (
  id              bigint generated always as identity primary key,
  product_id      uuid references public.products (id) on delete set null,   -- set = "make an offer"
  name            text not null,
  email           text not null,
  phone           text,
  vehicle_year    smallint,
  vehicle_make    text,
  vehicle_model   text,
  vin             text,
  part_name       text,
  part_number     text,
  offer_amount    numeric(10, 2),
  message         text,
  status          public.lead_status not null default 'new',
  created_at      timestamptz not null default now()
);

create table public.return_requests (
  id              bigint generated always as identity primary key,
  order_id        uuid references public.orders (id) on delete set null,
  order_number    text,
  invoice_number  text,
  name            text not null,
  email           text not null,
  phone           text,
  reason          text not null,
  description     text,
  status          public.lead_status not null default 'new',
  created_at      timestamptz not null default now()
);

create table public.contact_messages (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null,
  phone       text,
  subject     text,
  message     text not null,
  status      public.lead_status not null default 'new',
  created_at  timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id               bigint generated always as identity primary key,
  email            text not null unique,
  source           text,
  unsubscribed_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- CSV import tracking
-- -----------------------------------------------------------------------------
create table public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  source         public.import_source not null,
  filename       text not null,
  status         public.import_job_status not null default 'pending',
  options        jsonb not null default '{}'::jsonb,     -- {"dryRun":false,"downloadImages":true}
  total_rows     integer not null default 0,
  created_count  integer not null default 0,
  updated_count  integer not null default 0,
  skipped_count  integer not null default 0,
  failed_count   integer not null default 0,
  created_by     uuid references public.profiles (id) on delete set null,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table public.import_rows (
  id             bigint generated always as identity primary key,
  job_id         uuid not null references public.import_jobs (id) on delete cascade,
  row_number     integer not null,
  raw            jsonb not null,
  status         public.import_row_status not null default 'pending',
  product_id     uuid references public.products (id) on delete set null,
  error_message  text,
  warnings       text[] not null default '{}',
  created_at     timestamptz not null default now(),
  unique (job_id, row_number)
);
create index import_rows_job_status_idx on public.import_rows (job_id, status);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.makes                  enable row level security;
alter table public.models                 enable row level security;
alter table public.model_years            enable row level security;
alter table public.trims                  enable row level security;
alter table public.categories             enable row level security;
alter table public.donor_vehicles         enable row level security;
alter table public.donor_vehicle_images   enable row level security;
alter table public.products               enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_fitments       enable row level security;
alter table public.addresses              enable row level security;
alter table public.carts                  enable row level security;
alter table public.cart_items             enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.sell_car_requests      enable row level security;
alter table public.part_requests          enable row level security;
alter table public.return_requests        enable row level security;
alter table public.contact_messages       enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.import_jobs            enable row level security;
alter table public.import_rows            enable row level security;

-- Profiles: users see/edit their own row (role changes are staff-only).
create policy "profiles: self read"  on public.profiles for select using ((select auth.uid()) = id or public.is_staff());
create policy "profiles: self update" on public.profiles for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Customers can edit their own profile but never their role.
create or replace function public.profiles_guard_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Signed-in API users run as "authenticated"; service role and SQL editor sessions are trusted.
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not public.is_staff() then
    raise exception 'Only staff can change roles';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update of role on public.profiles
  for each row execute function public.profiles_guard_role();
create policy "profiles: staff all" on public.profiles for all using (public.is_staff()) with check (public.is_staff());

-- Public reference data: anyone reads, staff writes.
create policy "makes: public read"       on public.makes       for select using (true);
create policy "models: public read"      on public.models      for select using (true);
create policy "model_years: public read" on public.model_years for select using (true);
create policy "trims: public read"       on public.trims       for select using (true);
create policy "categories: public read"  on public.categories  for select using (true);
create policy "makes: staff write"       on public.makes       for all using (public.is_staff()) with check (public.is_staff());
create policy "models: staff write"      on public.models      for all using (public.is_staff()) with check (public.is_staff());
create policy "model_years: staff write" on public.model_years for all using (public.is_staff()) with check (public.is_staff());
create policy "trims: staff write"       on public.trims       for all using (public.is_staff()) with check (public.is_staff());
create policy "categories: staff write"  on public.categories  for all using (public.is_staff()) with check (public.is_staff());

-- Donor vehicles: public sees everything except vehicles still being received.
create policy "donor_vehicles: public read" on public.donor_vehicles for select
  using (status <> 'incoming' or public.is_staff());
create policy "donor_vehicles: staff write" on public.donor_vehicles for all using (public.is_staff()) with check (public.is_staff());
create policy "donor_vehicle_images: public read" on public.donor_vehicle_images for select using (true);
create policy "donor_vehicle_images: staff write" on public.donor_vehicle_images for all using (public.is_staff()) with check (public.is_staff());

-- Products: public reads active + sold (sold items stay visible with a "Sold out" badge for SEO).
create policy "products: public read" on public.products for select
  using (status in ('active', 'sold') or public.is_staff());
create policy "products: staff write" on public.products for all using (public.is_staff()) with check (public.is_staff());

create policy "product_images: public read" on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.status in ('active', 'sold') or public.is_staff())));
create policy "product_images: staff write" on public.product_images for all using (public.is_staff()) with check (public.is_staff());

create policy "product_fitments: public read" on public.product_fitments for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.status in ('active', 'sold') or public.is_staff())));
create policy "product_fitments: staff write" on public.product_fitments for all using (public.is_staff()) with check (public.is_staff());

-- Customer-owned data.
create policy "addresses: owner" on public.addresses for all
  using ((select auth.uid()) = customer_id or public.is_staff())
  with check ((select auth.uid()) = customer_id or public.is_staff());
create policy "carts: owner" on public.carts for all
  using ((select auth.uid()) = customer_id or public.is_staff())
  with check ((select auth.uid()) = customer_id or public.is_staff());
create policy "cart_items: owner" on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and ((select auth.uid()) = c.customer_id or public.is_staff())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and ((select auth.uid()) = c.customer_id or public.is_staff())));
-- Orders are created server-side (service role, after Stripe confirms); customers only read their own.
create policy "orders: owner read" on public.orders for select
  using ((select auth.uid()) = customer_id or public.is_staff());
create policy "orders: staff write" on public.orders for all using (public.is_staff()) with check (public.is_staff());
create policy "order_items: owner read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and ((select auth.uid()) = o.customer_id or public.is_staff())));
create policy "order_items: staff write" on public.order_items for all using (public.is_staff()) with check (public.is_staff());

-- Leads: anyone may submit (insert only), only staff can read/manage.
create policy "sell_car_requests: public insert" on public.sell_car_requests for insert with check (status = 'new');
create policy "part_requests: public insert"     on public.part_requests     for insert with check (status = 'new');
create policy "return_requests: public insert"   on public.return_requests   for insert with check (status = 'new');
create policy "contact_messages: public insert"  on public.contact_messages  for insert with check (status = 'new');
create policy "newsletter: public insert"        on public.newsletter_subscribers for insert with check (unsubscribed_at is null);
create policy "sell_car_requests: staff" on public.sell_car_requests for all using (public.is_staff()) with check (public.is_staff());
create policy "part_requests: staff"     on public.part_requests     for all using (public.is_staff()) with check (public.is_staff());
create policy "return_requests: staff"   on public.return_requests   for all using (public.is_staff()) with check (public.is_staff());
create policy "contact_messages: staff"  on public.contact_messages  for all using (public.is_staff()) with check (public.is_staff());
create policy "newsletter: staff"        on public.newsletter_subscribers for all using (public.is_staff()) with check (public.is_staff());

-- Imports: staff only (the CLI importer uses the service role and bypasses RLS).
create policy "import_jobs: staff" on public.import_jobs for all using (public.is_staff()) with check (public.is_staff());
create policy "import_rows: staff" on public.import_rows for all using (public.is_staff()) with check (public.is_staff());

-- =============================================================================
-- Storage buckets
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('vehicle-images', 'vehicle-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "catalog images: public read" on storage.objects for select
  using (bucket_id in ('product-images', 'vehicle-images'));
create policy "catalog images: staff write" on storage.objects for insert
  with check (bucket_id in ('product-images', 'vehicle-images') and public.is_staff());
create policy "catalog images: staff update" on storage.objects for update
  using (bucket_id in ('product-images', 'vehicle-images') and public.is_staff());
create policy "catalog images: staff delete" on storage.objects for delete
  using (bucket_id in ('product-images', 'vehicle-images') and public.is_staff());

-- ============ supabase/migrations/20261119000200_search.sql ============
-- =============================================================================
-- Search: full-text + trigram + part-number matching, fitment filters,
-- faceted counts and the dependent Year -> Make -> Model lookups.
-- All functions are SECURITY INVOKER so RLS still applies.
-- =============================================================================

-- Also index the compacted title: "3C8 868 133" in a title becomes searchable as "3C8868133".
create or replace function public.products_build_search()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  v_category text;
  v_fitment  text;
begin
  select name into v_category from public.categories where id = new.category_id;

  select string_agg(distinct concat_ws(' ', mk.name, mo.name, f.trim), ' ')
    into v_fitment
    from public.product_fitments f
    join public.makes mk on mk.id = f.make_id
    left join public.models mo on mo.id = f.model_id
   where f.product_id = new.id;

  new.part_numbers_search := nullif(concat_ws(' ',
      public.normalize_part_number(new.oem_part_number),
      (select string_agg(public.normalize_part_number(x), ' ') from unnest(new.interchange_numbers) x),
      public.normalize_part_number(new.title)
    ), '');

  new.search_vector :=
       setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('simple',  coalesce(new.oem_part_number, '')), 'A')
    || setweight(to_tsvector('simple',  array_to_string(new.interchange_numbers, ' ')), 'B')
    || setweight(to_tsvector('english', coalesce(v_category, '') || ' ' || coalesce(v_fitment, '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.brand, '')), 'C')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end $$;

-- Category plus all of its descendants.
create or replace function public.category_tree_ids(p_slug text)
returns setof bigint language sql stable as $$
  with recursive tree as (
    select id from public.categories where slug = p_slug
    union all
    select c.id from public.categories c join tree t on c.parent_id = t.id
  )
  select id from tree
$$;

-- Core filter. Returns matching product ids with a relevance score.
-- Kept as a single SQL SELECT so the planner can inline it and use indexes.
create or replace function public.search_product_ids(
  p_query        text    default null,
  p_year         integer default null,
  p_make         text    default null,   -- make slug
  p_model        text    default null,   -- model slug
  p_category     text    default null,   -- category slug (descendants included)
  p_part_number  text    default null,
  p_condition    text    default null,   -- product_condition value
  p_min_price    numeric default null,
  p_max_price    numeric default null,
  p_in_stock     boolean default false,
  p_vehicle      text    default null    -- donor vehicle stock number
)
returns table (product_id uuid, score real)
language sql stable set search_path = public, extensions as $$
  with q as (
    select
      nullif(btrim(p_query), '')                                     as raw,
      case when nullif(btrim(p_query), '') is null then null
           else websearch_to_tsquery('english', p_query) end         as tsq,
      public.normalize_part_number(p_query)                          as q_norm,
      public.normalize_part_number(p_part_number)                    as pn_norm
  )
  select p.id,
         (case when q.raw is null then 0
               else ts_rank_cd(p.search_vector, q.tsq) * 2
                  + word_similarity(q.raw, p.title)
                  + case when q.q_norm is not null and length(q.q_norm) >= 5
                              and p.part_numbers_search like '%' || q.q_norm || '%' then 3 else 0 end
          end)::real as score
    from public.products p
   cross join q
   where p.status in ('active', 'sold')
     and (not p_in_stock or (p.status = 'active' and p.quantity > 0))
     and (q.raw is null
          or p.search_vector @@ q.tsq
          or q.raw <% p.title
          or (q.q_norm is not null and length(q.q_norm) >= 5 and p.part_numbers_search like '%' || q.q_norm || '%'))
     and (q.pn_norm is null or p.part_numbers_search like '%' || q.pn_norm || '%')
     and (p_condition is null or p.condition::text = p_condition)
     and (p_min_price is null or p.price >= p_min_price)
     and (p_max_price is null or p.price <= p_max_price)
     and (p_category is null or p.category_id in (select public.category_tree_ids(p_category)))
     and (p_vehicle is null or p.donor_vehicle_id = (select id from public.donor_vehicles where stock_number = p_vehicle))
     and ((p_year is null and p_make is null and p_model is null)
          or exists (
            select 1
              from public.product_fitments f
              join public.makes mk on mk.id = f.make_id
              left join public.models mo on mo.id = f.model_id
             where f.product_id = p.id
               and (p_year  is null or f.year = p_year)
               and (p_make  is null or mk.slug = p_make)
               and (p_model is null or mo.slug = p_model)))
$$;

-- Sorted product rows. Paginate with PostgREST .range() and use count=exact for totals;
-- embed images with .select('*, product_images(*)').
create or replace function public.search_products(
  p_query        text    default null,
  p_year         integer default null,
  p_make         text    default null,
  p_model        text    default null,
  p_category     text    default null,
  p_part_number  text    default null,
  p_condition    text    default null,
  p_min_price    numeric default null,
  p_max_price    numeric default null,
  p_in_stock     boolean default false,
  p_vehicle      text    default null,
  p_sort         text    default 'relevance'   -- relevance | newest | price_asc | price_desc
)
returns setof public.products
language sql stable set search_path = public, extensions as $$
  select p.*
    from public.search_product_ids(p_query, p_year, p_make, p_model, p_category, p_part_number,
                                   p_condition, p_min_price, p_max_price, p_in_stock, p_vehicle) s
    join public.products p on p.id = s.product_id
   order by
     (p.status = 'active' and p.quantity > 0) desc,
     case when p_sort = 'price_asc'  then p.price end asc nulls last,
     case when p_sort = 'price_desc' then p.price end desc nulls last,
     case when p_sort = 'relevance'  then s.score end desc nulls last,
     p.listed_at desc nulls last,
     p.id
$$;

-- Facet counts for the listing sidebar. Each facet ignores its own filter so the
-- shopper can see (and switch to) sibling values.
create or replace function public.search_facets(
  p_query        text    default null,
  p_year         integer default null,
  p_make         text    default null,
  p_model        text    default null,
  p_category     text    default null,
  p_part_number  text    default null,
  p_condition    text    default null,
  p_min_price    numeric default null,
  p_max_price    numeric default null,
  p_in_stock     boolean default false,
  p_vehicle      text    default null
)
returns jsonb
language sql stable set search_path = public, extensions as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', root.slug, 'name', root.name, 'count', x.cnt) order by x.cnt desc)
        from (
          select coalesce(c.parent_id, c.id) as root_id, count(*) as cnt
            from public.search_product_ids(p_query, p_year, p_make, p_model, null, p_part_number,
                                           p_condition, p_min_price, p_max_price, p_in_stock, p_vehicle) s
            join public.products p on p.id = s.product_id
            join public.categories c on c.id = p.category_id
           group by 1
        ) x
        join public.categories root on root.id = x.root_id
    ), '[]'::jsonb),
    'makes', coalesce((
      select jsonb_agg(jsonb_build_object('slug', mk.slug, 'name', mk.name, 'count', x.cnt) order by x.cnt desc)
        from (
          select f.make_id, count(distinct f.product_id) as cnt
            from public.search_product_ids(p_query, p_year, null, null, p_category, p_part_number,
                                           p_condition, p_min_price, p_max_price, p_in_stock, p_vehicle) s
            join public.product_fitments f on f.product_id = s.product_id
           group by 1
        ) x
        join public.makes mk on mk.id = x.make_id
    ), '[]'::jsonb),
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object('value', x.condition, 'count', x.cnt) order by x.cnt desc)
        from (
          select p.condition::text as condition, count(*) as cnt
            from public.search_product_ids(p_query, p_year, p_make, p_model, p_category, p_part_number,
                                           null, p_min_price, p_max_price, p_in_stock, p_vehicle) s
            join public.products p on p.id = s.product_id
           group by 1
        ) x
    ), '[]'::jsonb),
    'price', (
      select jsonb_build_object('min', coalesce(min(p.price), 0), 'max', coalesce(max(p.price), 0))
        from public.search_product_ids(p_query, p_year, p_make, p_model, p_category, p_part_number,
                                       p_condition, null, null, p_in_stock, p_vehicle) s
        join public.products p on p.id = s.product_id
    )
  )
$$;

-- -----------------------------------------------------------------------------
-- Dependent dropdowns: only offer combinations that have sellable parts.
-- -----------------------------------------------------------------------------
create or replace function public.fitment_years()
returns table (year smallint, product_count bigint)
language sql stable as $$
  select f.year, count(distinct f.product_id)
    from public.product_fitments f
    join public.products p on p.id = f.product_id and p.status = 'active'
   group by f.year
   order by f.year desc
$$;

create or replace function public.fitment_makes(p_year integer default null)
returns table (slug text, name text, product_count bigint)
language sql stable as $$
  select mk.slug, mk.name, count(distinct f.product_id)
    from public.product_fitments f
    join public.products p on p.id = f.product_id and p.status = 'active'
    join public.makes mk on mk.id = f.make_id
   where p_year is null or f.year = p_year
   group by mk.slug, mk.name
   order by mk.name
$$;

create or replace function public.fitment_models(p_make text, p_year integer default null)
returns table (slug text, name text, product_count bigint)
language sql stable as $$
  select mo.slug, mo.name, count(distinct f.product_id)
    from public.product_fitments f
    join public.products p on p.id = f.product_id and p.status = 'active'
    join public.makes mk on mk.id = f.make_id and mk.slug = p_make
    join public.models mo on mo.id = f.model_id
   where p_year is null or f.year = p_year
   group by mo.slug, mo.name
   order by mo.name
$$;

-- Hero stats row.
create or replace function public.catalog_stats()
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'activeParts', (select count(*) from public.products where status = 'active' and quantity > 0),
    'makes',       (select count(distinct f.make_id)
                      from public.product_fitments f
                      join public.products p on p.id = f.product_id and p.status = 'active'),
    'vehicles',    (select count(*) from public.donor_vehicles where status = 'dismantling')
  )
$$;

grant execute on function
  public.search_product_ids, public.search_products, public.search_facets,
  public.fitment_years, public.fitment_makes, public.fitment_models,
  public.catalog_stats, public.category_tree_ids, public.normalize_part_number
to anon, authenticated;

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

-- ============ supabase/migrations/20261120000500_auth_profile_and_catalog_summary.sql ============
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
