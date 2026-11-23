import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { BASE, serviceClient, sessionCookies, STATE_DIR, statePath, type Fixture, type Role } from "./helpers";

/** Creates throwaway admin / staff / customer users and their browser sessions. */
export default async function globalSetup() {
  const db = serviceClient();
  mkdirSync(STATE_DIR, { recursive: true });
  const tag = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  const users = {} as Fixture["users"];

  for (const role of ["admin", "staff", "customer"] as Role[]) {
    const email = `e2e-${role}-${tag}@genuine-auto-e2e.dev`;
    const password = `E2e!${randomBytes(9).toString("base64url")}`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `E2E ${role}` } });
    if (error || !data.user) throw new Error(`createUser ${role}: ${error?.message}`);
    // The auth trigger creates the profile; make sure it exists and set the role.
    const up = await db.from("profiles").upsert({ id: data.user.id, email, full_name: `E2E ${role}`, role }, { onConflict: "id" });
    if (up.error) throw new Error(`profile ${role}: ${up.error.message}`);
    users[role] = { id: data.user.id, email, password };
    const cookies = await sessionCookies(email, password);
    writeFileSync(statePath(role), JSON.stringify({ cookies, origins: [] }, null, 2));
  }

  const probe = await db.from("site_settings").select("key").limit(1);
  const fixture: Fixture = { users, migrated: !probe.error, createdAt: new Date().toISOString() };
  writeFileSync(join(STATE_DIR, "fixture.json"), JSON.stringify(fixture, null, 2));
  console.log(`[e2e] ${BASE} · users created (${tag}) · migration 0600 ${fixture.migrated ? "applied" : "NOT applied: dependent tests will be skipped"}`);
}
