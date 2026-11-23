import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, ShieldCheck, Truck } from "lucide-react";
import { Prose } from "@/components/content/prose";
import { PageHero } from "@/components/layout/page-hero";
import { business as businessFile } from "@/content/business";
import { getBusiness } from "@/lib/settings/server";
import { media } from "@/content/media";

export const metadata: Metadata = {
  title: "About Us",
  description: `${businessFile.name} is a ${businessFile.address.city}, ${businessFile.address.region} auto and truck dismantler selling tested, genuine OEM used parts nationwide.`,
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const business = await getBusiness();
  const { warrantyDays, returnDays } = business.policies;
  return (
    <>
      <PageHero title="About us" description="Genuine OEM parts from vehicles we dismantle ourselves." crumbs={[{ label: "About" }]} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <Prose>
          <p>
            <strong>{business.name}</strong> is an auto and truck dismantler based in {business.address.city}, {business.address.region}. We buy
            end-of-life, damaged and high-mileage vehicles, carefully take them apart, and sell the good parts, so working factory parts get a
            second life instead of a trip to the crusher.
          </p>

          <h2>Why genuine OEM used parts?</h2>
          <p>
            Original equipment (OEM) parts were designed for your exact vehicle. A used OEM part usually fits and performs better than a
            new aftermarket copy, and costs a fraction of a new part from the dealer.
          </p>
          <ul>
            <li><strong>Factory fit:</strong> same part number your vehicle left the factory with.</li>
            <li><strong>Lower cost:</strong> typically far below dealer prices for new OEM parts.</li>
            <li><strong>Better for the planet:</strong> reusing parts saves the energy and materials needed to make new ones.</li>
          </ul>

          <h2>How we work</h2>
          <ol>
            <li><strong>Every vehicle is logged</strong> with a stock number, VIN and mileage, so each part is traceable to its donor vehicle.</li>
            <li><strong>Parts are inspected</strong> for damage and wear before they are listed.</li>
            <li><strong>Listings show the OEM part number and fitment</strong>, so you can cross-check against your original part.</li>
            <li><strong>Orders are packed in-house</strong> and shipped nationwide with tracking.</li>
          </ol>

          <h2>Our promise</h2>
          <p>
            Every part is covered by our <Link href="/policies/warranty">{warrantyDays}-day parts warranty</Link>, and most parts can be returned
            within {returnDays} days. See our <Link href="/policies/returns">returns policy</Link>. Not sure a part fits? <Link href="/contact?topic=fitment">Send us your VIN</Link>{" "}
            and we&apos;ll check before you buy.
          </p>

          <h2>Have a vehicle to sell?</h2>
          <p>
            We buy cars, trucks and SUVs in any condition. <Link href="/sell-your-car">Get an estimate</Link> and we&apos;ll arrange pickup.
          </p>
        </Prose>

        <aside className="space-y-4 lg:sticky lg:top-40">
          <figure className="overflow-hidden rounded-lg border bg-card">
            <Image
              src={media.engineBay.src}
              alt={media.engineBay.alt}
              placeholder="blur"
              sizes="(min-width: 1024px) 400px, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="px-4 py-3 text-xs text-muted-foreground">Genuine factory parts, pulled and inspected before they ship.</figcaption>
          </figure>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {[
              { icon: MapPin, text: `Based in ${business.address.city}, ${business.address.region}` },
              { icon: BadgeCheck, text: "Tested genuine OEM parts" },
              { icon: ShieldCheck, text: `${warrantyDays}-day parts warranty · ${returnDays}-day returns` },
              { icon: Truck, text: "Nationwide shipping or same-day local pickup" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
