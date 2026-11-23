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
