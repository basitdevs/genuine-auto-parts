import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterSelect, FilterTabs, SearchInput } from "@/components/admin/client";
import { EmptyRow, ErrorNotice, fmtDate, MigrationNotice, ORDER_STATUS_META, PageHeader, Pager, StatusBadge, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";
import { requireArea } from "@/lib/admin/access";
import { isMissingSchema, pageNumber, sanitizeSearch, str } from "@/lib/admin/db";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Orders" };
const PAGE_SIZE = 25;
const SOURCES = [
  { value: "request", label: "Website request" },
  { value: "stripe", label: "Online payment" },
  { value: "manual", label: "Manual" },
  { value: "lead", label: "From a lead" },
];

async function OrdersView({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const { db } = await requireArea("orders", "/admin/orders");
  const params = await searchParams;
  const status = ORDER_STATUSES.includes(params.status as OrderStatus) ? (params.status as OrderStatus) : undefined;
  const source = SOURCES.some((s) => s.value === params.source) ? (params.source as string) : undefined;
  const q = sanitizeSearch(str(params.q) ?? "");
  const page = pageNumber(params.page);

  let query = db
    .from("orders")
    .select("id, order_number, customer_name, email, status, source, total, created_at, order_items(count)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source as "request");
  if (q) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%,customer_name.ilike.%${q}%,phone.ilike.%${q}%`);

  const [{ data, error, count }, counts] = await Promise.all([
    query,
    Promise.all(ORDER_STATUSES.map(async (s) => [s, (await db.from("orders").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", s)).count ?? 0] as const)),
  ]);

  if (error && isMissingSchema(error)) return <MigrationNotice what="orders" />;
  if (error) return <ErrorNotice message={error.message} />;
  const total = counts.reduce((n, [, c]) => n + c, 0);

  return (
    <>
      <FilterTabs
        param="status"
        tabs={[{ value: "", label: "All", count: total }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_META[s].label, count: counts.find(([k]) => k === s)?.[1] ?? 0 }))]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Order #, email, name or phone…" />
        <FilterSelect param="source" label="All sources" options={SOURCES} />
      </div>
      <Table minWidth={820}>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Date</Th>
            <Th>Customer</Th>
            <Th className="text-right">Items</Th>
            <Th className="text-right">Total</Th>
            <Th>Status</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((o) => {
            const items = (o.order_items as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <tr key={o.id} className="hover:bg-muted/40">
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-bold hover:text-primary">{o.order_number}</Link>
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(o.created_at)}</Td>
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="block max-w-64 truncate font-medium hover:text-primary">{o.customer_name ?? o.email}</Link>
                  {o.customer_name ? <span className="block max-w-64 truncate text-xs text-muted-foreground">{o.email}</span> : null}
                </Td>
                <Td className="text-right tabular-nums">{items}</Td>
                <Td className="text-right font-semibold tabular-nums">{formatPrice(Number(o.total))}</Td>
                <Td><StatusBadge tone={ORDER_STATUS_META[o.status]?.tone}>{ORDER_STATUS_META[o.status]?.label ?? o.status}</StatusBadge></Td>
                <Td className="text-xs text-muted-foreground">{SOURCES.find((s) => s.value === o.source)?.label ?? o.source}</Td>
              </tr>
            );
          })}
          {(data ?? []).length === 0 ? <EmptyRow colSpan={7}>{q || status || source ? "No orders match these filters." : "No orders yet. Order requests from the cart appear here."}</EmptyRow> : null}
        </tbody>
      </Table>
      <Pager basePath="/admin/orders" params={{ status, source, q: q || undefined }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </>
  );
}

export default function OrdersPage(props: PageProps<"/admin/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="Website order requests now, online payments later. Same list, same workflow." />
      <Suspense fallback={<TableSkeleton />}>
        <OrdersView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
