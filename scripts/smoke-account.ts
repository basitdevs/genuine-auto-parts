/**
 * End-to-end smoke test for customer accounts + cart against a running server:
 *   npm run build && npx next start -p 3104
 *   SMOKE_BASE_URL=http://localhost:3104 npm run test:smoke
 *
 * Submits the real forms the way a browser without JavaScript does (progressive
 * enhancement), so it exercises Proxy, Server Actions, Supabase Auth and RLS.
 * Uses a throwaway, pre-confirmed user created with the service role. Auth email
 * links come from admin.generateLink, so no real emails are sent. The user and its
 * test lead are deleted at the end.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3104";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const jar = new Map<string, string>();
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
}

function storeCookies(res: Response) {
  for (const raw of res.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = attrs.some((a) => /max-age=0\b/i.test(a.trim()) || /expires=Thu, 01 Jan 1970/i.test(a.trim()));
    if (expired || value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(new URL(path, BASE), {
    ...init,
    redirect: "manual",
    headers: { ...(init.headers ?? {}), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), origin: BASE },
  });
  storeCookies(res);
  return res;
}

const location = (res: Response) => {
  const loc = res.headers.get("location");
  return loc ? new URL(loc, BASE).pathname + new URL(loc, BASE).search : "";
};

/** Finds the first <form> containing `marker` and returns its React action hidden fields. */
function actionFields(html: string, marker: string): [string, string][] {
  const forms = html.split(/<form\b/).slice(1).map((f) => f.slice(0, f.indexOf("</form>")));
  const form = forms.find((f) => f.includes(marker));
  if (!form) throw new Error(`form with ${marker} not found`);
  const out: [string, string][] = [];
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]+)"/.exec(m[0])?.[1];
    const value = /value="([^"]*)"/.exec(m[0])?.[1] ?? "";
    if (name?.startsWith("$ACTION")) out.push([name, value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'")]);
  }
  return out;
}

async function submit(pagePath: string, marker: string, fields: Record<string, string>): Promise<Response> {
  const page = await request(pagePath);
  const html = await page.text();
  const body = new FormData();
  for (const [k, v] of actionFields(html, marker)) body.append(k, v);
  for (const [k, v] of Object.entries({ website: "", startedAt: String(Date.now() - 5000), ...fields })) body.append(k, v);
  return request(pagePath, { method: "POST", body });
}

