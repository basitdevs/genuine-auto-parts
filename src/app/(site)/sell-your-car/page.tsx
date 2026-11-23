import type { Metadata } from "next";
import { BadgeDollarSign, CalendarCheck, CarFront, CircleCheck, Truck } from "lucide-react";
import { SellCarForm } from "@/components/forms/sell-car-form";
import { PageHero } from "@/components/layout/page-hero";
import { business } from "@/content/business";

export const metadata: Metadata = {
  title: "Sell Your Car for Cash",
  description: `Sell your used, damaged or non-running car or truck to ${business.name} in ${business.address.city}, ${business.address.region}. Get an offer and free pickup.`,
  alternates: { canonical: "/sell-your-car" },
};

const STEPS = [
  { icon: CalendarCheck, title: "Send the details", text: "Fill in the form: year, make, model, VIN and condition." },
  { icon: BadgeDollarSign, title: "Get an offer", text: "We review it and come back with a fair cash offer." },
  { icon: Truck, title: "We pick it up", text: "Accept the offer and we arrange pickup and paperwork." },
];

const WE_BUY = ["Running or non-running", "Accident damaged", "High mileage", "Failed inspection", "Cars, trucks & SUVs", "Most makes & models"];

export default function SellYourCarPage() {
  return (
    <>
      <PageHero
        title="Sell your car"
        description="Turn a car you no longer need into cash. We buy vehicles for dismantling and give their parts a second life."
        crumbs={[{ label: "Sell your car" }]}
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="sell-form-title" className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
          <h2 id="sell-form-title" className="font-display text-2xl font-bold tracking-wide uppercase">Get your estimate</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Takes about two minutes. Fields marked * are required.</p>
          <SellCarForm />
        </section>

        <aside className="space-y-6 lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-xl bg-inverse p-6 text-inverse-foreground">
            <h2 className="font-display text-xl font-bold tracking-wide uppercase">How it works</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold">{i + 1}</span>
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 text-inverse-accent" aria-hidden /> {title}
                    </p>
                    <p className="text-sm text-inverse-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-wide uppercase">
              <CarFront className="size-5 text-primary" aria-hidden /> What we buy
            </h2>
            <ul className="mt-4 grid gap-2 text-sm">
              {WE_BUY.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CircleCheck className="size-4 text-success" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
