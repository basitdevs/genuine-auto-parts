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
