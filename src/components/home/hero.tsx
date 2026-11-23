import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { HeroWheel } from "@/components/brand/hero-wheel";
import { HeroMotion } from "@/components/motion/hero-motion";
import { VehicleSearch } from "@/components/search/vehicle-search";
import { Button } from "@/components/ui/button";
import { getCatalogStats, getCategoryOptions, getFitmentYears } from "@/lib/catalog/queries";
import { formatNumber } from "@/lib/format";
import { getSetting } from "@/lib/settings/server";

function Stat({ value, countTo, label }: { value: string; countTo?: number; label: string }) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-3xl leading-none font-bold tracking-tight sm:text-4xl" data-count-to={countTo}>
          {value}
        </span>
        <span className="mt-1.5 block text-xs font-medium tracking-wider text-inverse-muted uppercase">{label}</span>
      </dd>
    </div>
  );
}

export async function Hero() {
  const [stats, years, categories, home] = await Promise.all([getCatalogStats(), getFitmentYears(), getCategoryOptions(), getSetting("home")]);
  const parts = stats?.activeParts ?? 0;
  const statValue = (value: string) =>
    value === "{parts}" ? (parts > 0 ? formatNumber(parts) : "Thousands") : value === "{makes}" ? (stats?.makes ? String(stats.makes) : "30+") : value;

  return (
    <section data-hero aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-inverse text-inverse-foreground">
      <HeroMotion />
      {/* Decorative layers */}
      <div aria-hidden className="absolute inset-0 -z-10 texture-grid" />
      <div aria-hidden className="absolute inset-y-0 right-0 -z-10 w-2/3 bg-[radial-gradient(ellipse_at_70%_30%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent_60%)]" />
      <div aria-hidden className="absolute top-1/2 -right-32 -z-10 hidden -translate-y-1/2 text-inverse-foreground/[0.14] lg:block xl:-right-24">
        <div className="size-[34rem] motion-safe:animate-wheel-in">
          <HeroWheel className="size-full" />
        </div>
      </div>
      {/* Speed lines, a nod to the logo's motion streaks */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        {[18, 34, 52, 71].map((top, i) => (
          <span
            key={top}
            className="absolute left-0 h-px w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent motion-safe:animate-speed-line"
            style={{ top: `${top}%`, animationDelay: `${i * 0.7}s` }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:pt-24">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-sm border border-inverse-border bg-inverse-2/80 px-3 py-1 text-xs font-semibold tracking-wider text-inverse-muted uppercase motion-safe:animate-fade-up">
            <Wrench className="size-3.5 text-inverse-accent" aria-hidden />
            {home.heroEyebrow}
          </p>
          <h1
            id="hero-title"
            className="mt-6 font-display text-5xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl lg:text-7xl"
          >
            {home.heroTitle}
            <span className="block text-inverse-accent">{home.heroAccent}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-inverse-muted sm:text-lg">
            {home.heroText ||
              `${parts > 0 ? `${formatNumber(parts)} tested` : "Tested"} factory parts pulled from the vehicles we dismantle, inspected before they ship and backed by our parts warranty.`}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row motion-safe:animate-fade-up [animation-delay:120ms]">
            <Button asChild size="lg">
              <Link href="/parts">
                Shop all parts <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline-inverse">
              <Link href="/vehicles">See what we&apos;re dismantling</Link>
            </Button>
          </div>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {home.stats.map((s) => (
            <Stat key={s.label} value={statValue(s.value)} countTo={s.value === "{parts}" && parts ? parts : undefined} label={s.label} />
          ))}
        </dl>
      </div>

      {/* Vehicle finder */}
      <div className="relative mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="rounded-2xl border border-inverse-border bg-inverse-2/85 p-4 shadow-2xl shadow-black/50 backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="flex items-center gap-3 font-display text-2xl font-bold tracking-wide uppercase">
              <span aria-hidden className="h-6 w-1 bg-primary" />
              Find your part
            </h2>
            <p className="text-sm text-inverse-muted">Choose your vehicle to see matching parts in stock.</p>
          </div>
          <VehicleSearch years={years} categories={categories} tone="dark" />
        </div>
      </div>
    </section>
  );
}
