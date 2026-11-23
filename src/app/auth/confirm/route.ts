import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/forms/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Landing route for every Supabase Auth email (confirm signup, reset password, change email).
 * Supports both link styles:
 *  - token_hash + type (recommended email templates; works across browsers and devices)
 *  - ?code= (PKCE, Supabase's default {{ .ConfirmationURL }} links; same browser only)
 * On success the session cookies are set and the user continues to `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawType = params.get("type");
  const type = OTP_TYPES.find((t) => t === rawType) ?? null;
  const fallback = type === "recovery" ? "/account/reset-password" : "/account";
  const next = params.get("next") ? safeNextPath.parse(params.get("next")) : fallback;

  // Supabase redirects here with ?error=… when a link is expired or already used.
  if (params.get("error") || params.get("error_code")) {
    redirect(`/account/login?error=${params.get("error_code") === "otp_expired" ? "link-expired" : "link-invalid"}`);
  }

  const db = await createSupabaseServerClient();
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  let ok = false;
  if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    if (error) console.error(`[auth] verifyOtp(${type}) failed: ${error.code ?? error.status} ${error.message}`);
  } else if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error(`[auth] exchangeCodeForSession failed: ${error.code ?? error.status} ${error.message}`);
  }
  if (!ok) redirect("/account/login?error=link-invalid");

  if (type === "recovery" || next.startsWith("/account/reset-password")) redirect("/account/reset-password");
  redirect(next === "/account" ? "/account?welcome=1" : next);
}
