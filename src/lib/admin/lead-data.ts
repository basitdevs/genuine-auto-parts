import "server-only";
import type { StaffSession } from "@/lib/auth/staff";
import { LEAD_TABLES, type LeadType } from "./leads";

export type LeadSummary = {
  type: LeadType;
  id: number;
  status: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  summary: string;
  assignedTo: string | null;
};

const money = (v: unknown) => (v === null || v === undefined ? "" : `$${Number(v).toFixed(2)}`);

/** One-line summary per lead type (list + dashboard). */
export function summarize(type: LeadType, r: Record<string, unknown>): string {
  const s = (k: string) => (r[k] === null || r[k] === undefined || r[k] === "" ? null : String(r[k]));
  const vehicle = [s("vehicle_year"), s("vehicle_make"), s("vehicle_model")].filter(Boolean).join(" ");
  switch (type) {
    case "sell_car":
      return [vehicle || "Vehicle", s("mileage") ? `${Number(r.mileage).toLocaleString()} mi` : null, s("asking_price") ? `asking ${money(r.asking_price)}` : null].filter(Boolean).join(" · ");
    case "part":
      return s("offer_amount") ? `Offer ${money(r.offer_amount)}${s("part_name") ? ` · ${s("part_name")}` : ""}` : [s("part_name") ?? "Part request", vehicle].filter(Boolean).join(" · ");
    case "return":
      return `Return: ${s("reason") ?? ""}${s("order_number") ? ` · order ${s("order_number")}` : ""}`;
    case "contact":
      return s("subject") ?? (s("message")?.slice(0, 80) || "Message");
  }
}

type Filters = { types: LeadType[]; status?: string; assignee?: string; q?: string };

/**
 * Merged, newest-first list across the lead tables with server pagination. Each table is
 * asked for at most page*pageSize rows, so a page costs O(page) rows per table.
 */
export async function listLeads(db: StaffSession["db"], f: Filters, page: number, pageSize: number) {
  const limit = page * pageSize;
  const results = await Promise.all(
    f.types.map(async (type) => {
      let q = db.from(LEAD_TABLES[type]).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(0, limit - 1);
      if (f.status) q = q.eq("status", f.status as "new");
      if (f.assignee === "unassigned") q = q.is("assigned_to", null);
      else if (f.assignee) q = q.eq("assigned_to", f.assignee);
      if (f.q) q = q.or(`name.ilike.%${f.q}%,email.ilike.%${f.q}%,phone.ilike.%${f.q}%`);
      const { data, error, count } = await q.overrideTypes<Record<string, unknown>[], { merge: false }>();
      return { type, data: data ?? [], error, count: count ?? 0 };
    }),
  );
  const error = results.find((r) => r.error)?.error ?? null;
  const all: LeadSummary[] = results
    .flatMap((r) =>
      r.data.map((row) => ({
        type: r.type,
        id: Number(row.id),
        status: String(row.status),
        createdAt: String(row.created_at),
        name: String(row.name),
        email: String(row.email),
        phone: (row.phone as string | null) ?? null,
        summary: summarize(r.type, row),
        assignedTo: (row.assigned_to as string | null | undefined) ?? null,
      })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows: all.slice((page - 1) * pageSize, page * pageSize), total: results.reduce((n, r) => n + r.count, 0), error };
}

export async function loadStaff(db: StaffSession["db"]) {
  const { data } = await db.from("profiles").select("id, email, full_name").in("role", ["staff", "admin"]).order("email");
  return (data ?? []).map((p) => ({ id: p.id, label: p.full_name || p.email || p.id.slice(0, 8) }));
}
