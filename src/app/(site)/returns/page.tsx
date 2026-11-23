import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, PackageCheck, ShieldCheck } from "lucide-react";
import { ReturnForm } from "@/components/forms/return-form";
import { PageHero } from "@/components/layout/page-hero";
import { business as businessFile } from "@/content/business";
import { getBusiness } from "@/lib/settings/server";

export const metadata: Metadata = {
  title: "Start a Return",
  description: `Request a return for a part bought from ${businessFile.name}. Easy returns on most parts.`,
  alternates: { canonical: "/returns" },
};

export default async function ReturnsPage() {
  const business = await getBusiness();
  const { returnDays, warrantyDays } = business.policies;
  const points = [
    { icon: ClipboardList, title: `${returnDays}-day returns`, text: "Most parts can be returned within the return window from delivery." },
    { icon: ShieldCheck, title: `${warrantyDays}-day warranty`, text: "Defective parts are replaced or refunded under our parts warranty." },
    { icon: PackageCheck, title: "Authorize first", text: "Submit this form and wait for return instructions before shipping anything back." },
  ];

  return (
    <>
      <PageHero
        title="Start a return"
        description="Something not right? Tell us about it and we'll sort it out quickly."
        crumbs={[{ label: "Returns" }]}
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="return-form-title" className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
          <h2 id="return-form-title" className="font-display text-2xl font-bold tracking-wide uppercase">Return request</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Enter your order or invoice number so we can find your purchase.</p>
          <ReturnForm />
        </section>
        <aside className="space-y-4 lg:sticky lg:top-40 lg:self-start">
          {points.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-xl border p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
          <p className="px-1 text-sm text-muted-foreground">
            Full details in our{" "}
            <Link href="/policies/returns" className="font-semibold text-foreground underline underline-offset-2 hover:text-primary">
              returns policy
            </Link>
            .
          </p>
        </aside>
      </div>
    </>
  );
}
