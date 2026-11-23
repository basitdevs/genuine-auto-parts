import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { EmptyRow, fmtDate, MigrationNotice, PageHeader, Panel, StatusBadge, Table, TableSkeleton, Td, Th, type BadgeTone } from "@/components/admin/ui";
import { requireArea } from "@/lib/admin/access";
import { isMissingSchema } from "@/lib/admin/db";
import { CsvImporter } from "./csv-importer";
import { ImageJobRunner } from "./image-job-runner";

export const metadata: Metadata = { title: "Imports & Images" };

const JOB_TONE: Record<string, BadgeTone> = { completed: "success", completed_with_errors: "warning", failed: "danger", running: "info", pending: "neutral" };
const label = (s: string) => s.replace(/_/g, " ");

async function ImportsBody() {
  const { db } = await requireArea("imports", "/admin/imports");
  const [jobs, imageJobs, pendingImages, noPhotos] = await Promise.all([
    db.from("import_jobs").select("id, filename, status, total_rows, created_count, updated_count, failed_count, created_at, finished_at").order("created_at", { ascending: false }).limit(25),
    db.from("image_jobs").select("id, status, total, done, failed, created_at, finished_at").order("created_at", { ascending: false }).limit(10),
    db.from("product_images").select("id", { count: "exact", head: true }).is("storage_path", null).not("external_url", "is", null),
    db.from("products").select("id", { count: "exact", head: true }).eq("status", "active").eq("image_count", 0),
  ]);

  return (
    <div className="grid gap-6">
      <Panel title="Import eBay CSV">
        <CsvImporter />
      </Panel>
      <Panel title="Import history" bodyClassName="p-0">
        <Table minWidth={760}>
          <thead>
            <tr><Th>Started</Th><Th>File</Th><Th>Status</Th><Th className="text-right">Rows</Th><Th className="text-right">Created</Th><Th className="text-right">Updated</Th><Th className="text-right">Failed</Th><Th /></tr>
          </thead>
          <tbody>
            {(jobs.data ?? []).map((j) => (
              <tr key={j.id} className="hover:bg-muted/40">
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(j.created_at)}</Td>
                <Td><Link href={`/admin/imports/${j.id}`} className="font-medium hover:text-primary">{j.filename}</Link></Td>
                <Td><StatusBadge tone={JOB_TONE[j.status]}>{label(j.status)}</StatusBadge></Td>
                <Td className="text-right tabular-nums">{j.total_rows.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{j.created_count.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{j.updated_count.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{j.failed_count ? <span className="font-semibold text-destructive">{j.failed_count}</span> : 0}</Td>
                <Td className="text-right">
                  <a href={`/admin/api/imports/${j.id}/warnings`} className="inline-flex items-center gap-1 text-xs font-semibold hover:text-primary"><Download className="size-3.5" aria-hidden /> Warnings</a>
                </Td>
              </tr>
            ))}
            {(jobs.data ?? []).length === 0 ? <EmptyRow colSpan={8}>No imports yet.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>

      <section id="images">
        <Panel
          title="Images"
          description="Copies marketplace photo URLs into Supabase Storage so they load fast and survive eBay listing changes."
          actions={<ImageJobRunner label={(imageJobs.data ?? []).some((j) => j.status !== "completed") ? "Re-run image job" : "Run image job"} />}
        >
          {isMissingSchema(imageJobs.error) ? <MigrationNotice what="image jobs" /> : (
            <>
              <dl className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Photos waiting to be copied</dt><dd className="font-display text-2xl font-bold">{(pendingImages.count ?? 0).toLocaleString()}</dd></div>
                <div className="rounded-md bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Active products without any photo</dt><dd className="font-display text-2xl font-bold">{(noPhotos.count ?? 0).toLocaleString()}</dd></div>
              </dl>
              <p className="mb-3 text-xs text-muted-foreground">
                The current eBay export has no photo URLs. Photos can be uploaded per product, or come in with a File Exchange / eBay API import (see PLAN.md §7).
              </p>
              <ul className="divide-y rounded-md border">
                {(imageJobs.data ?? []).map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">{fmtDate(j.created_at)}</span>
                    <StatusBadge tone={JOB_TONE[j.status]}>{label(j.status)}</StatusBadge>
                    <span className="ml-auto tabular-nums">{j.done} copied · {j.failed} failed · {j.total} total</span>
                  </li>
                ))}
                {(imageJobs.data ?? []).length === 0 ? <li className="px-4 py-4 text-sm text-muted-foreground">No image jobs yet.</li> : null}
              </ul>
            </>
          )}
        </Panel>
      </section>
    </div>
  );
}

export default function ImportsPage() {
  return (
    <>
      <PageHeader title="Imports & Images" description="Bring eBay listings into the catalog and keep product photos in our own storage." />
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <ImportsBody />
      </Suspense>
    </>
  );
}
