import "server-only";
import { redirect } from "next/navigation";
import { checkStaff, type StaffRole, type StaffSession } from "@/lib/auth/staff";
import { AREA_ROLES, type AdminArea } from "./areas";

export type { AdminArea } from "./areas";

export function canAccess(role: StaffRole, area: AdminArea): boolean {
  return AREA_ROLES[area].includes(role);
}

/**
 * Pages: signed-out → login (with ?next), wrong role → login with a "forbidden" notice.
 * Nothing from the page renders for a rejected visitor.
 */
export async function requireArea(area: AdminArea, next = "/admin"): Promise<StaffSession> {
  const result = await checkStaff();
  if (!result.ok) {
    redirect(result.reason === "signed-out" ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login?error=forbidden");
  }
  if (!canAccess(result.session.role, area)) redirect("/admin?error=forbidden");
  return result.session;
}

export type ActionResult<T = undefined> = { ok: true; message: string; data?: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export const FORBIDDEN: ActionResult<never> = { ok: false, message: "You don't have permission to do that. Please sign in again." };

/** Server Actions / Route Handlers: the same check, returned instead of redirecting. */
export async function authorize(area: AdminArea): Promise<{ ok: true; session: StaffSession } | { ok: false }> {
  const result = await checkStaff();
  if (!result.ok || !canAccess(result.session.role, area)) return { ok: false };
  return { ok: true, session: result.session };
}
