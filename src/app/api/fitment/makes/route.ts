import type { NextRequest } from "next/server";
import { getFitmentMakes } from "@/lib/catalog/queries";

/** GET /api/fitment/makes?year=2015 -> makes that have active parts for that year. */
export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const options = await getFitmentMakes(year);
  return Response.json(options, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
