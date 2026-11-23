import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

config({ path: ".env.local", quiet: true });

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const STATE_DIR = "tests/e2e/.auth";
export type Role = "admin" | "staff" | "customer";
export type Fixture = { users: Record<Role, { id: string; email: string; password: string }>; migrated: boolean; createdAt: string };

export function fixture(): Fixture {
  return JSON.parse(readFileSync(join(STATE_DIR, "fixture.json"), "utf8")) as Fixture;
}

export const statePath = (role: Role) => join(STATE_DIR, `${role}.json`);

export function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** A supabase-js client signed in as one of the fixture users (to test RLS directly). */
export async function userClient(role: Role) {
  const f = fixture();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email: f.users[role].email, password: f.users[role].password });
  if (error) throw new Error(`sign in ${role}: ${error.message}`);
  return db;
}

/**
 * Signs in with Supabase directly and returns the exact auth cookies @supabase/ssr would set,
 * so tests skip the (rate-limited) login form.
 */
export async function sessionCookies(email: string, password: string) {
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => {
        for (const c of cookies) {
          const i = jar.findIndex((x) => x.name === c.name);
          if (i >= 0) jar.splice(i, 1);
          if (c.value) jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  const url = new URL(BASE);
  return jar.map((c) => ({ name: c.name, value: c.value, domain: url.hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const, expires: Math.floor(Date.now() / 1000) + 3600 }));
}

/** Server Action id by export name + source file, read from Next's server reference manifests. */
export function actionId(exportName: string, fileSuffix: string): string | null {
  const roots = [".next/dev/server/app", ".next/server/app", ".next/server"];
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry === "server-reference-manifest.json") files.push(p);
    }
  };
  roots.forEach(walk);
  for (const file of files) {
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { node?: Record<string, { exportedName?: string; filename?: string }> };
    for (const [id, entry] of Object.entries(manifest.node ?? {})) {
      if (entry.exportedName === exportName && (entry.filename ?? "").replace(/\\/g, "/").endsWith(fileSuffix)) return id;
    }
  }
  return null;
}

/** Calls a Server Action the way the browser does; returns the raw RSC response text. */
export async function callAction(id: string, args: unknown[], cookieHeader: string, path = "/admin") {
  const res = await fetch(new URL(path, BASE), {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      Origin: BASE,
      Cookie: cookieHeader,
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, text: await res.text() };
}
