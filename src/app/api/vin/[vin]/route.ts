import { decodeVin, VIN_RE } from "@/lib/vin/decode";

/** GET /api/vin/WBA8E9G51GNT12345 -> decoded year/make/model mapped to catalog slugs. */
export async function GET(_request: Request, ctx: RouteContext<"/api/vin/[vin]">) {
  const { vin: raw } = await ctx.params;
  const vin = raw.toUpperCase();
  if (!VIN_RE.test(vin)) {
    return Response.json({ error: "A VIN has 17 characters (no I, O or Q)." }, { status: 400 });
  }
  try {
    const decoded = await decodeVin(vin);
    if (!decoded) return Response.json({ error: "We couldn't decode that VIN. Please check it and try again." }, { status: 404 });
    return Response.json(decoded, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return Response.json({ error: "VIN service is unavailable right now. Please pick your vehicle manually." }, { status: 502 });
  }
}
