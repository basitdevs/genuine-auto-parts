import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase auth cookies and applies optimistic sign-in redirects:
 *  - /admin/*: signed-out visitors go to /admin/login.
 *  - /account (dashboard): signed-out visitors go to /account/login?next=…
 *  - /account/login, /account/signup, /account/forgot-password: signed-in visitors go to /account.
 * Optimistic only: every page and Server Action re-checks the session (and, for admin,
 * the staff role) on the server, and RLS enforces it again in the database.
 */
type Rule = { loginPath: string; isPublic: (path: string) => boolean; signedInRedirect?: (path: string) => string | null };

const ACCOUNT_GUEST_PAGES = ["/account/login", "/account/signup", "/account/forgot-password"];

const RULES: { prefix: string; rule: Rule }[] = [
  {
    prefix: "/admin",
    rule: { loginPath: "/admin/login", isPublic: (p) => p.startsWith("/admin/login") },
  },
  {
    prefix: "/account",
    rule: {
      loginPath: "/account/login",
      // Reset-password handles its own "link expired" state.
      isPublic: (p) => ACCOUNT_GUEST_PAGES.some((g) => p.startsWith(g)) || p.startsWith("/account/reset-password"),
      signedInRedirect: (p) => (ACCOUNT_GUEST_PAGES.some((g) => p.startsWith(g)) ? "/account" : null),
    },
  },
];

export async function refreshSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    // Auth unreachable: let the page decide (it re-checks and shows its own state).
    return response;
  }

  const path = request.nextUrl.pathname;
  const rule = RULES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`))?.rule;
  const redirectTo = (pathname: string, search = "") => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = search;
    const res = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie); // keep refreshed tokens
    return res;
  };

  if (rule) {
    if (!signedIn && !rule.isPublic(path)) {
      return redirectTo(rule.loginPath, `?next=${encodeURIComponent(path + request.nextUrl.search)}`);
    }
    const target = signedIn ? rule.signedInRedirect?.(path) : null;
    if (target) {
      // Honor ?next= but keep it same-origin: only its path and query are reused.
      const next = request.nextUrl.searchParams.get("next");
      const dest = next && next.startsWith("/") ? new URL(next, request.url) : null;
      if (dest && dest.origin === request.nextUrl.origin && !ACCOUNT_GUEST_PAGES.some((g) => dest.pathname.startsWith(g))) {
        return redirectTo(dest.pathname, dest.search);
      }
      return redirectTo(target);
    }
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
