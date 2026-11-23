import { expect, test, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import { actionId, BASE, callAction, fixture, statePath, userClient, type Role } from "./helpers";

const STAFF_AREAS = ["/admin", "/admin/orders", "/admin/products", "/admin/products/new", "/admin/vehicles", "/admin/vehicles/new", "/admin/leads", "/admin/customers"];
const ADMIN_ONLY = ["/admin/imports", "/admin/content", "/admin/settings", "/admin/activity"];
const ALL = [...STAFF_AREAS, ...ADMIN_ONLY];

const cookieHeader = (role: Role) =>
  (JSON.parse(readFileSync(statePath(role), "utf8")) as { cookies: { name: string; value: string }[] }).cookies.map((c) => `${c.name}=${c.value}`).join("; ");

async function contextFor(browser: Browser, role: Role | "anon") {
  return browser.newContext(role === "anon" ? {} : { storageState: statePath(role) });
}

test.describe("admin route access", () => {
  test("signed-out visitors are sent to the login page from every admin route", async ({ browser }) => {
    const ctx = await contextFor(browser, "anon");
    const page = await ctx.newPage();
    for (const path of ALL) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login/);
      await expect(page.getByRole("heading", { name: /staff sign in/i })).toBeVisible();
    }
    await ctx.close();
  });

  test("customers are rejected from every admin route without seeing admin data", async ({ browser }) => {
    const ctx = await contextFor(browser, "customer");
    const page = await ctx.newPage();
    for (const path of ALL) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login\?error=forbidden/);
      await expect(page.getByText(/doesn't have access/i)).toBeVisible();
      await expect(page.locator("nav[aria-label='Admin']")).toHaveCount(0);
    }
    await ctx.close();
  });

  test("staff can open staff areas but are redirected from admin-only areas", async ({ browser }) => {
    const ctx = await contextFor(browser, "staff");
    const page = await ctx.newPage();
    for (const path of STAFF_AREAS) {
      await page.goto(path);
      await expect(page, path).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}(\\?.*)?$`));
      await expect(page.locator("h1").first()).toBeVisible();
    }
    for (const path of ADMIN_ONLY) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\?error=forbidden/);
      await expect(page.getByText(/role doesn't include that area/i)).toBeVisible();
    }
    // Admin-only links are not offered in the sidebar either.
    await expect(page.locator("nav[aria-label='Admin'] a[href='/admin/settings']")).toHaveCount(0);
    await ctx.close();
  });

  test("admins can open every admin route", async ({ browser }) => {
    const ctx = await contextFor(browser, "admin");
    const page = await ctx.newPage();
    for (const path of ALL) {
      await page.goto(path);
      await expect(page, path).not.toHaveURL(/login|error=forbidden/);
      await expect(page.locator("h1").first()).toBeVisible();
    }
    await ctx.close();
  });
});

test.describe("admin API routes", () => {
  test("search, export and warnings refuse non-staff / non-admin callers", async ({ request }) => {
    const anon = await request.get("/admin/api/search?q=bmw", { maxRedirects: 0 });
    expect([302, 303, 307, 401, 403]).toContain(anon.status());
    for (const [role, path, expected] of [
      ["customer", "/admin/api/search?q=bmw", 403],
      ["customer", "/admin/api/products/export", 403],
      ["staff", "/admin/api/imports/00000000-0000-0000-0000-000000000000/warnings", 403],
    ] as const) {
      const res = await request.get(path, { headers: { Cookie: cookieHeader(role) }, maxRedirects: 0 });
      expect(res.status(), `${role} ${path}`).toBe(expected);
    }
    const ok = await request.get("/admin/api/search?q=bmw", { headers: { Cookie: cookieHeader("staff") } });
    expect(ok.status()).toBe(200);
    expect(((await ok.json()) as { hits: unknown[] }).hits.length).toBeGreaterThan(0);
  });
});

test.describe("server actions re-check the role on the server", () => {
  // Make sure the admin pages (and their action manifests) are compiled first.
  test.beforeAll(async ({ browser }) => {
    const ctx = await contextFor(browser, "admin");
    const page = await ctx.newPage();
    const pages = ["/admin/products", "/admin/orders", "/admin/content", "/admin/settings", "/admin/imports", "/admin/customers", `/admin/customers/${fixture().users.customer.id}`, "/admin/orders/11111111-1111-4111-8111-111111111111"];
    for (const path of pages) await page.goto(path);
    await ctx.close();
  });

  const cases: { name: string; file: string; args: unknown[]; deny: Role[] }[] = [
    { name: "saveSetting", file: "admin/(panel)/content/actions.ts", args: ["flags", { checkoutEnabled: false, showPrices: false, maintenanceBanner: { enabled: true, message: "pwned", tone: "info" } }], deny: ["customer", "staff"] },
    { name: "setUserRole", file: "admin/(panel)/settings/actions.ts", args: [{ id: "11111111-1111-4111-8111-111111111111", role: "admin" }], deny: ["customer", "staff"] },
    { name: "startImport", file: "admin/(panel)/imports/actions.ts", args: [{ filename: "x.csv", totalRows: 1, markMissingSold: false }], deny: ["customer", "staff"] },
    { name: "setCustomerDisabled", file: "admin/(panel)/customers/actions.ts", args: [{ id: "11111111-1111-4111-8111-111111111111", disabled: true }], deny: ["customer", "staff"] },
    { name: "bulkProducts", file: "admin/(panel)/products/actions.ts", args: [{ action: "status", ids: ["11111111-1111-4111-8111-111111111111"], value: "archived" }], deny: ["customer"] },
    { name: "updateOrderStatus", file: "admin/(panel)/orders/actions.ts", args: [{ orderId: "11111111-1111-4111-8111-111111111111", status: "paid" }], deny: ["customer"] },
  ];

  for (const c of cases) {
    test(`${c.name} is refused for ${c.deny.join(" and ")} and signed-out callers`, async () => {
      const id = actionId(c.name, c.file);
      test.skip(!id, `action id for ${c.name} not found in the server manifests`);
      for (const who of [...c.deny, "anon"] as const) {
        const res = await callAction(id!, c.args, who === "anon" ? "" : cookieHeader(who));
        if (who === "anon" && res.status >= 300 && res.status < 400) {
          // Signed-out: Proxy redirects to the login page before the action can run at all.
          expect(res.text, `${c.name} as anon`).toContain("/admin/login");
          continue;
        }
        expect(res.text, `${c.name} as ${who}`).toContain("You don't have permission");
      }
    });
  }
});

test.describe("database (RLS) enforces the same rules", () => {
  test("customers can only see their own profile and no leads or orders", async () => {
    const db = await userClient("customer");
    const profiles = await db.from("profiles").select("id");
    expect(profiles.data?.map((p) => p.id)).toEqual([fixture().users.customer.id]);
    expect((await db.from("part_requests").select("id")).data ?? []).toHaveLength(0);
    const orders = await db.from("orders").select("id").neq("customer_id", fixture().users.customer.id);
    expect(orders.data ?? []).toHaveLength(0);
  });

  test("staff cannot escalate to admin, write settings or read the audit log", async () => {
    test.skip(!fixture().migrated, "needs migration 0600");
    const db = await userClient("staff");
    const promote = await db.from("profiles").update({ role: "admin" }).eq("id", fixture().users.staff.id);
    expect(promote.error?.message ?? "").toMatch(/only admins/i);
    const write = await db.from("site_settings").upsert({ key: "flags", value: { showPrices: false } });
    expect(write.error).not.toBeNull();
    expect((await db.from("audit_log").select("id")).data ?? []).toHaveLength(0);
  });
});

test("admin pages are never indexed", async ({ browser }) => {
  const ctx = await contextFor(browser, "admin");
  const page = await ctx.newPage();
  const res = await page.goto("/admin/products");
  expect(res?.headers()["x-robots-tag"] ?? "").toMatch(/noindex/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  expect(robots).toMatch(/Disallow: \/admin/);
  await ctx.close();
});
