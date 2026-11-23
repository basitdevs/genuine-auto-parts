import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, PRODUCT_STATUS_META, StatusBadge, TableSkeleton } from "@/components/admin/ui";
import { canAccess, requireArea } from "@/lib/admin/access";
import { ebayItemId } from "@/lib/admin/products";
import { imageUrl } from "@/lib/catalog/images";
import { loadEditorRefs } from "../editor-data";
import { ProductEditor, type EditorProduct } from "../product-editor";

export const metadata: Metadata = { title: "Edit product" };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

async function EditView({ params }: { params: PageProps<"/admin/products/[id]">["params"] }) {
  const { id } = await params;
  const session = await requireArea("products", `/admin/products/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = session;
  const [productRes, fitRes, imgRes, refs] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db.from("product_fitments").select("year, make_id, model_id, trim, engine, notes").eq("product_id", id).order("year"),
    db.from("product_images").select("id, storage_path, external_url, alt, position").eq("product_id", id).order("position"),
    loadEditorRefs(db),
  ]);
  const product = productRes.data as (typeof productRes.data & { seo_title?: string | null; seo_description?: string | null; deleted_at?: string | null }) | null;
  if (!product || product.deleted_at) notFound();

  const initial: EditorProduct = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    sku: product.sku,
    status: product.status,
    condition: product.condition,
    condition_notes: s(product.condition_notes),
    description: s(product.description),
    price: s(product.price),
    compare_at_price: s(product.compare_at_price),
    quantity: s(product.quantity),
    warranty_days: s(product.warranty_days),
    is_featured: product.is_featured,
    oem_part_number: s(product.oem_part_number),
    interchange_numbers: (product.interchange_numbers ?? []).join("\n"),
    brand: s(product.brand),
    placement: s(product.placement),
    category_id: s(product.category_id),
    donor_vehicle_id: s(product.donor_vehicle_id),
    weight_lb: s(product.weight_lb),
    length_in: s(product.length_in),
    width_in: s(product.width_in),
    height_in: s(product.height_in),
    is_freight: product.is_freight,
    seo_title: s(product.seo_title),
    seo_description: s(product.seo_description),
    fitments: (fitRes.data ?? []).map((f) => ({ year: s(f.year), make_id: s(f.make_id), model_id: s(f.model_id), trim: s(f.trim), engine: s(f.engine), notes: s(f.notes) })),
  };
  const meta = PRODUCT_STATUS_META[product.status];
  const ebay = ebayItemId(product.external_ids);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={<span className="line-clamp-2">{product.title}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={meta?.tone}>{meta?.label}</StatusBadge>
            <span className="font-mono">{product.sku}</span>
            {ebay ? <span>· eBay #{ebay}</span> : null}
            <span>· source: {product.source}</span>
          </span>
        }
      />
      <ProductEditor
        initial={initial}
        categories={refs.categories}
        makes={refs.makes}
        models={refs.models}
        vehicles={refs.vehicles}
        images={(imgRes.data ?? []).map((i) => ({ id: i.id, src: imageUrl(i), alt: i.alt ?? "" }))}
        canDelete={canAccess(session.role, "settings")}
        storeUrl={product.status === "active" || product.status === "sold" ? `/parts/${product.slug}` : null}
      />
    </>
  );
}

export default function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <EditView params={props.params} />
    </Suspense>
  );
}