async function main() {
  const stamp = Date.now();
  const email = `smoke-${stamp}@example.com`;
  const password = `Smoke-${stamp}-a1`;
  const newPassword = `Smoke-${stamp}-b2`;
  let userId = "";

  try {
    // --- Signed out ---------------------------------------------------------
    let res = await request("/account");
    check("signed-out /account redirects to login", res.status === 307 && location(res).startsWith("/account/login?next=%2Faccount"), `${res.status} ${location(res)}`);
    for (const path of ["/account/login", "/account/signup", "/account/forgot-password", "/cart"]) {
      res = await request(path);
      check(`${path} renders`, res.status === 200, String(res.status));
    }
    res = await request("/account/reset-password");
    check("reset-password without session shows expired-link state", (await res.text()).includes("expired or was already used"));
    res = await request("/auth/confirm");
    check("/auth/confirm without token → login?error=link-invalid", location(res) === "/account/login?error=link-invalid", location(res));
    res = await request("/auth/confirm?error=access_denied&error_code=otp_expired");
    check("/auth/confirm expired → login?error=link-expired", location(res) === "/account/login?error=link-expired", location(res));

    // --- Validation without hitting Supabase --------------------------------
    res = await submit("/account/signup", 'name="password"', { name: "Smoke Test", email, password: "short", next: "/account" });
    check("signup rejects weak password", res.status === 200 && (await res.text()).includes("Use at least 8 characters"), String(res.status));

    // --- Test user (pre-confirmed, no email sent) ---------------------------
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Smoke Tester" } });
    if (created.error) throw new Error(`createUser: ${created.error.message}`);
    userId = created.data.user.id;
    const profile = await admin.from("profiles").select("role, full_name").eq("id", userId).maybeSingle();
    check("trigger created a customer profile with the name", profile.data?.role === "customer" && profile.data?.full_name === "Smoke Tester", JSON.stringify(profile.data));

    res = await submit("/account/login", 'name="password"', { email, password: "wrong-password-1", next: "/account" });
    check("wrong password shows an error", (await res.text()).includes("Email or password is incorrect"), String(res.status));

    res = await submit("/account/login", 'name="password"', { email, password, next: "/account" });
    check("sign in redirects to /account", res.status === 303 && location(res) === "/account", `${res.status} ${location(res)}`);
    check("auth cookie set", [...jar.keys()].some((k) => k.startsWith("sb-") && k.includes("auth-token")));

    res = await request("/account");
    const dash = await res.text();
    check("dashboard renders for the user", res.status === 200 && dash.includes("Hi, Smoke") && dash.includes(email), String(res.status));
    res = await request("/account/login");
    check("signed-in /account/login redirects to /account", res.status === 307 && location(res) === "/account", `${res.status} ${location(res)}`);

    res = await submit("/account", 'name="phone"', { name: "Smoke Tester Two", phone: "(602) 555-0100" });
    check("profile update saves", (await res.text()).includes("Your details are saved"), String(res.status));
    const updated = await admin.from("profiles").select("full_name, phone").eq("id", userId).single();
    check("profile row updated in DB", updated.data?.full_name === "Smoke Tester Two" && updated.data?.phone === "(602) 555-0100", JSON.stringify(updated.data));

    // --- Change password (signed in) ----------------------------------------
    res = await submit("/account/reset-password", 'name="confirm"', { password: newPassword, confirm: "different-1" });
    check("password confirmation mismatch rejected", (await res.text()).includes("Passwords don"), String(res.status));
    res = await submit("/account/reset-password", 'name="confirm"', { password: newPassword, confirm: newPassword });
    check("password change redirects", res.status === 303 && location(res) === "/account?password=updated", `${res.status} ${location(res)}`);

    // --- Cart ---------------------------------------------------------------
    const { data: part } = await admin.from("products").select("id, slug").eq("status", "active").gt("quantity", 0).limit(1).single();
    res = await submit(`/parts/${part!.slug}`, 'name="productId"', { productId: part!.id });
    check("add to cart sets the cart cookie", jar.get("gatp_cart")?.startsWith(part!.id) === true, `${res.status} ${jar.get("gatp_cart")}`);
    res = await request("/cart");
    const cartHtml = await res.text();
    check("cart lists the part with a request form", cartHtml.includes(`/parts/${part!.slug}`) && cartHtml.includes("Send order request"));
    check("header badge shows 1 item", cartHtml.includes('aria-label="Cart, 1 item"'));
    check("request form is prefilled from the profile", cartHtml.includes(`value="${email}"`));
    res = await submit("/cart", 'name="postalCode"', { name: "Smoke Tester Two", email, phone: "", postalCode: "85009", notes: "Smoke test, please ignore." });
    check("order request redirects to confirmation", res.status === 303 && location(res) === "/cart?sent=1", `${res.status} ${location(res)}`);
    check("cart cleared after request", !jar.has("gatp_cart"));
    res = await request("/cart?sent=1");
    check("confirmation page shows", (await res.text()).includes("Order request sent"));
    const lead = await admin.from("part_requests").select("id, part_name, part_number").eq("email", email).maybeSingle();
    check("order request stored as a lead", Boolean(lead.data?.part_name?.startsWith("Cart order request")), JSON.stringify(lead.data));
    if (lead.data) await admin.from("part_requests").delete().eq("id", lead.data.id);

    // --- Sign out -----------------------------------------------------------
    const dashPage = await request("/account");
    const signOutForm = actionFields(await dashPage.text(), "Sign out");
    const body = new FormData();
    for (const [k, v] of signOutForm) body.append(k, v);
    res = await request("/account", { method: "POST", body });
    check("sign out redirects home", res.status === 303 && location(res) === "/", `${res.status} ${location(res)}`);
    res = await request("/account");
    check("after sign out /account redirects to login", res.status === 307, String(res.status));

    res = await submit("/account/login", 'name="password"', { email, password: newPassword, next: "/cart" });
    const alert = res.status === 200 ? (/role="alert"[^>]*>(?:<svg.*?<\/svg>)?\s*([^<]+)/.exec(await res.text())?.[1] ?? "") : "";
    check("sign in with the new password honours ?next", res.status === 303 && location(res) === "/cart", `${res.status} ${location(res)} ${alert}`);
    jar.clear();

    // --- Email links (generated, not sent) ----------------------------------
    const recovery = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (recovery.error) throw new Error(`generateLink: ${recovery.error.message}`);
    res = await request(`/auth/confirm?token_hash=${recovery.data.properties.hashed_token}&type=recovery`);
    check("recovery link signs in and opens reset-password", location(res) === "/account/reset-password", `${res.status} ${location(res)}`);
    res = await request("/account/reset-password");
    check("reset form shown for the recovered session", (await res.text()).includes("Save new password"));
    res = await request(`/auth/confirm?token_hash=${recovery.data.properties.hashed_token}&type=recovery`);
    check("reused link is rejected", location(res) === "/account/login?error=link-invalid", location(res));

    jar.clear();
    const signupEmail = `smoke-signup-${stamp}@example.com`;
    const signup = await admin.auth.admin.generateLink({ type: "signup", email: signupEmail, password });
    if (signup.error) throw new Error(`generateLink signup: ${signup.error.message}`);
    const signupUser = signup.data.user.id;
    res = await request(`/auth/confirm?token_hash=${signup.data.properties.hashed_token}&type=signup&next=%2Faccount`);
    check("signup confirmation link signs in → /account?welcome=1", location(res) === "/account?welcome=1", `${res.status} ${location(res)}`);
    res = await request("/account?welcome=1");
    check("welcome notice shown", (await res.text()).includes("Your account is ready"));
    await admin.auth.admin.deleteUser(signupUser);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll account & cart checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
