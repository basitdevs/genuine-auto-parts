import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { RichText } from "@/components/content/rich-text";
import { PageHero } from "@/components/layout/page-hero";
import { builtInFaq, faqPlainText } from "@/content/faq";
import { getBusiness, getSetting, getShippingConfig } from "@/lib/settings/server";
import { JsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about fitment, part numbers, shipping, warranty and returns for genuine OEM used auto parts.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const [business, shippingConfig, faqSettings] = await Promise.all([getBusiness(), getShippingConfig(), getSetting("faq")]);
  // Admin → Content → FAQ replaces the built-in list once saved.
  const custom = faqSettings.groups.filter((g) => g.items.length > 0);
  const faqs = custom.length
    ? custom
    : builtInFaq({
        warrantyDays: business.policies.warrantyDays,
        returnDays: business.policies.returnDays,
        handlingTime: shippingConfig.handlingTime,
        city: business.address.city,
        region: business.address.region,
      });

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.flatMap((g) => g.items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: faqPlainText(f.a) } }))),
  };

  return (
    <>
      <JsonLd data={faqLd} />
      <PageHero title="Frequently asked questions" description="Fitment, shipping, warranty and returns: the answers to what customers ask most." crumbs={[{ label: "FAQ" }]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="max-w-3xl space-y-10">
          {faqs.map((group) => (
            <section key={group.group} aria-labelledby={`faq-${group.group}`}>
              <h2 id={`faq-${group.group}`} className="mb-3 font-display text-2xl font-bold tracking-wide uppercase">{group.group}</h2>
              <div className="divide-y rounded-lg border bg-card">
                {group.items.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <RichText
                      source={f.a}
                      className="mt-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_p+p]:mt-2 [&_strong]:text-foreground"
                    />
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
