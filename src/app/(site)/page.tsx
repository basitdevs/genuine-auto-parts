import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/catalog/product-grid";
import { CurrentlyDismantling } from "@/components/home/currently-dismantling";
import { Hero } from "@/components/home/hero";
import { NewestArrivals } from "@/components/home/newest-arrivals";
import { Newsletter } from "@/components/home/newsletter";
import { QualityStandard } from "@/components/home/quality-standard";
import { Reviews } from "@/components/home/reviews";
import { SellCarCta } from "@/components/home/sell-car-cta";
import { ShopByCategory } from "@/components/home/shop-by-category";
import { ShopByMake } from "@/components/home/shop-by-make";
import { TrustPoints } from "@/components/home/trust-points";
import { SectionBoundary } from "@/components/section-boundary";
import { getSetting } from "@/lib/settings/server";

export default async function HomePage() {
  const { sections: show } = await getSetting("home");
  return (
    <>
      <SectionBoundary label="Search">
        <Hero />
      </SectionBoundary>
      <TrustPoints />
      {show.makes ? (
        <SectionBoundary label="Makes">
        <ShopByMake />
      </SectionBoundary>
      ) : null}
      {show.categories ? (
        <SectionBoundary label="Categories">
        <ShopByCategory />
      </SectionBoundary>
      ) : null}
      {show.newest ? (
        <SectionBoundary label="Newest arrivals">
        <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6"><ProductGridSkeleton /></div>}>
          <NewestArrivals />
        </Suspense>
      </SectionBoundary>
      ) : null}
      {show.vehicles ? (
        <SectionBoundary label="Vehicles">
        <CurrentlyDismantling />
      </SectionBoundary>
      ) : null}
      {show.sellCar ? <SellCarCta /> : null}
      {show.quality ? <QualityStandard /> : null}
      {show.reviews ? <Reviews /> : null}
      {show.newsletter ? <Newsletter /> : null}
    </>
  );
}
