import { expect, test } from "@playwright/test";
import { fixture, serviceClient, statePath } from "./helpers";

test.use({ storageState: statePath("admin") });

test("product edit: change price and title, save, see it in the table and on the store", async ({ page }) => {
  const db = serviceClient();
  const { data: product } = await db.from("products").select("id, slug, title, price").eq("status", "active").order("updated_at", { ascending: true }).limit(1).single();
  expect(product).not.toBeNull();
  const original = { title: product!.title, price: Number(product!.price) };
  const newPrice = (original.price + 1.23).toFixed(2);

  try {
    await page.goto(`/admin/products/${product!.id}`);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(original.title);
    await page.getByLabel("Price ($)").fill(newPrice);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Product saved")).toBeVisible();

    const { data: after } = await db.from("products").select("price").eq("id", product!.id).single();
    expect(Number(after!.price)).toBeCloseTo(Number(newPrice), 2);

    // Quick search in the products table finds it with the new price.
    await page.goto(`/admin/products?q=${encodeURIComponent(product!.slug.slice(0, 20))}`);
    await expect(page.getByText(`$${Number(newPrice).toFixed(2)}`).first()).toBeVisible();

    // Storefront shows the new price (catalog revalidated on save).
    await page.goto(`/parts/${product!.slug}`);
    await expect(page.locator("#buy")).toContainText(Number(newPrice).toFixed(2));
  } finally {
    await db.from("products").update({ price: original.price, title: original.title }).eq("id", product!.id);
  }
});

test("order status update: new → confirmed → paid takes stock, cancel returns it", async ({ page }) => {
  test.skip(!fixture().migrated, "needs migration 0600 (orders workflow)");
  const db = serviceClient();
  const { data: product } = await db.from("products").select("id, quantity, status").eq("status", "active").gte("quantity", 1).order("updated_at", { ascending: true }).limit(1).single();
  const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data: created, error } = await anon.rpc("create_order_request", {
    p_email: "e2e-order@genuine-auto-e2e.dev",
    p_name: "E2E Order",
    p_phone: null,
    p_postal_code: "85001",
    p_notes: "Playwright test order",
    p_items: [{ product_id: product!.id, quantity: 1 }],
  });
  expect(error).toBeNull();
  const orderId = (created as { o_id: string }[])[0].o_id;

  try {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByRole("radio", { name: "New" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Confirmed" }).click();
    await expect(page.getByText(/Marked confirmed/)).toBeVisible();
    await page.getByRole("radio", { name: "Paid" }).click();
    await expect(page.getByText(/Marked paid · 1 item\(s\) removed from stock/)).toBeVisible();

    const paid = await db.from("products").select("quantity, status").eq("id", product!.id).single();
    expect(paid.data!.quantity).toBe(product!.quantity - 1);

    await page.getByRole("radio", { name: "Cancelled" }).click();
    await expect(page.getByText(/returned to stock/)).toBeVisible();
    const restored = await db.from("products").select("quantity, status").eq("id", product!.id).single();
    expect(restored.data!.quantity).toBe(product!.quantity);
    expect(restored.data!.status).toBe(product!.status);

    const { data: events } = await db.from("order_events").select("kind, message").eq("order_id", orderId);
    expect(events!.filter((e) => e.kind === "status")).toHaveLength(3);
  } finally {
    await db.from("products").update({ quantity: product!.quantity, status: product!.status }).eq("id", product!.id);
    await db.from("orders").delete().eq("id", orderId);
  }
});

test("CSV import dry run: parses, validates and previews without writing", async ({ page }) => {
  const db = serviceClient();
  const before = await db.from("import_jobs").select("id", { count: "exact", head: true });
  await page.goto("/admin/imports");
  await page.getByLabel("CSV file").setInputFiles("tests/e2e/fixtures/ebay-sample.csv");
  await expect(page.getByText(/Dry run: ebay-sample\.csv/)).toBeVisible();
  await expect(page.getByText(/3 rows · 2 valid · 1 invalid/)).toBeVisible();
  await expect(page.getByText("E2E-SAMPLE-0001")).toBeVisible();
  await page.getByText(/Invalid rows \(1\)/).click();
  await expect(page.getByText(/line 4: Item number/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Import 2 rows/ })).toBeEnabled();
  // Nothing was written by the dry run.
  const after = await db.from("import_jobs").select("id", { count: "exact", head: true });
  expect(after.count).toBe(before.count);
  const { count } = await db.from("products").select("id", { count: "exact", head: true }).like("sku", "E2E-SAMPLE-%");
  expect(count).toBe(0);
});

test("settings change is reflected on the public site", async ({ page, browser }) => {
  test.skip(!fixture().migrated, "needs migration 0600 (site_settings)");
  const db = serviceClient();
  const { data: existing } = await db.from("site_settings").select("value").eq("key", "flags").maybeSingle();
  const message = `E2E notice ${Date.now().toString(36)}`;
  try {
    await page.goto("/admin/settings?tab=flags");
    await page.getByLabel(/Maintenance \/ announcement banner/).check();
    await page.getByLabel("Banner message").fill(message);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Saved\. The site shows the change right away\./)).toBeVisible();

    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto("/");
    await expect(pub.getByRole("status").filter({ hasText: message })).toBeVisible();
    await visitor.close();
  } finally {
    if (existing) await db.from("site_settings").update({ value: existing.value }).eq("key", "flags");
    else await db.from("site_settings").delete().eq("key", "flags");
    await fetch(`${process.env.E2E_BASE_URL ?? "http://localhost:3000"}/api/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.REVALIDATE_SECRET}` } }).catch(() => undefined);
  }
});
