import Link from "next/link";
import { cacheLife } from "next/cache";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { footerNav } from "@/config/site";
import { isPlaceholder } from "@/content/business";
import { getBusiness } from "@/lib/settings/server";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export async function SiteFooter() {
  const business = await getBusiness();
  const { address } = business;
  const streetKnown = !isPlaceholder(address.street);

  return (
    <footer className="relative overflow-hidden bg-inverse text-inverse-foreground">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_2fr]">
        <div className="max-w-sm">
          <Logo tone="light" className="w-40" />
          <p className="mt-5 text-sm leading-relaxed text-inverse-muted">{business.description}</p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-inverse-accent" aria-hidden />
              <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-inverse-accent">
                {streetKnown ? `${address.street}, ` : ""}
                {address.city}, {address.region}
                {isPlaceholder(address.postalCode) ? "" : ` ${address.postalCode}`}
                <span className="block text-xs text-inverse-muted">Open in Google Maps</span>
              </a>
            </li>
            {!isPlaceholder(business.phone) ? (
              <li className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-inverse-accent" aria-hidden />
                <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`} className="hover:text-inverse-accent">
                  {business.phone}
                </a>
              </li>
            ) : null}
            {!isPlaceholder(business.email) ? (
              <li className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-inverse-accent" aria-hidden />
                <a href={`mailto:${business.email}`} className="hover:text-inverse-accent">
                  {business.email}
                </a>
              </li>
            ) : null}
            {business.hours.length ? (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-inverse-accent" aria-hidden />
                <span>
                  {business.hours.map((h) => (
                    <span key={h.days} className="block">
                      {h.days}: {h.opens}–{h.closes}
                    </span>
                  ))}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-display text-sm font-bold tracking-[0.2em] text-inverse-foreground uppercase">{group.title}</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-inverse-muted transition-colors hover:text-inverse-foreground">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-inverse-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-inverse-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © <CopyrightYear /> {business.name}. All rights reserved.
          </p>
          <p>Genuine OEM used parts · Tested before shipping · Nationwide shipping</p>
        </div>
      </div>
    </footer>
  );
}
