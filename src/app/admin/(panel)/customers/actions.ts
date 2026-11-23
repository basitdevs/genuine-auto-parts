"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { dbError, logEvent } from "@/lib/admin/server";
import { createServiceClient } from "@/lib/supabase/admin";

const schema = z.object({ id: z.uuid(), disabled: z.boolean() });

/**
 * Admin only. Sets profiles.disabled_at (RLS: is_staff/is_admin ignore disabled accounts)
 * and bans the auth user so they can't sign in at all; re-enabling lifts both.
 */
export async function setCustomerDisabled(input: z.input<typeof schema>): Promise<ActionResult> {
  const auth = await authorize("settings");
  if (!auth.ok) return FORBIDDEN;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { id, disabled } = parsed.data;
  if (id === auth.session.userId) return { ok: false, message: "You can't disable your own account." };

  const { error } = await auth.session.db.from("profiles").update({ disabled_at: disabled ? new Date().toISOString() : null }).eq("id", id);
  if (error) return dbError(error);

  const service = createServiceClient();
  if (service) {
    const { error: banError } = await service.auth.admin.updateUserById(id, { ban_duration: disabled ? "876000h" : "none" });
    if (banError) console.error(`[admin] ban update failed for ${id}: ${banError.message}`);
  }
  await logEvent(auth.session.db, disabled ? "customer.disable" : "customer.enable", "profiles", id, disabled ? "Disabled account" : "Re-enabled account");
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return { ok: true, message: disabled ? "Account disabled. They can't sign in." : "Account re-enabled" };
}
