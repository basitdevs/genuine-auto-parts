import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";

export type StaffRole = Extract<UserRole, "staff" | "admin">;

export type StaffSession = {
  userId: string;
  email: string | null;
  name: string | null;
  role: StaffRole;
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

export type StaffCheck = { ok: true; session: StaffSession } | { ok: false; reason: "signed-out" | "not-staff" };

/**
 * Server-side authorization for every admin page, Server Action and Route Handler.
 * Verifies the JWT (getClaims) and reads the role from public.profiles. Disabled accounts
 * (profiles.disabled_at, migration 0600) are rejected. The returned client is bound to
 * the user's session, so RLS (is_staff / is_admin policies) enforces access a second time.
 * Deduplicated per request (React cache), so layout + page + actions share one lookup.
 */
export const checkStaff = cache(async function checkStaff(): Promise<StaffCheck> {
  // Admin is private and per-request: never prerender past this point (the JWT check reads the clock).
  await connection();
  const db = await createSupabaseServerClient();
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, reason: "signed-out" };

  // select("*") so this keeps working before and after migration 0600 adds disabled_at.
  const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  const profile = data as (Record<string, unknown> & { role?: UserRole; email?: string | null; full_name?: string | null }) | null;
  if (!profile || (profile.role !== "staff" && profile.role !== "admin") || profile.disabled_at) {
    return { ok: false, reason: "not-staff" };
  }
  return { ok: true, session: { userId, email: profile.email ?? null, name: profile.full_name ?? null, role: profile.role, db } };
});

/** For pages: redirect away unless the visitor is signed-in staff. Prefer requireArea() in /admin. */
export async function requireStaff(next = "/admin"): Promise<StaffSession> {
  const result = await checkStaff();
  if (!result.ok) {
    redirect(result.reason === "signed-out" ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login?error=forbidden");
  }
  return result.session;
}
