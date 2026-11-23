/**
 * Database types for supabase-js.
 *
 * Hand-written to mirror supabase/migrations until a project is linked; then
 * regenerate with `npm run db:types` (supabase gen types typescript) and keep the
 * same export names.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

/** Insert: columns with defaults / nullable become optional. */
type TableDef<Row, Required extends keyof Row, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type ProductCondition = "new" | "used" | "remanufactured" | "for_parts";
export type ProductStatus = "draft" | "active" | "sold" | "archived";
export type VehicleStatus = "incoming" | "dismantling" | "parted_out" | "crushed";
export type LeadStatus = "new" | "in_progress" | "closed" | "spam";

export type MakeRow = {
  id: number;
  name: string;
  slug: string;
  aliases: string[];
  logo_path: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
};

export type ModelRow = { id: number; make_id: number; name: string; slug: string; aliases: string[]; created_at: string };

export type CategoryRow = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_path: string | null;
  ebay_category_id: number | null;
  sort_order: number;
  created_at: string;
};

export type DonorVehicleRow = {
  id: number;
  stock_number: string;
  slug: string;
  vin: string | null;
  year: number;
  make_id: number;
  model_id: number | null;
  trim: string | null;
  odometer: number | null;
  engine: string | null;
  transmission: string | null;
  drive_type: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  status: VehicleStatus;
  description: string | null;
  is_featured: boolean;
  acquired_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageRow = {
  id: number;
  storage_path: string | null;
  external_url: string | null;
  alt: string | null;
  position: number;
  width: number | null;
  height: number | null;
};

export type ProductRow = {
  id: string;
  sku: string;
  slug: string;
  title: string;
  description: string | null;
  condition: ProductCondition;
  condition_notes: string | null;
  status: ProductStatus;
  price: number;
  compare_at_price: number | null;
  currency: string;
  quantity: number;
  oem_part_number: string | null;
  interchange_numbers: string[];
  brand: string | null;
  placement: string | null;
  weight_lb: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  is_freight: boolean;
  category_id: number | null;
  donor_vehicle_id: number | null;
  item_specifics: Json;
  external_ids: Json;
  source: string;
  warranty_days: number;
  is_featured: boolean;
  listed_at: string | null;
  part_numbers_search: string | null;
  search_vector: unknown;
  seo_title: string | null;
  seo_description: string | null;
  deleted_at: string | null;
  image_count: number;
  created_at: string;
  updated_at: string;
};

export type ProductFitmentRow = {
  id: number;
  product_id: string;
  year: number;
  make_id: number;
  model_id: number | null;
  trim: string | null;
  engine: string | null;
  notes: string | null;
};

type LeadBase = { id: number; status: LeadStatus; created_at: string; updated_at: string; assigned_to: string | null; internal_notes: string | null };

export type SellCarRequestRow = LeadBase & {
  name: string;
  email: string;
  phone: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  mileage: number | null;
  pickup_location: string | null;
  asking_price: number | null;
  notes: string | null;
};

export type PartRequestRow = LeadBase & {
  product_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  part_name: string | null;
  part_number: string | null;
  offer_amount: number | null;
  message: string | null;
  order_id: string | null;
};

export type ReturnRequestRow = LeadBase & {
  order_id: string | null;
  order_number: string | null;
  invoice_number: string | null;
  name: string;
  email: string;
  phone: string | null;
  reason: string;
  description: string | null;
};

export type ContactMessageRow = LeadBase & {
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
};

export type UserRole = "customer" | "staff" | "admin";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  disabled_at: string | null;
  garage: Json | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterSubscriberRow = {
  id: number;
  email: string;
  source: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

type FacetValue = { slug: string; name: string; count: number };

export type SearchFacets = {
  categories: FacetValue[];
  makes: FacetValue[];
  conditions: { value: ProductCondition; count: number }[];
  price: { min: number; max: number };
};

export type SearchArgs = {
  p_query?: string | null;
  p_year?: number | null;
  p_make?: string | null;
  p_model?: string | null;
  p_category?: string | null;
  p_part_number?: string | null;
  p_condition?: string | null;
  p_min_price?: number | null;
  p_max_price?: number | null;
  p_in_stock?: boolean;
  p_vehicle?: string | null;
};

export const ORDER_STATUSES = ["new", "confirmed", "paid", "shipped", "completed", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderSource = "request" | "stripe" | "manual" | "lead";

export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string | null;
  email: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  discount_total: number;
  total: number;
  shipping_address: Json | null;
  billing_address: Json | null;
  shipping_method: string | null;
  tracking_number: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  placed_at: string | null;
  source: OrderSource;
  customer_name: string | null;
  phone: string | null;
  carrier: string | null;
  shipped_at: string | null;
  staff_notes: string | null;
  deleted_at: string | null;
  lead_id: number | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: number;
  order_id: string;
  product_id: string | null;
  sku: string;
  title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type OrderEventKind = "created" | "status" | "note" | "tracking" | "email" | "payment";

export type OrderEventRow = {
  id: number;
  order_id: string;
  kind: OrderEventKind;
  status: string | null;
  message: string | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  before: Json | null;
  after: Json | null;
  created_at: string;
};

export type SiteSettingRow = { key: string; value: Json; updated_by: string | null; updated_at: string };

export type JobStatus = "pending" | "running" | "completed" | "completed_with_errors" | "failed";

export type ImageJobRow = {
  id: string;
  kind: "copy_external";
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  errors: Json;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type ImportJobRow = {
  id: string;
  source: "ebay_active_listings" | "ebay_file_exchange" | "generic_csv";
  filename: string;
  status: JobStatus;
  options: Json;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type ImportRowRow = {
  id: number;
  job_id: string;
  row_number: number;
  raw: Json;
  status: "pending" | "created" | "updated" | "skipped" | "failed";
  product_id: string | null;
  error_message: string | null;
  warnings: string[];
  created_at: string;
};

/** Single-row precomputed aggregates (migration 0500), refreshed by refresh_catalog_summary(). */
export type CatalogSummaryRow = {
  id: number;
  category_counts: Json;
  facets: Json;
  stats: Json;
  refreshed_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, "id">;
      makes: TableDef<MakeRow, "name" | "slug">;
      models: TableDef<ModelRow, "make_id" | "name" | "slug", [
        { foreignKeyName: "models_make_id_fkey"; columns: ["make_id"]; isOneToOne: false; referencedRelation: "makes"; referencedColumns: ["id"] },
      ]>;
      categories: TableDef<CategoryRow, "name" | "slug", [
        { foreignKeyName: "categories_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] },
      ]>;
      donor_vehicles: TableDef<DonorVehicleRow, "stock_number" | "slug" | "year" | "make_id", [
        { foreignKeyName: "donor_vehicles_make_id_fkey"; columns: ["make_id"]; isOneToOne: false; referencedRelation: "makes"; referencedColumns: ["id"] },
        { foreignKeyName: "donor_vehicles_model_id_fkey"; columns: ["model_id"]; isOneToOne: false; referencedRelation: "models"; referencedColumns: ["id"] },
      ]>;
      donor_vehicle_images: TableDef<ImageRow & { vehicle_id: number }, "vehicle_id", [
        { foreignKeyName: "donor_vehicle_images_vehicle_id_fkey"; columns: ["vehicle_id"]; isOneToOne: false; referencedRelation: "donor_vehicles"; referencedColumns: ["id"] },
      ]>;
      products: TableDef<ProductRow, "sku" | "slug" | "title" | "price", [
        { foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] },
        { foreignKeyName: "products_donor_vehicle_id_fkey"; columns: ["donor_vehicle_id"]; isOneToOne: false; referencedRelation: "donor_vehicles"; referencedColumns: ["id"] },
      ]>;
      product_images: TableDef<ImageRow & { product_id: string; created_at: string }, "product_id", [
        { foreignKeyName: "product_images_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
      ]>;
      product_fitments: TableDef<ProductFitmentRow, "product_id" | "year" | "make_id", [
        { foreignKeyName: "product_fitments_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        { foreignKeyName: "product_fitments_make_id_fkey"; columns: ["make_id"]; isOneToOne: false; referencedRelation: "makes"; referencedColumns: ["id"] },
        { foreignKeyName: "product_fitments_model_id_fkey"; columns: ["model_id"]; isOneToOne: false; referencedRelation: "models"; referencedColumns: ["id"] },
      ]>;
      sell_car_requests: TableDef<SellCarRequestRow, "name" | "email">;
      part_requests: TableDef<PartRequestRow, "name" | "email">;
      return_requests: TableDef<ReturnRequestRow, "name" | "email" | "reason">;
      contact_messages: TableDef<ContactMessageRow, "name" | "email" | "message">;
      newsletter_subscribers: TableDef<NewsletterSubscriberRow, "email">;
      catalog_summary: TableDef<CatalogSummaryRow, never>;
      orders: TableDef<OrderRow, "email", [
        { foreignKeyName: "orders_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
      ]>;
      order_items: TableDef<Omit<OrderItemRow, "line_total"> & { line_total: number }, "order_id" | "sku" | "title" | "unit_price" | "quantity", [
        { foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
        { foreignKeyName: "order_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
      ]>;
      order_events: TableDef<OrderEventRow, "order_id" | "kind", [
        { foreignKeyName: "order_events_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
      ]>;
      audit_log: TableDef<AuditLogRow, "action" | "entity_type">;
      site_settings: TableDef<SiteSettingRow, "key">;
      image_jobs: TableDef<ImageJobRow, never>;
      import_jobs: TableDef<ImportJobRow, "source" | "filename">;
      import_rows: TableDef<ImportRowRow, "job_id" | "row_number" | "raw", [
        { foreignKeyName: "import_rows_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "import_jobs"; referencedColumns: ["id"] },
        { foreignKeyName: "import_rows_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
      ]>;
    };
    Views: { [_ in never]: never };
    Functions: {
      search_products: {
        Args: SearchArgs & { p_sort?: string };
        Returns: ProductRow[];
        SetofOptions: { from: "*"; to: "products"; isOneToOne: false; isSetofReturn: true };
      };
      search_facets: { Args: SearchArgs; Returns: Json };
      fitment_years: { Args: Record<string, never>; Returns: { year: number; product_count: number }[] };
      fitment_makes: { Args: { p_year?: number | null }; Returns: { slug: string; name: string; product_count: number }[] };
      fitment_models: {
        Args: { p_make: string; p_year?: number | null };
        Returns: { slug: string; name: string; product_count: number }[];
      };
      catalog_stats: { Args: Record<string, never>; Returns: Json };
      refresh_catalog_summary: { Args: Record<string, never>; Returns: string };
      check_form_rate_limit: { Args: { p_key: string; p_max?: number; p_window_seconds?: number }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      admin_dashboard: { Args: Record<string, never>; Returns: Json };
      admin_adjust_prices: { Args: { p_ids: string[]; p_percent: number }; Returns: number };
      log_admin_event: {
        Args: { p_action: string; p_entity_type: string; p_entity_id?: string | null; p_summary?: string | null; p_before?: Json | null; p_after?: Json | null };
        Returns: undefined;
      };
      create_order_request: {
        Args: { p_email: string; p_name: string; p_phone: string | null; p_postal_code: string | null; p_notes: string | null; p_items: Json };
        Returns: { o_id: string; o_number: string; o_subtotal: number; o_items: number }[];
      };
    };
    Enums: {
      product_condition: ProductCondition;
      product_status: ProductStatus;
      vehicle_status: VehicleStatus;
      lead_status: LeadStatus;
      user_role: UserRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
