import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import type { AuthError } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";

export type Customer = {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string | null;
};

/**
 * The signed-in visitor (verified JWT via getClaims) plus their profile row.
 * Returns null when signed out. Use inside <Suspense> or in Server Actions.
 */
export async function getCustomer(): Promise<{ customer: Customer; db: Awaited<ReturnType<typeof createSupabaseServerClient>> } | null> {
  await connection(); // per-request: the JWT check reads the clock
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await db.from("profiles").select("email, full_name, phone, role, created_at").eq("id", claims.sub).maybeSingle();
  return {
    db,
    customer: {
      userId: claims.sub,
      email: profile?.email ?? (typeof claims.email === "string" ? claims.email : ""),
      name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      role: profile?.role ?? "customer",
      createdAt: profile?.created_at ?? null,
    },
  };
}

/**
 * Absolute origin for links in auth emails. Server Actions only run when the Origin
 * header matches the host (Next's CSRF check), so the header is trustworthy here;
 * Supabase additionally only redirects to URLs on its allow-list.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : env.siteUrl;
}

/** Friendly copy for Supabase Auth errors (https://supabase.com/docs/guides/auth/debugging/error-codes). */
export function authErrorMessage(error: Pick<AuthError, "code" | "status" | "message">): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Please confirm your email address first. Check your inbox for the link we sent.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead, or reset your password.";
    case "weak_password":
      return "Please choose a stronger password: at least 8 characters with letters and numbers.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts in a short time. Please wait a few minutes and try again.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "New accounts can't be created right now. Please contact us.";
    case "email_address_invalid":
      return "That email address can't be used. Please try another.";
    case "reauthentication_needed":
      return "For security, please sign out and use “Forgot password” to set a new password.";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "Your session has expired. Please sign in again.";
    default:
      if (error.status === 429) return "Too many attempts in a short time. Please wait a few minutes and try again.";
      return "Something went wrong. Please try again in a moment.";
  }
}
