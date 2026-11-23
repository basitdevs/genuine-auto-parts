import { Suspense } from "react";
import type { Metadata } from "next";
import { Clock, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";
import { PageHero } from "@/components/layout/page-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { business as businessFile, isPlaceholder } from "@/content/business";
import { getBusiness } from "@/lib/settings/server";
import { getProductTitleBySku } from "@/lib/catalog/queries";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/forms/schemas";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Contact ${businessFile.name}: part requests, fitment checks, offers and order questions.`,
  alternates: { canonical: "/contact" },
};

async function ContactFormFromParams({ searchParams }: { searchParams: PageProps<"/contact">["searchParams"] }) {
  const params = await searchParams;
  const rawTopic = typeof params.topic === "string" ? params.topic : "";
  const topic = (CONTACT_TOPICS.some((t) => t.value === rawTopic) ? rawTopic : "general") as ContactTopic;
  const sku = typeof params.sku === "string" && /^[A-Za-z0-9-]{1,80}$/.test(params.sku) ? params.sku : "";
  const productTitle = sku ? await getProductTitleBySku(sku) : null;
  return <ContactForm key={`${topic}:${sku}`} topic={topic} sku={sku} productTitle={productTitle ?? undefined} />;
}

export default async function ContactPage(props: PageProps<"/contact">) {
  const business = await getBusiness();
  const { address } = business;
  return (
    <>
      <PageHero
        title="Contact us"
        description="Need a part we haven't listed, want to confirm fitment, or have a question about an order? We're here to help."
        crumbs={[{ label: "Contact" }]}
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="contact-form-title" className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
          <h2 id="contact-form-title" className="mb-6 font-display text-2xl font-bold tracking-wide uppercase">Send us a message</h2>
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-32" /></div>}>
            <ContactFormFromParams searchParams={props.searchParams} />
          </Suspense>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl bg-inverse p-6 text-inverse-foreground">
            <h2 className="font-display text-xl font-bold tracking-wide uppercase">{isPlaceholder(business.phone) ? "Visit us" : "Visit or call"}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-inverse-accent" aria-hidden />
                <span>
                  {!isPlaceholder(address.street) ? <span className="block">{address.street}</span> : null}
                  {address.city}, {address.region}
                  {!isPlaceholder(address.postalCode) ? ` ${address.postalCode}` : ""}
                </span>
              </li>
              {!isPlaceholder(business.phone) ? (
                <li className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-inverse-accent" aria-hidden />
                  <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`} className="hover:text-inverse-accent">{business.phone}</a>
                </li>
              ) : null}
              {!isPlaceholder(business.email) ? (
                <li className="flex items-center gap-3">
                  <Mail className="size-4 shrink-0 text-inverse-accent" aria-hidden />
                  <a href={`mailto:${business.email}`} className="hover:text-inverse-accent">{business.email}</a>
                </li>
              ) : null}
              {business.hours.length ? (
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-inverse-accent" aria-hidden />
                  <span>
                    {business.hours.map((h) => (
                      <span key={h.days} className="block">{h.days}: {h.opens}–{h.closes}</span>
                    ))}
                  </span>
                </li>
              ) : null}
            </ul>
            <a
              href={business.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold tracking-wide text-inverse-accent uppercase hover:text-inverse-foreground"
            >
              Get directions <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <iframe
              title={`Map showing ${business.name}`}
              src={business.googleMapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-[4/3] w-full border-0"
            />
          </div>
        </aside>
      </div>
    </>
  );
}
