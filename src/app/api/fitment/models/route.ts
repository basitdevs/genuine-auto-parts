import type { NextRequest } from "next/server";
import { getFitmentModels } from "@/lib/catalog/queries";

/** GET /api/fitment/models?make=bmw&year=2015 -> models with active parts. */
export async function GET(request: NextRequest) {
  const make = request.nextUrl.searchParams.get("make") ?? "";
  const yearParam = request.nextUrl.searchParams.get("year");
  if (!/^[a-z0-9-]{1,60}$/.test(make)) return Response.json([], { status: 400 });
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const options = await getFitmentModels(make, year);
  return Response.json(options, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
