import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { ErrorNotice, PageHeader, Pager, TableSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { canAccess, requireArea } from "@/lib/admin/access";
import { isMissingSchema, pageNumber } from "@/lib/admin/db";
import { buildProductQuery, ebayItemId, filtersToParams, loadCatalogRefs, parseProductFilters } from "@/lib/admin/products";
import { imageUrl } from "@/lib/catalog/images";
import { ProductFilters } from "./product-filters";
import { ProductsTable, type ProductRowData } from "./products-table";

export const metadata: Metadata = { title: "Products" };
const PAGE_SIZE = 50;
const SELECT = "id, sku, slug, title, price, quantity, status, condition, oem_part_number, external_ids, updated_at, category_id, product_images(storage_path, external_url, alt, position)";

async function ProductsView({ searchParams }: { searchParams: PageProps<"/admin/products">["searchParams"] }) {
  const session = await requireArea("products", "/admin/products");
  const { db } = session;
  const params = await searchParams;
  const filters = parseProductFilters(params);
  const page = pageNumber(params.page, 1000);
  const refs = await loadCatalogRefs(db);

  let legacy = false;
  let res = await buildProductQuery(db, filters, SELECT, { categories: refs.categories, count: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (res.error && isMissingSchema(res.error)) {
    legacy = true;
    res = await buildProductQuery(db, filters, SELECT, { categories: refs.categories, count: true, legacy }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  }
  if (res.error) return <ErrorNotice message={res.error.message} />;

  const catName = new Map(refs.categories.map((c) => [c.id, c.name]));
  const rows: ProductRowData[] = ((res.data ?? []) as unknown as Record<string, unknown>[]).map((p) => {
    const images = ((p.product_images as { storage_path: string | null; external_url: string | null; alt: string | null; position: number }[] | null) ?? []).sort((a, b) => a.position - b.position);
    return {
      id: String(p.id),
      sku: String(p.sku),
      slug: String(p.slug),
      title: String(p.title),
      price: Number(p.price),
      quantity: Number(p.quantity),
      status: p.status as ProductRowData["status"],
      condition: String(p.condition),
      oem: (p.oem_part_number as string | null) ?? null,
      ebayItemId: ebayItemId(p.external_ids),
      category: p.category_id ? (catName.get(Number(p.category_id)) ?? null) : null,
      thumb: images[0] ? imageUrl(images[0]) : null,
      photoCount: images.length,
    };
  });
  const exportQs = new URLSearchParams(Object.entries(filtersToParams(filters)).filter((e): e is [string, string] => Boolean(e[1]))).toString();

  return (
    <>
      <ProductFilters categories={refs.categories} makes={refs.makes} models={refs.models} legacy={legacy} />
      <div className="mb-2 flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <a href={`/admin/api/products/export${exportQs ? `?${exportQs}` : ""}`}><Download aria-hidden /> Export CSV ({(res.count ?? 0).toLocaleString()})</a>
        </Button>
      </div>
      <ProductsTable rows={rows} categories={refs.categories.filter((c) => c.parent_id === null).map((c) => ({ id: c.id, name: c.name }))} canDelete={canAccess(session.role, "settings")} />
      <Pager basePath="/admin/products" params={filtersToParams(filters)} page={page} pageSize={PAGE_SIZE} total={res.count ?? 0} />
    </>
  );
}

export default function AdminProductsPage(props: PageProps<"/admin/products">) {
  return (
    <>
      <PageHeader
        title="Products"
        description="Search, filter and edit the catalog. Changes go live on the storefront immediately."
        actions={
          <Button asChild>
            <Link href="/admin/products/new"><Plus aria-hidden /> New product</Link>
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <ProductsView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
