/**
 * Exports rows with parser warnings from an import job to CSV for manual review.
 *
 *   npm run import:warnings                 # latest completed job -> data/imports/review-warnings.csv
 *   npm run import:warnings -- <job-id> [out.csv]
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

config({ path: [".env.local", ".env"], quiet: true });

type Row = { row_number: number; warnings: string[]; raw: Record<string, string> };

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** "Model not recognised for Kia" -> "model_not_recognised" */
function warningType(w: string): string {
  if (w.startsWith("Make not recognised")) return "make_not_recognised";
  if (w.startsWith("Model not recognised")) return "model_not_recognised";
  if (w.startsWith("No model years")) return "no_years";
  if (w.startsWith("Unknown condition")) return "unknown_condition";
  return "other";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const db = createClient(url, key, { auth: { persistSession: false } });

  let jobId = process.argv[2];
  const out = process.argv[3] ?? "data/imports/review-warnings.csv";
  if (!jobId) {
    const { data, error } = await db
      .from("import_jobs")
      .select("id")
      .in("status", ["completed", "completed_with_errors"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) throw new Error(`No completed import job found: ${error?.message ?? ""}`);
    jobId = data.id as string;
  }

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("import_rows")
      .select("row_number, warnings, raw")
      .eq("job_id", jobId)
      .neq("warnings", "{}")
      .order("row_number")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  const lines = ["ebay_item_number,title,warning_type,warning_detail,csv_line,sku"];
  for (const r of rows) {
    lines.push(
      [
        r.raw["Item number"] ?? "",
        r.raw["Title"] ?? "",
        [...new Set(r.warnings.map(warningType))].join("; "),
        r.warnings.join("; "),
        String(r.row_number),
        r.raw["Custom label (SKU)"] ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  writeFileSync(out, `﻿${lines.join("\r\n")}\r\n`); // BOM so Excel reads UTF-8 correctly
  console.log(`Wrote ${rows.length} rows from job ${jobId} to ${out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
