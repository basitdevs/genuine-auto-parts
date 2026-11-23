import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { business } from "@/content/business";

export const alt = `${business.name}: genuine OEM used auto & truck parts`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo-light.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0b0b0c",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", height: 10, width: 220, background: "#c01426" }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={logoSrc} width={471} height={241} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -1, textTransform: "uppercase" }}>Genuine OEM parts.</div>
          <div style={{ fontSize: 68, fontWeight: 800, color: "#ef3b48", textTransform: "uppercase" }}>Recycler prices.</div>
          <div style={{ marginTop: 16, fontSize: 28, color: "#a1a1aa" }}>
            Tested used parts · {business.address.city}, {business.address.region} · Shipping nationwide
          </div>
        </div>
      </div>
    ),
    size,
  );
}
