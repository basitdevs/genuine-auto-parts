"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkStaff } from "@/lib/auth/staff";
import { checkSpam } from "@/lib/forms/spam";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Admin sign-in / sign-out. Area actions live next to their pages
 * (src/app/admin/(panel)/<area>/actions.ts) and each one calls authorize(area) first.
 */
export type AdminActionState = { status: "idle" | "success" | "error"; message: string };


// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter your email.")),
  password: z.string().min(6, "Enter your password.").max(200),
  next: z.string().regex(/^\/admin(\/[a-z0-9/_-]*)?$/).catch("/admin"),
  website: z.string().max(0).optional().default(""),
  startedAt: z.string().optional().default(""),
});

export async function signIn(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your details." };

  const verdict = await checkSpam("admin-login", parsed.data);
  if (verdict !== "ok") return { status: "error", message: "Too many attempts. Please wait a few minutes and try again." };

  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { status: "error", message: "Email or password is incorrect." };

  const staff = await checkStaff();
  if (!staff.ok) {
    await db.auth.signOut();
    return { status: "error", message: "This account doesn't have staff access." };
  }
  redirect(parsed.data.next);
}

export async function signOut() {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  redirect("/admin/login");
}
