/**
 * Inserts (or removes) the 3 clearly-labelled DEMO donor vehicles, without any seed products,
 * so "Currently Dismantling" has content until real vehicles are entered.
 *
 *   npm run db:demo-vehicles            # upsert
 *   npm run db:demo-vehicles -- --remove
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: [".env.local", ".env"], quiet: true });

const DEMO = [
  { stock: "DEMO-101", year: 2018, make: "kia", model: "stinger", trim: "GT", odometer: 64210, engine: "3.3L V6 Twin Turbo", transmission: "8-speed automatic", drive: "RWD", color: "HiChroma Red", acquired: "2026-11-03" },
  { stock: "DEMO-102", year: 2019, make: "chevrolet", model: "malibu", trim: "LT", odometer: 48112, engine: "1.5L I4 Turbo", transmission: "CVT", drive: "FWD", color: "Summit White", acquired: "2026-11-02" },
  { stock: "DEMO-103", year: 2015, make: "bmw", model: "3-series", trim: "328i", odometer: 91877, engine: "2.0L I4 Turbo", transmission: "8-speed automatic", drive: "RWD", color: "Jet Black", acquired: "2026-11-01" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const db = createClient(url, key, { auth: { persistSession: false } });

  if (process.argv.includes("--remove")) {
    const { error } = await db.from("donor_vehicles").delete().like("stock_number", "DEMO-%");
    if (error) throw new Error(error.message);
    console.log("Removed DEMO vehicles.");
    return;
  }

  for (const v of DEMO) {
    const { data: make, error: makeError } = await db.from("makes").select("id, models(id, slug)").eq("slug", v.make).single();
    if (makeError || !make) throw new Error(`Make ${v.make} not found. Run the import first.`);
    const models = (make.models ?? []) as { id: number; slug: string }[];
    const { error } = await db.from("donor_vehicles").upsert(
      {
        stock_number: v.stock,
        slug: `${v.year}-${v.make}-${v.model}-${v.stock.toLowerCase()}`,
        year: v.year,
        make_id: make.id,
        model_id: models.find((m) => m.slug === v.model)?.id ?? null,
        trim: v.trim,
        odometer: v.odometer,
        engine: v.engine,
        transmission: v.transmission,
        drive_type: v.drive,
        exterior_color: v.color,
        status: "dismantling",
        description: "DEMO vehicle for development. Replace with a real donor vehicle.",
        acquired_at: v.acquired,
      },
      { onConflict: "stock_number" },
    );
    if (error) throw new Error(`${v.stock}: ${error.message}`);
    console.log(`✓ ${v.stock} ${v.year} ${v.make} ${v.model}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
