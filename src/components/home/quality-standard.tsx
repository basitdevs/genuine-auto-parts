import Image from "next/image";
import Link from "next/link";
import { ClipboardCheck, Gauge, PackageCheck, ScanSearch, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { getBusiness } from "@/lib/settings/server";
import { media } from "@/content/media";
import { Section } from "./section";

const STEPS = [
  { icon: ScanSearch, title: "Sourced & documented", text: "Every donor vehicle is logged by stock number, VIN and mileage, so each part is traceable." },
  { icon: Gauge, title: "Inspected & tested", text: "Parts are checked for damage, wear and function before they're listed." },
  { icon: ClipboardCheck, title: "Matched by OEM number", text: "We list the factory part number and fitment, so you can cross-check before you buy." },
  { icon: PackageCheck, title: "Packed to survive", text: "Packed and protected for the trip, with tracking on every order." },
];

export async function QualityStandard() {
  const business = await getBusiness();
  const photo = media.workshopLift;
  return (
    <Section
      id="quality"
      eyebrow="Our quality standard"
      title="Genuine parts, checked before they ship"
      description={
        <>
          OEM parts fit right the first time, and ours are checked before they leave the shop. Backed by a{" "}
          {business.policies.warrantyDays}-day parts warranty.{" "}
          <Link href="/policies/warranty" className="font-semibold text-foreground underline underline-offset-4 hover:text-primary">
            Read the warranty
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
        {/* Photo */}
        <figure className="relative min-h-80 overflow-hidden rounded-lg bg-inverse">
          <Image
            src={photo.src}
            alt={photo.alt}
            placeholder="blur"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover object-[50%_40%]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 p-6 text-inverse-foreground">
            <p className="inline-flex items-center gap-2 rounded-sm bg-primary px-2.5 py-1 text-xs font-bold tracking-wider uppercase">
              <ShieldCheck className="size-3.5" aria-hidden /> {business.policies.warrantyDays}-day warranty
            </p>
            <p className="mt-3 max-w-sm font-display text-2xl leading-tight font-bold tracking-wide uppercase">
              Pulled, inspected and tagged by our own team
            </p>
          </figcaption>
        </figure>

        {/* Steps */}
        <Reveal className="h-full">
          <ol className="grid h-full gap-4 sm:grid-cols-2">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-full border-2 border-primary bg-background text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-3xl font-extrabold text-foreground/10">0{i + 1}</span>
                </div>
                <p className="mt-4 font-display text-xl font-bold tracking-wide uppercase">{title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </Section>
  );
}
