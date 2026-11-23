import type { ReactNode } from "react";
import { BadgeCheck, CarFront, PackageCheck, Zap } from "lucide-react";

const PERKS = [
  { icon: PackageCheck, title: "Track your orders", text: "Order status and tracking in one place." },
  { icon: CarFront, title: "Your garage, saved", text: "Shop parts that fit the vehicle you work on." },
  { icon: Zap, title: "Faster checkout", text: "Your contact details are filled in for you." },
  { icon: BadgeCheck, title: "Genuine OEM parts", text: "Tested parts from vehicles we dismantle in-house." },
];

/** Split layout for sign-in / sign-up / password pages: brand panel + form card. */
export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-stretch">
        <aside className="texture-tread relative hidden overflow-hidden rounded-xl bg-inverse p-10 text-inverse-foreground lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="font-display text-sm font-bold tracking-[0.2em] text-inverse-accent uppercase">Your account</p>
            <p className="mt-3 font-display text-4xl leading-tight font-extrabold tracking-tight uppercase">
              Genuine parts.
              <br />
              Less guesswork.
            </p>
          </div>
          <ul className="mt-10 grid gap-6">
            {PERKS.map(({ icon: Icon, title: perk, text }) => (
              <li key={perk} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-inverse-foreground/10 text-inverse-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{perk}</span>
                  <span className="text-sm text-inverse-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-10">
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase sm:text-4xl">{title}</h1>
          <p className="mt-1.5 mb-7 text-sm text-muted-foreground">{description}</p>
          {children}
          {footer ? <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </section>
      </div>
    </div>
  );
}

export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="grid gap-4" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-1.5">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-10 rounded-md bg-muted" />
        </div>
      ))}
      <div className="h-12 rounded-md bg-muted" />
    </div>
  );
}
