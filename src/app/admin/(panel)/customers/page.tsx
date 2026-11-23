import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterSelect, SearchInput } from "@/components/admin/client";
import { dateOnly, EmptyRow, ErrorNotice, PageHeader, Pager, StatusBadge, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";
import { requireArea } from "@/lib/admin/access";
import { pageNumber, sanitizeSearch, str } from "@/lib/admin/db";

export const metadata: Metadata = { title: "Customers" };
const PAGE_SIZE = 25;

async function CustomersView({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  const { db } = await requireArea("customers", "/admin/customers");
  const params = await searchParams;
  const role = ["customer", "staff", "admin"].includes(String(params.role)) ? (String(params.role) as "customer") : undefined;
  const q = sanitizeSearch(str(params.q) ?? "");
  const page = pageNumber(params.page);

  let query = db.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (role) query = query.eq("role", role);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data, error, count } = await query;
  if (error) return <ErrorNotice message={error.message} />;

  const ids = (data ?? []).map((p) => p.id);
  const { data: orders } = ids.length ? await db.from("orders").select("customer_id").in("customer_id", ids) : { data: [] };
  const orderCount = new Map<string, number>();
  for (const o of orders ?? []) if (o.customer_id) orderCount.set(o.customer_id, (orderCount.get(o.customer_id) ?? 0) + 1);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Name, email or phone…" />
        <FilterSelect param="role" label="All roles" options={[{ value: "customer", label: "Customers" }, { value: "staff", label: "Staff" }, { value: "admin", label: "Admins" }]} />
      </div>
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th className="text-right">Orders</Th>
            <Th>Joined</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((p) => {
            const disabled = Boolean((p as { disabled_at?: string | null }).disabled_at);
            return (
              <tr key={p.id} className="hover:bg-muted/40">
                <Td><Link href={`/admin/customers/${p.id}`} className="font-medium hover:text-primary">{p.full_name || "—"}</Link></Td>
                <Td><Link href={`/admin/customers/${p.id}`} className="hover:text-primary">{p.email}</Link></Td>
                <Td className="text-muted-foreground">{p.phone ?? "—"}</Td>
                <Td className="text-right tabular-nums">{orderCount.get(p.id) ?? 0}</Td>
                <Td className="text-muted-foreground">{dateOnly.format(new Date(p.created_at))}</Td>
                <Td className="space-x-1">
                  {p.role !== "customer" ? <StatusBadge tone="dark">{p.role}</StatusBadge> : null}
                  {disabled ? <StatusBadge tone="warning">Disabled</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
                </Td>
              </tr>
            );
          })}
          {(data ?? []).length === 0 ? <EmptyRow colSpan={6}>{q || role ? "No accounts match these filters." : "No customer accounts yet. Customers who sign up on the site appear here."}</EmptyRow> : null}
        </tbody>
      </Table>
      <Pager basePath="/admin/customers" params={{ role, q: q || undefined }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </>
  );
}

export default function CustomersPage(props: PageProps<"/admin/customers">) {
  return (
    <>
      <PageHeader title="Customers" description="Accounts created on the site. Guest order requests are linked by email on each customer page." />
      <Suspense fallback={<TableSkeleton />}>
        <CustomersView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
