import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterSelect, FilterTabs, SearchInput } from "@/components/admin/client";
import { EmptyRow, ErrorNotice, fmtDate, LEAD_STATUS_META, PageHeader, Pager, StatusBadge, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";
import { requireArea } from "@/lib/admin/access";
import { pageNumber, sanitizeSearch, str } from "@/lib/admin/db";
import { listLeads, loadStaff } from "@/lib/admin/lead-data";
import { LEAD_TABLES, LEAD_TYPE_LABELS, type LeadType } from "@/lib/admin/leads";
import { LeadStatusSelect } from "./lead-status-select";

export const metadata: Metadata = { title: "Leads" };
const PAGE_SIZE = 25;
const TYPES = Object.keys(LEAD_TABLES) as LeadType[];

async function LeadsView({ searchParams }: { searchParams: PageProps<"/admin/leads">["searchParams"] }) {
  const { db } = await requireArea("leads", "/admin/leads");
  const params = await searchParams;
  const type = TYPES.includes(params.type as LeadType) ? (params.type as LeadType) : undefined;
  const status = ["new", "in_progress", "closed", "spam"].includes(String(params.status)) ? String(params.status) : undefined;
  const assignee = str(params.assignee);
  const q = sanitizeSearch(str(params.q) ?? "");
  const page = pageNumber(params.page, 200);

  const [staff, list] = await Promise.all([
    loadStaff(db),
    listLeads(db, { types: type ? [type] : TYPES, status, assignee: assignee === "unassigned" || /^[0-9a-f-]{36}$/.test(assignee ?? "") ? assignee : undefined, q: q || undefined }, page, PAGE_SIZE),
  ]);
  // Before migration 0600 there is no assigned_to column: fall back without that filter.
  const staffName = new Map(staff.map((s) => [s.id, s.label]));

  return (
    <>
      <FilterTabs param="type" tabs={[{ value: "", label: "All types" }, ...TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABELS[t] }))]} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Name, email or phone…" />
        <FilterSelect param="status" label="Any status" options={Object.entries(LEAD_STATUS_META).map(([value, m]) => ({ value, label: m.label }))} />
        <FilterSelect param="assignee" label="Anyone" options={[{ value: "unassigned", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.label }))]} />
      </div>
      {list.error ? <div className="mb-3"><ErrorNotice message={list.error.message} /></div> : null}
      <Table minWidth={860}>
        <thead>
          <tr>
            <Th>Received</Th>
            <Th>Type</Th>
            <Th>From</Th>
            <Th>Summary</Th>
            <Th>Assigned</Th>
            <Th className="w-40">Status</Th>
          </tr>
        </thead>
        <tbody>
          {list.rows.map((l) => (
            <tr key={`${l.type}-${l.id}`} className="hover:bg-muted/40">
              <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</Td>
              <Td className="whitespace-nowrap text-xs font-semibold">{LEAD_TYPE_LABELS[l.type]}</Td>
              <Td>
                <Link href={`/admin/leads/${l.type}/${l.id}`} className="block max-w-56 truncate font-medium hover:text-primary">{l.name}</Link>
                <span className="block max-w-56 truncate text-xs text-muted-foreground">{l.email}</span>
              </Td>
              <Td><Link href={`/admin/leads/${l.type}/${l.id}`} className="line-clamp-1 max-w-80 hover:text-primary">{l.summary}</Link></Td>
              <Td className="text-xs text-muted-foreground">{l.assignedTo ? (staffName.get(l.assignedTo) ?? "Staff") : "—"}</Td>
              <Td><LeadStatusSelect type={l.type} id={l.id} status={l.status} /></Td>
            </tr>
          ))}
          {list.rows.length === 0 ? <EmptyRow colSpan={6}>{q || status || type ? "No leads match these filters." : "No leads yet. Form submissions from the site appear here."}</EmptyRow> : null}
        </tbody>
      </Table>
      <Pager basePath="/admin/leads" params={{ type, status, assignee, q: q || undefined }} page={page} pageSize={PAGE_SIZE} total={list.total} />
      <p className="mt-2 text-xs text-muted-foreground">Status legend: {Object.values(LEAD_STATUS_META).map((m) => m.label).join(" · ")}. <StatusBadge tone="primary">New</StatusBadge> leads older than 24h show on the dashboard.</p>
    </>
  );
}

export default function AdminLeadsPage(props: PageProps<"/admin/leads">) {
  return (
    <>
      <PageHeader title="Leads" description="Part requests & offers, sell-your-car, returns and contact messages." />
      <Suspense fallback={<TableSkeleton />}>
        <LeadsView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
