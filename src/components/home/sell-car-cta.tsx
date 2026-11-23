import Link from "next/link";
import { ArrowRight, BadgeDollarSign, CalendarCheck, Truck } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { media } from "@/content/media";

const STEPS = [
  { icon: CalendarCheck, title: "Tell us about it", text: "Year, make, model, VIN and condition. Takes two minutes." },
  { icon: BadgeDollarSign, title: "Get a fair offer", text: "We review it and get back to you with an offer." },
  { icon: Truck, title: "We handle pickup", text: "Running or not, we arrange the pickup." },
];

export function SellCarCta() {
  return (
    <section aria-labelledby="sell-title" className="relative isolate overflow-hidden bg-primary text-primary-foreground">
      {/* Photo duotone: grayscale salvage-yard shot multiplied into the brand red */}
      <Image
        src={media.salvageYard.src}
        alt=""
        placeholder="blur"
        fill
        sizes="100vw"
        className="-z-20 object-cover opacity-90 mix-blend-multiply grayscale contrast-125"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-primary via-primary/75 to-primary/5" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,transparent_58%,color-mix(in_srgb,var(--brand-ink)_45%,transparent)_58%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.25em] uppercase opacity-90">We buy used cars</p>
          <h2 id="sell-title" className="font-display text-4xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-5xl">
            Turn your old car into cash
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed opacity-90">
            Wrecked, high-mileage or just sitting? We buy vehicles for dismantling and give their parts a second life.
          </p>
          <Button asChild size="lg" variant="dark" className="mt-8">
            <Link href="/sell-your-car">
              Get my estimate <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-4 rounded-lg bg-inverse/85 p-5 text-inverse-foreground backdrop-blur-sm">
              <span className="font-display text-3xl leading-none font-extrabold text-inverse-accent">0{i + 1}</span>
              <div>
                <p className="flex items-center gap-2 font-display text-lg font-bold tracking-wide uppercase">
                  <Icon className="size-4 text-inverse-accent" aria-hidden /> {title}
                </p>
                <p className="mt-1 text-sm text-inverse-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
