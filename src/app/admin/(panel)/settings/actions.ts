"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { dbError, invalid, logEvent } from "@/lib/admin/server";
import { requestOrigin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

const roleSchema = z.object({ id: z.uuid(), role: z.enum(["customer", "staff", "admin"]) });

/** Admin only. RLS (is_admin) and the profiles_guard_role trigger enforce it again in Postgres. */
export async function setUserRole(input: z.input<typeof roleSchema>): Promise<ActionResult> {
  const auth = await authorize("settings");
  if (!auth.ok) return FORBIDDEN;
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, role } = parsed.data;
  const { db, userId } = auth.session;
  if (id === userId && role !== "admin") {
    const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").is("disabled_at", null);
    if ((count ?? 0) <= 1) return { ok: false, message: "You're the only admin. Make someone else an admin first." };
  }
  const { error, count } = await db.from("profiles").update({ role }, { count: "exact" }).eq("id", id);
  if (error) return dbError(error);
  if (!count) return { ok: false, message: "User not found." };
  revalidatePath("/admin/settings");
  return { ok: true, message: `Role changed to ${role}` };
}

const inviteSchema = z.object({ email: z.email("Enter a valid email.").max(200), role: z.enum(["staff", "admin"]), name: z.string().trim().max(120).optional() });

/**
 * Invites a new staff member by email (Supabase sends the invite; the link lands on
 * /auth/confirm and lets them set a password). Existing accounts are just promoted.
 */
export async function inviteStaff(input: z.input<typeof inviteSchema>): Promise<ActionResult> {
  const auth = await authorize("settings");
  if (!auth.ok) return FORBIDDEN;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const email = parsed.data.email.toLowerCase();
  const service = createServiceClient();
  if (!service) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY isn't configured on the server." };

  const { data: existing } = await auth.session.db.from("profiles").select("id").eq("email", email).maybeSingle();
  let userId = existing?.id ?? null;
  if (!userId) {
    const origin = await requestOrigin();
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: parsed.data.name ?? "" },
      redirectTo: `${origin}/auth/confirm?next=/account/reset-password`,
    });
    if (error || !data.user) return { ok: false, message: error?.message ?? "Couldn't send the invite." };
    userId = data.user.id;
  }
  const { error } = await service.from("profiles").upsert({ id: userId, email, role: parsed.data.role, ...(parsed.data.name ? { full_name: parsed.data.name } : {}) }, { onConflict: "id" });
  if (error) return dbError(error);
  await logEvent(auth.session.db, "staff.invite", "profiles", userId, `${existing ? "Granted" : "Invited"} ${email} as ${parsed.data.role}`);
  revalidatePath("/admin/settings");
  return { ok: true, message: existing ? `${email} is now ${parsed.data.role}` : `Invite sent to ${email}` };
}
