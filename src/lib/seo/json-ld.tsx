import { business as businessFile, isPlaceholder } from "@/content/business";
import { getBusiness } from "@/lib/settings/server";
import { env } from "@/lib/env";

type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue | undefined };

/** Renders schema.org JSON-LD. `<` is escaped so content can't break out of the script tag. */
export function JsonLd({ data }: { data: { [key: string]: JsonLdValue | undefined } }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const known = (value: string) => (isPlaceholder(value) ? undefined : value);

export async function storeJsonLd() {
  const business = await getBusiness();
  const { address } = business;
  return {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    "@id": `${env.siteUrl}/#store`,
    name: business.name,
    description: business.description,
    url: env.siteUrl,
    logo: `${env.siteUrl}/brand/logo.png`,
    image: `${env.siteUrl}/opengraph-image`,
    telephone: known(business.phone),
    email: known(business.email),
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: known(address.street),
      addressLocality: address.city,
      addressRegion: address.region,
      postalCode: known(address.postalCode),
      addressCountry: address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: business.geo.latitude, longitude: business.geo.longitude },
    hasMap: business.googleMapsUrl,
    openingHoursSpecification: business.hours.length
      ? business.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.schemaDays, opens: h.opens, closes: h.closes }))
      : undefined,
    aggregateRating: business.rating
      ? { "@type": "AggregateRating", ratingValue: business.rating.value, reviewCount: business.rating.count }
      : undefined,
    sameAs: [business.social.facebook, business.social.instagram, business.social.ebayStore].filter(
      (s): s is string => Boolean(s),
    ),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${env.siteUrl}/#website`,
    name: businessFile.name,
    url: env.siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${env.siteUrl}/parts?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}
