import { Suspense } from "react";
import type { Metadata } from "next";
import { FilterSelect, SearchInput } from "@/components/admin/client";
import { EmptyRow, ErrorNotice, fmtDate, MigrationNotice, PageHeader, Pager, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";
import { requireArea } from "@/lib/admin/access";
import { isMissingSchema, pageNumber, sanitizeSearch, str } from "@/lib/admin/db";
import { DateRange } from "./date-range";

export const metadata: Metadata = { title: "Activity Log" };
const PAGE_SIZE = 50;
const ENTITIES = ["products", "orders", "donor_vehicles", "part_requests", "sell_car_requests", "return_requests", "contact_messages", "profiles", "site_settings", "categories", "import_jobs"];
const ACTIONS = ["insert", "update", "delete"];
const LINKS: Record<string, (id: string) => string> = {
  products: (id) => `/admin/products/${id}`,
  orders: (id) => `/admin/orders/${id}`,
  donor_vehicles: (id) => `/admin/vehicles/${id}`,
  profiles: (id) => `/admin/customers/${id}`,
  part_requests: (id) => `/admin/leads/part/${id}`,
  sell_car_requests: (id) => `/admin/leads/sell_car/${id}`,
  return_requests: (id) => `/admin/leads/return/${id}`,
  contact_messages: (id) => `/admin/leads/contact/${id}`,
  import_jobs: (id) => `/admin/imports/${id}`,
};

function Changes({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].slice(0, 30);
  if (!keys.length) return null;
  const show = (v: unknown) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s === undefined ? "—" : s.length > 160 ? `${s.slice(0, 160)}…` : s;
  };
  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{keys.length} field{keys.length === 1 ? "" : "s"}</summary>
      <table className="mt-2 w-full text-xs">
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="align-top">
              <td className="py-0.5 pr-3 font-mono font-semibold whitespace-nowrap">{k}</td>
              <td className="py-0.5 pr-3 break-all text-red-700 line-through decoration-red-300">{before && k in before ? show(before[k]) : ""}</td>
              <td className="py-0.5 break-all text-emerald-800">{after && k in after ? show(after[k]) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

async function ActivityView({ searchParams }: { searchParams: PageProps<"/admin/activity">["searchParams"] }) {
  const { db } = await requireArea("activity", "/admin/activity");
  const params = await searchParams;
  const entity = ENTITIES.includes(String(params.entity)) ? String(params.entity) : undefined;
  const action = str(params.action);
  const actor = sanitizeSearch(str(params.q) ?? "");
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(params.from)) ? String(params.from) : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(params.to)) ? String(params.to) : undefined;
  const page = pageNumber(params.page, 500);

  let query = db.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) query = query.eq("entity_type", entity);
  if (action && /^[a-z_.]{2,40}$/.test(action)) query = ACTIONS.includes(action) ? query.eq("action", action) : query.like("action", `${action}%`);
  if (actor) query = query.or(`actor_email.ilike.%${actor}%,entity_id.eq.${actor.replace(/\s/g, "")},summary.ilike.%${actor}%`);
  if (from) query = query.gte("created_at", `${from}T00:00:00-07:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59-07:00`);
  const { data, error, count } = await query;
  if (error && isMissingSchema(error)) return <MigrationNotice what="the activity log" />;
  if (error) return <ErrorNotice message={error.message} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Person, record ID or text…" />
        <FilterSelect param="entity" label="All areas" options={ENTITIES.map((e) => ({ value: e, label: e.replace(/_/g, " ") }))} />
        <FilterSelect param="action" label="All actions" options={[...ACTIONS.map((a) => ({ value: a, label: a })), { value: "product.", label: "product (bulk)" }, { value: "order.", label: "order" }, { value: "import.", label: "import" }, { value: "customer.", label: "customer" }, { value: "staff.", label: "staff" }]} />
        <DateRange />
      </div>
      <Table minWidth={900}>
        <thead>
          <tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Record</Th><Th>Details</Th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((a) => {
            const link = a.entity_id && LINKS[a.entity_type]?.(a.entity_id);
            return (
              <tr key={a.id} className="align-top">
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(a.created_at)}</Td>
                <Td className="max-w-48 truncate">{a.actor_email ?? "System"}</Td>
                <Td><span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px]">{a.action}</span></Td>
                <Td className="text-xs">
                  <span className="text-muted-foreground">{a.entity_type.replace(/_/g, " ")}</span>
                  {a.entity_id ? <>{" "}{link ? <a href={link} className="font-mono hover:text-primary">{a.entity_id.slice(0, 8)}</a> : <span className="font-mono">{a.entity_id.slice(0, 8)}</span>}</> : null}
                </Td>
                <Td className="max-w-md">
                  {a.summary ? <p className="mb-1 text-sm">{a.summary}</p> : null}
                  <Changes before={a.before as Record<string, unknown> | null} after={a.after as Record<string, unknown> | null} />
                </Td>
              </tr>
            );
          })}
          {(data ?? []).length === 0 ? <EmptyRow colSpan={5}>No activity matches these filters.</EmptyRow> : null}
        </tbody>
      </Table>
      <Pager basePath="/admin/activity" params={{ entity, action, q: actor || undefined, from, to }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </>
  );
}

export default function ActivityPage(props: PageProps<"/admin/activity">) {
  return (
    <>
      <PageHeader title="Activity Log" description="Every admin change: who, what, when, with before and after values. Imports are summarised as one entry each." />
      <Suspense fallback={<TableSkeleton />}>
        <ActivityView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
