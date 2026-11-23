import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fixture, serviceClient, STATE_DIR } from "./helpers";

/** Deletes the throwaway users and anything the tests created. */
export default async function globalTeardown() {
  if (!existsSync(join(STATE_DIR, "fixture.json"))) return;
  const f = fixture();
  const db = serviceClient();
  const emails = Object.values(f.users).map((u) => u.email);
  await db.from("orders").delete().in("email", ["e2e-order@genuine-auto-e2e.dev", ...emails]);
  for (const u of Object.values(f.users)) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.warn(`[e2e] could not delete ${u.email}: ${error.message}`);
  }
  rmSync(STATE_DIR, { recursive: true, force: true });
  console.log("[e2e] test users removed");
}
