"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { finishImport, importBatch, startImport } from "./actions";

type Preview = {
  filename: string;
  rows: { rowNumber: number; raw: Record<string, string> }[];
  valid: number;
  invalid: { rowNumber: number; error: string }[];
  stats: { years: number; make: number; model: number; pn: number };
  sample: { sku: string; title: string; price: number; vehicle: string; group: string; warnings: string[] }[];
  groups: [string, number][];
  skus: string[];
};

const BATCH = 200;

/**
 * eBay "Active listings" CSV import from the browser:
 *   1. Dry run: parsed + validated here with the same mapping as the CLI importer (nothing is written).
 *   2. Commit: rows are sent in batches of 200; the server re-validates each batch and upserts it.
 */
export function CsvImporter() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [markMissingSold, setMarkMissingSold] = useState(false);
  const [progress, setProgress] = useState<{ done: number; created: number; updated: number; failed: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyse(file: File) {
    setError(null);
    setPreview(null);
    setProgress(null);
    if (!/\.csv$/i.test(file.name)) return setError("Choose a .csv file exported from eBay Seller Hub.");
    if (file.size > 40 * 1024 * 1024) return setError("That file is over 40 MB.");
    setParsing(true);
    try {
      const [{ default: Papa }, mapping] = await Promise.all([import("papaparse"), import("@/lib/import/ebay-mapping")]);
      const text = (await file.text()).replace(/^﻿/, "");
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const format = mapping.detectEbayFormat(parsed.meta.fields ?? []);
      if (format !== "ebay_active_listings") {
        setError(format === "ebay_file_exchange" ? "This is a File Exchange export. Only the Seller Hub “All active listings” report is supported right now." : "Unrecognised CSV. Export Seller Hub → Reports → “All active listings”.");
        return;
      }
      const rows = parsed.data.map((raw, i) => ({ rowNumber: i + 2, raw }));
      const invalid: Preview["invalid"] = [];
      const products = [];
      for (const r of rows) {
        const check = mapping.activeListingRowSchema.safeParse(r.raw);
        if (!check.success) invalid.push({ rowNumber: r.rowNumber, error: check.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        else products.push(mapping.mapActiveListingRow(check.data));
      }
      const groups = new Map<string, number>();
      for (const p of products) groups.set(p.category.groupSlug, (groups.get(p.category.groupSlug) ?? 0) + 1);
      setPreview({
        filename: file.name,
        rows,
        valid: products.length,
        invalid,
        stats: {
          years: products.filter((p) => p.fitment.years.length).length,
          make: products.filter((p) => p.fitment.makeSlug).length,
          model: products.filter((p) => p.fitment.modelSlug).length,
          pn: products.filter((p) => p.oemPartNumber).length,
        },
        sample: products.slice(0, 12).map((p) => ({
          sku: p.sku,
          title: p.title,
          price: p.price,
          vehicle: [p.fitment.years.length ? `${p.fitment.years[0]}–${p.fitment.years.at(-1)}` : "", p.fitment.makeSlug ?? "", p.fitment.modelSlug ?? ""].filter(Boolean).join(" "),
          group: p.category.groupSlug,
          warnings: p.fitment.warnings,
        })),
        groups: [...groups].sort((a, b) => b[1] - a[1]),
        skus: products.map((p) => p.sku),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setParsing(false);
    }
  }

  async function commit() {
    if (!preview) return;
    setRunning(true);
    stopRef.current = false;
    const start = await startImport({ filename: preview.filename, totalRows: preview.rows.length, markMissingSold });
    if (!start.ok || !start.data) {
      setRunning(false);
      return void toast.error(start.message);
    }
    const jobId = start.data.jobId;
    const totals = { done: 0, created: 0, updated: 0, failed: 0 };
    setProgress({ ...totals });
    let aborted = false;
    for (let i = 0; i < preview.rows.length; i += BATCH) {
      if (stopRef.current) {
        aborted = true;
        break;
      }
      const batch = preview.rows.slice(i, i + BATCH);
      let r = await importBatch({ jobId, rows: batch });
      if (!r.ok) r = await importBatch({ jobId, rows: batch }); // one retry (upserts are idempotent)
      if (!r.ok || !r.data) {
        toast.error(`Batch at row ${batch[0].rowNumber} failed: ${r.message}`);
        aborted = true;
        break;
      }
      totals.done += batch.length;
      totals.created += r.data.created;
      totals.updated += r.data.updated;
      totals.failed += r.data.failed;
      setProgress({ ...totals });
    }
    const fin = await finishImport({ jobId, markMissingSold, seenSkus: preview.skus, aborted });
    setRunning(false);
    if (fin.ok) toast.success(`${fin.message}: ${totals.created} created, ${totals.updated} updated, ${totals.failed} failed${fin.data?.markedSold ? `, ${fin.data.markedSold} marked sold` : ""}`);
    else toast.error(fin.message);
    router.push(`/admin/imports/${jobId}`);
  }

  const pct = (n: number) => `${((n / Math.max(preview?.valid ?? 1, 1)) * 100).toFixed(0)}%`;

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void analyse(f);
        }}
        className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed bg-background px-6 py-8 text-center"
      >
        <FileUp className="size-7 text-primary" aria-hidden />
        <div>
          <p className="font-semibold">Drop an eBay “All active listings” CSV here</p>
          <p className="text-sm text-muted-foreground">Seller Hub → Reports → Downloads. Nothing is saved until you press Import.</p>
        </div>
        <Button type="button" variant="outline" disabled={parsing || running} onClick={() => fileRef.current?.click()}>
          {parsing ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />} {parsing ? "Checking rows…" : "Choose file"}
        </Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && analyse(e.target.files[0])} aria-label="CSV file" />
      </div>

      {error ? <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="size-4" aria-hidden /> {error}</p> : null}

      {preview ? (
        <div className="grid gap-4 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-bold tracking-wide uppercase">Dry run: {preview.filename}</p>
              <p className="text-sm text-muted-foreground">{preview.rows.length.toLocaleString()} rows · {preview.valid.toLocaleString()} valid · {preview.invalid.length} invalid</p>
            </div>
            <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-bold uppercase", preview.invalid.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800")}>
              {preview.invalid.length ? <AlertTriangle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
              {preview.invalid.length ? "Some rows will be skipped" : "All rows valid"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Years parsed", preview.stats.years], ["Make recognised", preview.stats.make], ["Model recognised", preview.stats.model], ["OEM part #", preview.stats.pn]] as const).map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{pct(v)}</dd>
              </div>
            ))}
          </dl>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Category groups ({preview.groups.length})</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-3">{preview.groups.map(([g, n]) => <li key={g} className="flex justify-between gap-2"><span>{g}</span><span className="tabular-nums text-muted-foreground">{n}</span></li>)}</ul>
          </details>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead><tr className="border-b text-[10px] tracking-wider text-muted-foreground uppercase"><th className="py-2">SKU</th><th>Title</th><th>Vehicle</th><th>Group</th><th className="text-right">Price</th></tr></thead>
              <tbody>
                {preview.sample.map((s) => (
                  <tr key={s.sku} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 font-mono">{s.sku}</td>
                    <td className="max-w-72 truncate pr-2">{s.title}{s.warnings.length ? <span className="ml-1 text-amber-700" title={s.warnings.join("; ")}>⚠</span> : null}</td>
                    <td className="pr-2">{s.vehicle || "—"}</td>
                    <td className="pr-2">{s.group}</td>
                    <td className="text-right tabular-nums">${s.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-muted-foreground">First {preview.sample.length} of {preview.valid.toLocaleString()} rows.</p>
          </div>
          {preview.invalid.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-amber-800">Invalid rows ({preview.invalid.length})</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-xs">{preview.invalid.slice(0, 100).map((r) => <li key={r.rowNumber}>line {r.rowNumber}: {r.error}</li>)}</ul>
            </details>
          ) : null}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={markMissingSold} onChange={(e) => setMarkMissingSold(e.target.checked)} className="mt-0.5 size-4 accent-primary" disabled={running} />
            <span><span className="font-semibold">Mark eBay items missing from this file as sold.</span> Use with a complete active-listings export only.</span>
          </label>

          {progress ? (
            <div aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${(progress.done / preview.rows.length) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{progress.done.toLocaleString()} / {preview.rows.length.toLocaleString()} rows · {progress.created} created · {progress.updated} updated · {progress.failed} failed</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={commit} disabled={running || preview.valid === 0}>
              {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} {running ? "Importing…" : `Import ${preview.valid.toLocaleString()} rows`}
            </Button>
            {running ? (
              <Button type="button" variant="outline" onClick={() => (stopRef.current = true)}><Square aria-hidden /> Stop after this batch</Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
