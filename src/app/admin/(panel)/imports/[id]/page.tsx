import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { FilterTabs } from "@/components/admin/client";
import { DefinitionList, EmptyRow, fmtDate, PageHeader, Pager, Panel, StatusBadge, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/admin/access";
import { pageNumber } from "@/lib/admin/db";

export const metadata: Metadata = { title: "Import" };
const PAGE_SIZE = 50;

async function JobView({ params, searchParams }: { params: PageProps<"/admin/imports/[id]">["params"]; searchParams: PageProps<"/admin/imports/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { db } = await requireArea("imports", `/admin/imports/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const view = sp.view === "warnings" ? "warnings" : "errors";
  const page = pageNumber(sp.page, 500);

  const { data: job } = await db.from("import_jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  let rows = db.from("import_rows").select("row_number, status, error_message, warnings, raw, product_id", { count: "exact" }).eq("job_id", id).order("row_number").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  rows = view === "errors" ? rows.eq("status", "failed") : rows.not("warnings", "eq", "{}");
  const [list, warnCount] = await Promise.all([rows, db.from("import_rows").select("id", { count: "exact", head: true }).eq("job_id", id).not("warnings", "eq", "{}")]);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/imports", label: "Imports" }}
        title={job.filename}
        description={`Started ${fmtDate(job.started_at ?? job.created_at)}${job.finished_at ? ` · finished ${fmtDate(job.finished_at)}` : ""}`}
        actions={<Button asChild variant="outline" size="sm"><a href={`/admin/api/imports/${job.id}/warnings`}><Download aria-hidden /> Warnings CSV</a></Button>}
      />
      <Panel title="Summary" className="mb-6">
        <DefinitionList
          items={[
            ["Status", <StatusBadge key="s" tone={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}>{job.status.replace(/_/g, " ")}</StatusBadge>],
            ["Rows", job.total_rows.toLocaleString()],
            ["Created", job.created_count.toLocaleString()],
            ["Updated", job.updated_count.toLocaleString()],
            ["Failed", job.failed_count.toLocaleString()],
            ["Rows with warnings", (warnCount.count ?? 0).toLocaleString()],
            ["Source", job.source.replace(/_/g, " ")],
          ]}
        />
      </Panel>
      <FilterTabs param="view" tabs={[{ value: "", label: "Row errors", count: job.failed_count }, { value: "warnings", label: "Warnings", count: warnCount.count ?? 0 }]} />
      <Table minWidth={760}>
        <thead>
          <tr><Th>Line</Th><Th>eBay item</Th><Th>Title</Th><Th>{view === "errors" ? "Error" : "Warnings"}</Th></tr>
        </thead>
        <tbody>
          {(list.data ?? []).map((r) => {
            const raw = (r.raw ?? {}) as Record<string, string>;
            return (
              <tr key={r.row_number}>
                <Td className="font-mono text-xs">{r.row_number}</Td>
                <Td className="font-mono text-xs">{raw["Item number"] ?? "—"}</Td>
                <Td className="max-w-80">
                  {r.product_id ? <Link href={`/admin/products/${r.product_id}`} className="line-clamp-1 hover:text-primary">{raw.Title}</Link> : <span className="line-clamp-1">{raw.Title}</span>}
                </Td>
                <Td className="text-xs">{view === "errors" ? <span className="text-destructive">{r.error_message}</span> : r.warnings.join("; ")}</Td>
              </tr>
            );
          })}
          {(list.data ?? []).length === 0 ? <EmptyRow colSpan={4}>{view === "errors" ? "No row errors. Every row was imported." : "No parser warnings."}</EmptyRow> : null}
        </tbody>
      </Table>
      <Pager basePath={`/admin/imports/${id}`} params={{ view: view === "warnings" ? "warnings" : undefined }} page={page} pageSize={PAGE_SIZE} total={list.count ?? 0} />
    </>
  );
}

export default function ImportJobPage(props: PageProps<"/admin/imports/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <JobView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
