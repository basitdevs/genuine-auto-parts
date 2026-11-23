import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, TableSkeleton } from "@/components/admin/ui";
import { canAccess, requireArea } from "@/lib/admin/access";
import { loadEditorRefs } from "../editor-data";
import { ProductEditor, type EditorProduct } from "../product-editor";

export const metadata: Metadata = { title: "New product" };

const EMPTY: EditorProduct = {
  title: "",
  slug: "",
  sku: "",
  status: "draft",
  condition: "used",
  condition_notes: "",
  description: "",
  price: "",
  compare_at_price: "",
  quantity: "1",
  warranty_days: "90",
  is_featured: false,
  oem_part_number: "",
  interchange_numbers: "",
  brand: "",
  placement: "",
  category_id: "",
  donor_vehicle_id: "",
  weight_lb: "",
  length_in: "",
  width_in: "",
  height_in: "",
  is_freight: false,
  seo_title: "",
  seo_description: "",
  fitments: [],
};

async function NewView() {
  const session = await requireArea("products", "/admin/products/new");
  const refs = await loadEditorRefs(session.db);
  return (
    <ProductEditor
      initial={EMPTY}
      categories={refs.categories}
      makes={refs.makes}
      models={refs.models}
      vehicles={refs.vehicles}
      images={[]}
      canDelete={canAccess(session.role, "settings")}
      storeUrl={null}
    />
  );
}

export default function NewProductPage() {
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: "Products" }} title="New product" description="Starts as a draft. Set it to Active when it's ready to sell." />
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <NewView />
      </Suspense>
    </>
  );
}
