"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authErrorMessage, requestOrigin } from "@/lib/auth/session";
import { fieldErrors, formToObject } from "@/lib/forms/lead-pipeline";
import {
  emailOnlySchema,
  newPasswordSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
  toTextOrNull,
  type AccountActionState,
} from "@/lib/forms/schemas";
import { checkSpam } from "@/lib/forms/spam";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Customer account Server Actions (Supabase Auth, email + password).
 * Auth email links land on /auth/confirm, which verifies them and signs the user in.
 * Forms render without JS too: every action is a plain <form action>.
 */
const RATE_LIMITED = {
  status: "error" as const,
  message: "Too many attempts in a short time. Please wait a few minutes and try again.",
};
const FIX_FIELDS = "Please fix the highlighted fields.";

/** Echo back non-secret fields so a failed submit doesn't wipe what the user typed. */
function keep(formData: FormData, ...keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") out[key] = value.slice(0, 300);
  }
  return out;
}

const confirmUrl = async (next: string) => `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function signInCustomer(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const values = keep(formData, "email");
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { status: "error", message: FIX_FIELDS, fieldErrors: fieldErrors(parsed.error), values };

  // Generous for typos and shared IPs; Supabase Auth applies its own limits too.
  const verdict = await checkSpam("login", parsed.data, { max: 10 });
  if (verdict === "rate-limited") return { ...RATE_LIMITED, values };
  if (verdict === "bot") return { status: "error", message: "Please try again.", values };

  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    return {
      status: "error",
      message: authErrorMessage(error),
      resendEmail: error.code === "email_not_confirmed" ? parsed.data.email : undefined,
      values,
    };
  }
  redirect(parsed.data.next);
}

export async function signUpCustomer(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const values = keep(formData, "name", "email");
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { status: "error", message: FIX_FIELDS, fieldErrors: fieldErrors(parsed.error), values };
  const { name, email, password, next } = parsed.data;
  const checkEmail: AccountActionState = {
    status: "success",
    message: `We sent a confirmation link to ${email}. Open it to activate your account. It can take a minute or two, and may land in spam.`,
    email,
  };

  const verdict = await checkSpam("signup", parsed.data);
  if (verdict === "rate-limited") return { ...RATE_LIMITED, values };
  if (verdict === "bot") return checkEmail;

  const db = await createSupabaseServerClient();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await confirmUrl(next), data: { full_name: name } },
  });
  if (error) {
    const message = authErrorMessage(error);
    return error.code === "weak_password"
      ? { status: "error", message: FIX_FIELDS, fieldErrors: { password: message }, values }
      : { status: "error", message, values };
  }
  // Email confirmation disabled in Supabase: the user is signed in immediately.
  if (data.session) redirect(next === "/account" ? "/account?welcome=1" : next);
  // Confirmation enabled (default). Supabase deliberately returns the same response for
  // existing emails, so the message stays neutral.
  return checkEmail;
}

export async function resendConfirmation(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const parsed = emailOnlySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { status: "error", message: "Please enter a valid email address." };
  const verdict = await checkSpam("resend-confirmation", parsed.data);
  if (verdict === "rate-limited") return RATE_LIMITED;
  if (verdict === "ok") {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: await confirmUrl("/account") } });
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) return RATE_LIMITED;
  }
  return { status: "success", message: `If ${parsed.data.email} has an unconfirmed account, a new confirmation link is on its way.` };
}

export async function requestPasswordReset(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const parsed = emailOnlySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: FIX_FIELDS, fieldErrors: fieldErrors(parsed.error), values: keep(formData, "email") };
  }
  const sent: AccountActionState = {
    status: "success",
    message: `If an account exists for ${parsed.data.email}, we've emailed a link to reset your password. The link expires in 1 hour.`,
  };

  const verdict = await checkSpam("password-reset", parsed.data);
  if (verdict === "rate-limited") return RATE_LIMITED;
  if (verdict === "bot") return sent;

  const db = await createSupabaseServerClient();
  const { error } = await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: await confirmUrl("/account/reset-password") });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return RATE_LIMITED;
  if (error) console.error(`[account] password reset failed: ${error.code ?? error.status} ${error.message}`);
  return sent; // never reveal whether the email is registered
}

export async function updatePassword(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const db = await createSupabaseServerClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims?.sub) {
    return { status: "error", message: "Your reset link has expired. Please request a new one." };
  }
  const parsed = newPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { status: "error", message: FIX_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message = authErrorMessage(error);
    return error.code === "weak_password" || error.code === "same_password"
      ? { status: "error", message: FIX_FIELDS, fieldErrors: { password: message } }
      : { status: "error", message };
  }
  redirect("/account?password=updated");
}

export async function updateProfile(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const db = await createSupabaseServerClient();
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { status: "error", message: "Your session has expired. Please sign in again." };

  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: FIX_FIELDS, fieldErrors: fieldErrors(parsed.error), values: keep(formData, "name", "phone") };
  }

  // RLS "profiles: self update" limits this to the user's own row; the role can't change.
  const { error, count } = await db
    .from("profiles")
    .update({ full_name: parsed.data.name, phone: toTextOrNull(parsed.data.phone) }, { count: "exact" })
    .eq("id", userId);
  if (error || !count) {
    if (error) console.error(`[account] profile update failed: ${error.message}`);
    return { status: "error", message: "We couldn't save your details. Please try again." };
  }
  revalidatePath("/account");
  return { status: "success", message: "Your details are saved." };
}

export async function signOutCustomer() {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  redirect("/");
}

/**
 * Saves the last vehicle a signed-in customer searched for to their profile ("saved
 * vehicle" in /admin/customers). Silent no-op for guests or before migration 0600.
 */
export async function rememberVehicle(input: { year?: number; make?: string; makeLabel?: string; model?: string; modelLabel?: string }): Promise<void> {
  const clean = (v: unknown, max = 60) => (typeof v === "string" && /^[\p{L}\p{N} .&'/-]{1,60}$/u.test(v) ? v.slice(0, max) : undefined);
  const year = Number.isInteger(input.year) && input.year! >= 1950 && input.year! <= 2100 ? input.year : undefined;
  const garage = { year, make: clean(input.make), makeLabel: clean(input.makeLabel), model: clean(input.model), modelLabel: clean(input.modelLabel) };
  if (!garage.make && !garage.year) return;
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;
  await db.from("profiles").update({ garage }).eq("id", userId);
}
