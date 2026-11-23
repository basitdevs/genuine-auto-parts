import { authorize } from "@/lib/admin/access";

const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function warningType(w: string): string {
  if (w.startsWith("Make not recognised")) return "make_not_recognised";
  if (w.startsWith("Model not recognised")) return "model_not_recognised";
  if (w.startsWith("No model years")) return "no_years";
  if (w.startsWith("Unknown condition")) return "unknown_condition";
  return "other";
}

/** Rows with parser warnings (and failed rows) for manual review, as CSV. Admin only. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/api/imports/[id]/warnings">) {
  const auth = await authorize("imports");
  if (!auth.ok) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const { db } = auth.session;

  const lines = ["ebay_item_number,title,status,warning_type,detail,csv_line,sku"];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("import_rows")
      .select("row_number, status, warnings, error_message, raw")
      .eq("job_id", id)
      .or("warnings.neq.{},status.eq.failed")
      .order("row_number")
      .range(from, from + 999);
    if (error) return new Response(`Export failed: ${error.message}`, { status: 500 });
    for (const r of data ?? []) {
      const raw = (r.raw ?? {}) as Record<string, string>;
      const detail = r.status === "failed" ? (r.error_message ?? "") : r.warnings.join("; ");
      const type = r.status === "failed" ? "invalid_row" : [...new Set(r.warnings.map(warningType))].join("; ");
      lines.push([raw["Item number"] ?? "", raw.Title ?? "", r.status, type, detail, String(r.row_number), raw["Custom label (SKU)"] ?? ""].map(csvCell).join(","));
    }
    if (!data || data.length < 1000) break;
  }
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="import-${id.slice(0, 8)}-warnings.csv"`, "Cache-Control": "no-store" },
  });
}
