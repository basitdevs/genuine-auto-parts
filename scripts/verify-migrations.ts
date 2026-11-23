/**
 * Smoke-tests supabase/migrations + supabase/seed.sql in an in-memory Postgres (PGlite),
 * no Docker needed. Supabase's auth/storage schemas and roles are stubbed.
 *
 *   npm run db:verify
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const SUPABASE_STUBS = `
  create schema if not exists extensions;
  create schema if not exists auth;
  create schema if not exists storage;
  do $$ begin
    create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin
    create role authenticated nologin; exception when duplicate_object then null; end $$;
  do $$ begin
    create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, extensions to anon, authenticated, service_role;
`;

type Check = { name: string; sql: string; expect: (rows: Record<string, unknown>[]) => boolean };

const CHECKS: Check[] = [
  {
    name: "new auth user gets a customer profile (handle_new_user trigger)",
    sql: "insert into auth.users (email, raw_user_meta_data) values ('t@example.com', '{\"full_name\":\"T\"}'); select role::text as role, full_name from profiles where email = 't@example.com'",
    expect: (r) => r[0]?.role === "customer" && r[0]?.full_name === "T",
  },
  { name: "seed products are active", sql: "select count(*)::int as n from products where status = 'active'", expect: (r) => Number(r[0].n) === 12 },
  { name: "fitments created", sql: "select count(*)::int as n from product_fitments", expect: (r) => Number(r[0].n) > 12 },
  { name: "search vector includes fitment make", sql: "select count(*)::int as n from products where search_vector @@ to_tsquery('english', 'kia')", expect: (r) => Number(r[0].n) >= 2 },
  { name: "keyword search ranks results", sql: "select title from search_products(p_query => 'headlamp bracket')", expect: (r) => r.length >= 1 && String(r[0].title).toLowerCase().includes("headlamp") },
  { name: "part number search ignores dashes", sql: "select title from search_products(p_part_number => '84766J5000')", expect: (r) => r.length === 1 },
  { name: "part number in free text", sql: "select title from search_products(p_query => '204-620-01-91')", expect: (r) => r.length === 1 },
  { name: "year/make/model filter", sql: "select title from search_products(p_year => 2019, p_make => 'chevrolet', p_model => 'malibu')", expect: (r) => r.length >= 1 },
  { name: "category tree filter", sql: "select title from search_products(p_category => 'lighting')", expect: (r) => r.length >= 1 },
  { name: "price + sort", sql: "select price from search_products(p_min_price => 50, p_sort => 'price_asc')", expect: (r) => r.length > 1 && Number(r[0].price) <= Number(r[r.length - 1].price) },
  { name: "donor vehicle filter", sql: "select title from search_products(p_vehicle => 'DEMO-101')", expect: (r) => r.length >= 1 },
  { name: "facets", sql: "select search_facets() as f", expect: (r) => JSON.stringify(r[0].f).includes('"categories"') },
  { name: "fitment_years", sql: "select * from fitment_years()", expect: (r) => r.length > 0 },
  { name: "fitment_makes(year)", sql: "select * from fitment_makes(2018)", expect: (r) => r.some((m) => m.slug === "kia") },
  { name: "fitment_models(make)", sql: "select * from fitment_models('bmw')", expect: (r) => r.length >= 1 },
  { name: "catalog_stats", sql: "select catalog_stats() as s", expect: (r) => JSON.stringify(r[0].s).includes('"activeParts": 12') || JSON.stringify(r[0].s).includes('"activeParts":12') },
  {
    name: "RLS: anon cannot read drafts",
    sql: `update products set status = 'draft' where sku = (select sku from products order by sku limit 1);
          set role anon; select count(*)::int as n from products; `,
    expect: (r) => Number(r[0].n) === 11,
  },
  { name: "RLS: anon cannot read leads", sql: "select count(*)::int as n from sell_car_requests", expect: (r) => Number(r[0].n) === 0 },
  {
    // No RETURNING: anon has insert but not select on leads, so server actions must not chain .select().
    name: "RLS: anon can submit a lead (insert-only)",
    sql: "insert into contact_messages (name, email, message) values ('Test', 't@example.com', 'Hi'); reset role; select count(*)::int as n from contact_messages",
    expect: (r) => Number(r[0].n) === 1,
  },
  {
    name: "rate limit allows the first 5, blocks the 6th",
    sql: `reset role; set role anon;
          select array_agg(public.check_form_rate_limit('test-key-0123456789abcdef', 5, 600)) as r from generate_series(1, 6);`,
    expect: (r) => JSON.stringify(r[0].r) === JSON.stringify([true, true, true, true, true, false]),
  },
  { name: "rate limit table is not readable by anon", sql: "select count(*)::int as n from form_rate_limits", expect: (r) => Number(r[0].n) === 0 },
  { name: "rate limit rejects junk keys", sql: "select public.check_form_rate_limit('short') as ok", expect: (r) => r[0].ok === false },
  {
    name: "profile failure never blocks auth user creation",
    sql: `reset role;
          alter table profiles add constraint t_boom check (email is distinct from 'boom@example.com') not valid;
          insert into auth.users (email) values ('boom@example.com');
          alter table profiles drop constraint t_boom;
          select (select count(*) from auth.users where email = 'boom@example.com')::int as users,
                 (select count(*) from profiles where email = 'boom@example.com')::int as profiles`,
    expect: (r) => r[0].users === 1 && r[0].profiles === 0,
  },
  {
    name: "catalog summary refreshes as service role",
    sql: `reset role; set role service_role; select set_config('request.jwt.claim.role', 'service_role', false);
          select public.refresh_catalog_summary();
          reset role; select set_config('request.jwt.claim.role', '', false);
          select jsonb_array_length(category_counts) as cats, (stats ->> 'activeParts')::int as active,
                 jsonb_typeof(facets -> 'makes') as makes from catalog_summary`,
    expect: (r) => Number(r[0].cats) > 0 && r[0].active === 11 && r[0].makes === "array",
  },
  {
    name: "catalog summary readable by anon, refresh rejected for anon and non-staff",
    sql: `reset role;
          set role anon; select set_config('request.jwt.claim.role', 'anon', false);
          do $$ begin perform public.refresh_catalog_summary(); raise exception 'anon allowed';
          exception when insufficient_privilege then null; end $$;
          reset role; set role authenticated;
          select set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', gen_random_uuid()::text, false);
          do $$ begin perform public.refresh_catalog_summary(); raise exception 'non-staff allowed';
          exception when insufficient_privilege then null; end $$;
          reset role; set role anon; select count(*)::int as n from catalog_summary`,
    expect: (r) => r[0].n === 1,
  },
  // ---------------------------------------------------------------- 0600 admin
  {
    name: "0600: admin/staff/customer fixtures",
    sql: `reset role; select set_config('request.jwt.claim.role', '', false), set_config('request.jwt.claim.sub', '', false);
          insert into auth.users (id, email) values
            ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
            ('00000000-0000-0000-0000-00000000000b', 'staff@test.local'),
            ('00000000-0000-0000-0000-00000000000c', 'cust@test.local');
          update profiles set role = 'admin' where email = 'admin@test.local';
          update profiles set role = 'staff' where email = 'staff@test.local';
          select count(*)::int as n from profiles where email like '%@test.local'`,
    expect: (r) => r[0].n === 3,
  },
  {
    name: "0600: is_admin / is_staff per role",
    sql: `set role authenticated;
          select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); select public.is_admin() as a1, public.is_staff() as s1;`,
    expect: (r) => r[0].a1 === true && r[0].s1 === true,
  },
  {
    name: "0600: staff is not admin; customer is neither",
    sql: `select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
          select public.is_admin() as a, public.is_staff() as s,
                 (select count(*)::int from audit_log) as audit_visible`,
    expect: (r) => r[0].a === false && r[0].s === true && r[0].audit_visible === 0,
  },
  {
    name: "0600: staff cannot promote themselves to admin",
    sql: `do $$ begin
            update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b';
            raise exception 'escalation allowed';
          exception when insufficient_privilege then null; end $$;
          reset role; select role::text as role from profiles where id = '00000000-0000-0000-0000-00000000000b'`,
    expect: (r) => r[0].role === "staff",
  },
  {
    name: "0600: customer cannot read other profiles or settings secrets",
    sql: `reset role; insert into site_settings (key, value) values ('notifications', '{"emails":["x@y.z"]}'), ('flags', '{"showPrices":true}');
          set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
          select (select count(*)::int from profiles) as profiles, (select count(*)::int from site_settings) as settings`,
    expect: (r) => r[0].profiles === 1 && r[0].settings === 1,
  },
  {
    name: "0600: anon order request uses DB prices and logs a timeline event",
    sql: `reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);
          select * from public.create_order_request('Buyer@Example.com', 'Buyer', null, '85001', 'hi',
            (select jsonb_agg(jsonb_build_object('product_id', id, 'quantity', 5, 'price', 0.01)) from (select id from products where status = 'active' order by sku limit 2) x));
          reset role;
          select o.status, o.source, o.email, o.subtotal::numeric as subtotal,
                 (select sum(p.price) from products p join order_items i on i.product_id = p.id where i.order_id = o.id)::numeric as expected,
                 (select count(*)::int from order_events e where e.order_id = o.id) as events
            from orders o order by created_at desc limit 1`,
    expect: (r) =>
      r[0].status === "new" && r[0].source === "request" && r[0].email === "buyer@example.com" && Number(r[0].subtotal) === Number(r[0].expected) && r[0].events === 1,
  },
  {
    name: "0600: order request with no available items is rejected (no empty order)",
    sql: `set role anon;
          do $$ begin
            perform public.create_order_request('a@b.co', 'A', null, null, null, '[{"product_id":"00000000-0000-0000-0000-000000000999"}]'::jsonb);
            raise exception 'empty order allowed';
          exception when raise_exception then
            if sqlerrm like '%empty order allowed%' then raise; end if;
          end $$;
          reset role; select count(*)::int as n from orders`,
    expect: (r) => r[0].n === 1,
  },
  {
    name: "0600: staff edits are audited with only changed columns; service role is not",
    sql: `reset role; set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
          update products set price = price + 1 where sku = (select sku from products where status = 'active' order by sku limit 1);
          reset role; select set_config('request.jwt.claim.sub', '', false);
          update products set price = price + 1 where sku = (select sku from products where status = 'active' order by sku limit 1);
          select count(*)::int as n, min(actor_email) as actor, min(action) as action,
                 (select array_agg(k) from jsonb_object_keys(min(after::text)::jsonb) k) as keys
            from audit_log where entity_type = 'products'`,
    expect: (r) => r[0].n === 1 && r[0].actor === "staff@test.local" && r[0].action === "update" && JSON.stringify(r[0].keys) === '["price"]',
  },
  {
    name: "0600: admin can read audit log, adjust prices and load the dashboard",
    sql: `set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
          select (select count(*)::int from audit_log) as audit,
                 public.admin_adjust_prices((select array_agg(id) from (select id from products where status = 'active' order by sku limit 2) x), 10) as adjusted,
                 (public.admin_dashboard() -> 'orders' ->> 'new')::int as new_orders`,
    expect: (r) => Number(r[0].audit) >= 1 && r[0].adjusted === 2 && r[0].new_orders === 1,
  },
  {
    name: "0600: dashboard and price RPCs reject anon",
    sql: `reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);
          do $$ begin perform public.admin_dashboard(); raise exception 'anon dashboard'; exception when insufficient_privilege then null; end $$;
          do $$ begin perform public.admin_adjust_prices(array[]::uuid[], 5); raise exception 'anon prices'; exception when insufficient_privilege then null; end $$;
          reset role; select 1 as ok`,
    expect: (r) => r[0].ok === 1,
  },
  {
    name: "0600: disabled admin loses access",
    sql: `reset role; update profiles set disabled_at = now() where id = '00000000-0000-0000-0000-00000000000a';
          set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
          select public.is_admin() as a, public.is_staff() as s`,
    expect: (r) => r[0].a === false && r[0].s === false,
  },
];

async function main() {
  const db = await PGlite.create({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUBS);

  const dir = "supabase/migrations";
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
      console.log(`✓ migration ${file}`);
    } catch (error) {
      console.error(`✗ migration ${file}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  // Supabase grants table privileges to API roles by default; mirror that.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
    grant usage, select on all sequences in schema public to anon, authenticated, service_role;
  `);
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  console.log("✓ seed.sql");

  let failed = 0;
  for (const check of CHECKS) {
    try {
      const results = await db.exec(check.sql);
      const rows = (results[results.length - 1]?.rows ?? []) as Record<string, unknown>[];
      const ok = check.expect(rows);
      if (!ok) failed++;
      console.log(`${ok ? "✓" : "✗"} ${check.name}${ok ? "" : `  -> ${JSON.stringify(rows).slice(0, 300)}`}`);
    } catch (error) {
      failed++;
      console.log(`✗ ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await db.close();
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll database checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
