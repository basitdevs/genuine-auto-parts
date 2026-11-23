import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { JsonLd, storeJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { getBusiness } from "@/lib/settings/server";
import { MaintenanceBanner } from "./maintenance-banner";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Public storefront frame: header, footer, cart drawer and store JSON-LD (not used by /admin). */
export async function SiteChrome({ children }: { children: ReactNode }) {
  const business = await getBusiness();
  return (
    <CartProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <MaintenanceBanner />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CartDrawer policies={business.policies} />
      <JsonLd data={await storeJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
    </CartProvider>
  );
}
