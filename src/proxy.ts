import { NextResponse, type NextRequest } from "next/server";
import { POLICY_SLUGS } from "@/config/policies";
import { recordExists } from "@/lib/catalog/exists";
import { refreshSupabaseSession } from "@/lib/supabase/proxy-session";

/**
 * 1. Real 404 statuses for unknown product/vehicle URLs.
 *    With Cache Components the page shell streams with status 200 before notFound() can run,
 *    so the check happens here, before rendering. Document requests (browsers, crawlers, curl)
 *    get the branded 404 page with a real 404 status. In-app router fetches (Sec-Fetch-Dest: empty)
 *    pass through, and the page renders its not-found UI client-side.
 * 2. Supabase session refresh + optimistic sign-in gates for /admin and /account.
 */
let notFoundHtml: { body: string; expires: number } | null = null;

async function notFoundResponse(request: NextRequest): Promise<Response> {
  if (!notFoundHtml || notFoundHtml.expires < Date.now()) {
    try {
      const res = await fetch(new URL("/not-found-page", request.url), { signal: AbortSignal.timeout(5000) });
      notFoundHtml = { body: await res.text(), expires: Date.now() + 10 * 60_000 };
    } catch {
      notFoundHtml = null;
    }
  }
  return new Response(notFoundHtml?.body ?? "<!doctype html><title>Not found</title><h1>404 – Not found</h1>", {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=120",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const detail = /^\/(parts|vehicles)\/([^/]+)\/?$/.exec(pathname);
  if (detail) {
    if (request.headers.get("sec-fetch-dest") === "empty") return NextResponse.next(); // client-side navigation
    const kind = detail[1] === "parts" ? "product" : "vehicle";
    let slug: string;
    try {
      slug = decodeURIComponent(detail[2]);
    } catch {
      return notFoundResponse(request);
    }
    const exists = await recordExists(kind, slug);
    if (exists === false) return notFoundResponse(request);
    return NextResponse.next();
  }

  const policy = /^\/policies\/([^/]+)\/?$/.exec(pathname);
  if (policy) {
    return (POLICY_SLUGS as readonly string[]).includes(policy[1]) ? NextResponse.next() : notFoundResponse(request);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/account")) return refreshSupabaseSession(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/parts/:slug", "/vehicles/:slug", "/policies/:slug", "/admin", "/admin/:path*", "/account", "/account/:path*"],
};
