/**
 * Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL, in order,
 * tracking what ran in public._app_migrations so re-runs are safe.
 *
 *   SUPABASE_DB_URL = Supabase Dashboard -> Connect -> "Session pooler" connection string
 *   npm run db:apply
 *
 * (Alternative without a connection string: paste supabase/setup.sql into the SQL Editor.)
 */
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is not set. Add it to .env.local, or paste supabase/setup.sql into the SQL Editor.");
    process.exit(1);
  }
  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => undefined });
  try {
    await sql`create table if not exists public._app_migrations (name text primary key, applied_at timestamptz not null default now())`;
    await sql`alter table public._app_migrations enable row level security`; // not exposed via the API
    const done = new Set((await sql<{ name: string }[]>`select name from public._app_migrations`).map((r) => r.name));
    const dir = "supabase/migrations";
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) {
        console.log(`- ${file} (already applied)`);
        continue;
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(dir, file), "utf8"));
        await tx`insert into public._app_migrations (name) values (${file})`;
      });
      console.log(`✓ ${file}`);
    }
    // Ask PostgREST to pick up the new tables/functions immediately.
    await sql`notify pgrst, 'reload schema'`;
    console.log("Done.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
