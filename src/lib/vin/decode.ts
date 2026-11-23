import "server-only";
import { cacheLife } from "next/cache";
import { VEHICLE_REFERENCE } from "@/lib/import/vehicle-reference";

export type DecodedVin = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
  driveType: string | null;
  makeSlug: string | null;
  modelSlug: string | null;
  label: string;
};

export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

type VpicResult = Record<string, string | null | undefined>;

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Maps NHTSA make/model names onto our catalog slugs using the importer's alias table. */
function matchCatalog(make: string | null, model: string | null) {
  if (!make) return { makeSlug: null, modelSlug: null };
  const makeRef = VEHICLE_REFERENCE.find((m) => m.aliases.some((a) => norm(a) === norm(make)) || norm(m.name) === norm(make));
  if (!makeRef) return { makeSlug: null, modelSlug: null };
  const modelNorm = model ? norm(model) : "";
  const modelRef = modelNorm
    ? makeRef.models.find((m) => norm(m.name) === modelNorm || m.aliases.some((a) => norm(a) === modelNorm)) ??
      makeRef.models.find((m) => modelNorm.startsWith(norm(m.name)) || norm(m.name).startsWith(modelNorm))
    : undefined;
  return { makeSlug: makeRef.slug, modelSlug: modelRef?.slug ?? null };
}

/** Free NHTSA vPIC decode. Cached for a long time: a VIN never changes. */
export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  "use cache";
  cacheLife("max");
  const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { Results?: VpicResult[] };
  const r = json.Results?.[0];
  if (!r) return null;

  const year = r.ModelYear ? Number(r.ModelYear) : null;
  const make = r.Make ? r.Make.trim() : null;
  const model = r.Model ? r.Model.trim() : null;
  if (!year && !make) return null;

  const displacement = r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : null;
  const cylinders = r.EngineCylinders ? `${r.EngineConfiguration?.startsWith("V") ? "V" : "L"}${r.EngineCylinders}` : null;
  const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    vin,
    year,
    make: make ? titleCase(make) : null,
    model,
    trim: r.Trim?.trim() || null,
    engine: [displacement, cylinders].filter(Boolean).join(" ") || null,
    driveType: r.DriveType?.trim() || null,
    ...matchCatalog(make, model),
    label: [year, make ? titleCase(make) : null, model, r.Trim].filter(Boolean).join(" "),
  };
}
