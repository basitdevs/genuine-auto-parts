import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { partsHref } from "@/lib/search/params";
import type { VehicleCard as VehicleCardData } from "@/lib/catalog/types";
import { PartImage } from "./part-image";

export function VehicleCard({ vehicle }: { vehicle: VehicleCardData }) {
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const specs: [string, string | null][] = [
    ["Odometer", vehicle.odometer !== null ? `${formatNumber(vehicle.odometer)} mi` : null],
    ["Engine", vehicle.engine],
    ["Transmission", vehicle.transmission],
    ["Drive", vehicle.driveType],
    ["Color", vehicle.color],
  ];
  const partsUrl = partsHref({}, { vehicle: vehicle.stockNumber });

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-inverse-border bg-inverse-2 text-inverse-foreground transition-colors hover:border-inverse-foreground/30">
      <div className="relative">
        <PartImage image={vehicle.image} icon="car-front" sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" className="bg-inverse-3" />
        <span className="absolute top-3 left-3 rounded-sm bg-primary px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-primary-foreground">
          STOCK #{vehicle.stockNumber}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl leading-tight font-bold tracking-wide uppercase">
          <Link href={`/vehicles/${vehicle.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {specs
            .filter((s): s is [string, string] => Boolean(s[1]))
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] tracking-wider text-inverse-muted uppercase">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
        </dl>
        <div className="mt-auto pt-5">
          <Link
            href={partsUrl}
            className="relative z-10 inline-flex items-center gap-2 text-sm font-bold tracking-wide text-inverse-accent uppercase hover:text-inverse-foreground"
          >
            View {vehicle.partsCount > 0 ? `${vehicle.partsCount} ` : ""}parts
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
