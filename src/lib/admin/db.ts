import "server-only";

type PgError = { code?: string; message?: string } | null | undefined;

/**
 * True when a query failed because a table/column/function from a not-yet-applied migration
 * is missing (Postgres 42P01/42703/42883, PostgREST PGRST200/202/204/205).
 */
export function isMissingSchema(error: PgError): boolean {
  if (!error) return false;
  return ["42P01", "42703", "42883", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    /does not exist|could not find the (table|function|column)/i.test(error.message ?? "");
}

/** PostgREST `or`/`ilike` filters are comma/paren-delimited: keep only safe characters. */
export function sanitizeSearch(q: string, max = 80): string {
  return q.replace(/[^\p{L}\p{N}\s.#/@_-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export const partNumberKey = (q: string) => q.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function pageNumber(v: unknown, max = 10_000): number {
  const n = Number(typeof v === "string" ? v : 1);
  return Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : 1;
}
