import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, Phone, Truck, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CartTrigger } from "@/components/cart/cart-trigger";
import { isPlaceholder } from "@/content/business";
import { getBusiness } from "@/lib/settings/server";
import { cartCount, readCart } from "@/lib/cart/cookie";
import { getCategoryOptions, getFitmentYears } from "@/lib/catalog/queries";
import { HeaderSearch } from "./header-search";
import { MainNav, NavList } from "./main-nav";
import { MobileMenu } from "./mobile-menu";

/** Reads only the cart cookie (no database call), so it's cheap on every page. */
async function CartLinkWithCount() {
  return <CartTrigger count={cartCount(await readCart())} />;
}

export async function SiteHeader() {
  const [years, categories, business] = await Promise.all([getFitmentYears(), getCategoryOptions(), getBusiness()]);
  const hasPhone = !isPlaceholder(business.phone);

  return (
    <header className="sticky top-0 z-40 bg-inverse text-inverse-foreground">
      {/* Utility bar */}
      <div className="hidden border-b border-inverse-border bg-inverse-2 md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs text-inverse-muted sm:px-6">
          <ul className="flex items-center gap-5">
            <li className="inline-flex items-center gap-1.5">
              <Truck className="size-3.5 text-inverse-accent" aria-hidden /> Nationwide shipping
            </li>
            <li className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-inverse-accent" aria-hidden /> Tested genuine OEM parts
            </li>
            <li className="hidden items-center gap-1.5 lg:inline-flex">
              <MapPin className="size-3.5 text-inverse-accent" aria-hidden /> {business.address.city}, {business.address.region}
            </li>
          </ul>
          {hasPhone ? (
            <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 font-semibold text-inverse-foreground hover:text-inverse-accent">
              <Phone className="size-3.5" aria-hidden /> {business.phone}
            </a>
          ) : (
            <Link href="/contact" className="inline-flex items-center gap-1.5 font-semibold text-inverse-foreground hover:text-inverse-accent">
              <Phone className="size-3.5" aria-hidden /> Contact us
            </Link>
          )}
        </div>
      </div>

      {/* Main bar */}
      <div className="relative border-b border-inverse-border">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Logo tone="light" eager className="w-28 sm:w-36" />
          <div className="hidden flex-1 md:flex">
            <HeaderSearch years={years} categories={categories} />
          </div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link
              href="/account"
              aria-label="Account"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-inverse-foreground/10"
            >
              <UserRound className="size-5" aria-hidden />
            </Link>
            <Suspense fallback={<CartTrigger count={0} />}>
              <CartLinkWithCount />
            </Suspense>
            <MobileMenu />
          </div>
        </div>
        {/* Mobile search row */}
        <div className="px-4 pb-3 md:hidden">
          <HeaderSearch years={years} categories={categories} />
        </div>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Main" className="hidden bg-inverse lg:block">
        <div className="mx-auto max-w-7xl px-3 sm:px-3">
          <Suspense fallback={<NavList />}>
            <MainNav />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
