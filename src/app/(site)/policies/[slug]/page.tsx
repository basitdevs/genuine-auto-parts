import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LastUpdated, Prose } from "@/components/content/prose";
import { PageHero } from "@/components/layout/page-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { RichText } from "@/components/content/rich-text";
import { isPlaceholder } from "@/content/business";
import type { ShippingConfig } from "@/content/shipping";
import { getBusiness, getSetting, getShippingConfig, type SiteBusiness } from "@/lib/settings/server";
import { POLICY_SLUGS, type PolicySlug } from "@/config/policies";
import { GARAGE_COOKIE } from "@/config/site";

type Ctx = { business: SiteBusiness; shippingConfig: ShippingConfig };
type Policy = { title: string; description: string; body: (ctx: Ctx) => ReactNode };

const contactLine = (business: SiteBusiness) => (
  <>
    Questions? <Link href="/contact">Contact us</Link>
    {!isPlaceholder(business.email) ? <> or email <a href={`mailto:${business.email}`}>{business.email}</a></> : null}.
  </>
);

const POLICIES: Record<PolicySlug, Policy> = {
  shipping: {
    title: "Shipping & Delivery",
    description: "How and when your parts ship, carriers, handling times and freight items.",
    body: ({ business, shippingConfig }: Ctx) => (
      <>
        <h2>Processing time</h2>
        <p>Orders are packed in-house and usually ship within <strong>{shippingConfig.handlingTime}</strong> after payment clears. You&apos;ll receive a tracking number by email when your order ships.</p>
        <h2>Shipping cost</h2>
        <p>Shipping is based on the part&apos;s size and weight and your delivery address. We confirm the exact cost with you before you pay.</p>
        <h2>Freight items</h2>
        <p>{shippingConfig.freightMessage} Freight items include large or heavy parts such as engines, transmissions, doors, hoods and bumpers. Freight is usually delivered to a business address or a carrier terminal; residential delivery and liftgate service may cost extra.</p>
        <h2>Where we ship</h2>
        <p>We ship within the United States. Contact us before ordering for Alaska, Hawaii, U.S. territories or international destinations.</p>
        <h2>Damaged or missing packages</h2>
        <p>Inspect your package on arrival. If it&apos;s damaged, take photos of the box and the part and <Link href="/returns">start a return request</Link> within 48 hours so we can file a claim with the carrier.</p>
        <h2>Local pickup</h2>
        <p>Prefer to pick up? Many customers collect their parts the same day from our yard in {business.address.city}, {business.address.region}. <Link href="/contact">Contact us</Link> to make sure your part is ready when you arrive.</p>
      </>
    ),
  },
  returns: {
    title: "Returns & Refunds",
    description: "Return windows, eligible items, refunds and how to start a return.",
    body: ({ business }: Ctx) => (
      <>
        <h2>{business.policies.returnDays}-day returns</h2>
        <p>Most parts can be returned within <strong>{business.policies.returnDays} days of delivery</strong>. Parts must be in the same condition you received them, not installed, disassembled or modified, with any markings, labels or paint marks we applied left intact.</p>
        <h2>How to return a part</h2>
        <ol>
          <li><Link href="/returns">Submit a return request</Link> with your order or invoice number and the reason.</li>
          <li>We&apos;ll email return instructions and a return authorization number. <strong>Please don&apos;t ship anything back before you receive them</strong>; unauthorized returns can&apos;t be accepted.</li>
          <li>Pack the part securely and ship it with tracking.</li>
        </ol>
        <h2>Refunds</h2>
        <p>Once we receive and inspect the part, we refund the original payment method, typically within 5–10 business days. Original shipping charges are refundable only if we made an error or the part was defective or not as described.</p>
        <h2>Return shipping</h2>
        <ul>
          <li><strong>Our error, defective or not as described:</strong> we cover return shipping.</li>
          <li><strong>Ordered wrong part / no longer needed:</strong> the buyer pays return shipping, and a restocking fee may apply.</li>
        </ul>
        <h2>Non-returnable items</h2>
        <ul>
          <li>Parts that have been installed, disassembled, modified or damaged after delivery.</li>
          <li>Electrical parts that have been programmed, coded or plugged into a vehicle, unless defective.</li>
          <li>Items sold &quot;as-is&quot; or &quot;for parts&quot;, as stated on the listing.</li>
        </ul>
        <p>Defective parts are handled under our <Link href="/policies/warranty">warranty</Link>. {contactLine(business)}</p>
      </>
    ),
  },
  warranty: {
    title: "Warranty",
    description: "What our parts warranty covers, for how long, and how to make a claim.",
    body: ({ business }: Ctx) => (
      <>
        <h2>{business.policies.warrantyDays}-day parts warranty</h2>
        <p>Parts we sell are warranted to be free from defects that prevent normal operation for <strong>{business.policies.warrantyDays} days from the delivery date</strong>. If a covered part fails, we&apos;ll replace it with an equivalent part or refund the purchase price, at our option.</p>
        <h2>What&apos;s not covered</h2>
        <ul>
          <li>Labor, installation, towing, rental cars, fluids or other incidental and consequential costs.</li>
          <li>Damage from improper installation, accidents, misuse, overheating, lack of maintenance, or use in racing or off-road competition.</li>
          <li>Wear items and normal wear, and parts sold &quot;as-is&quot; or &quot;for parts&quot;.</li>
          <li>Parts with removed or altered identification marks.</li>
        </ul>
        <h2>Installation requirements</h2>
        <p>Have parts installed by a qualified technician. For engines and transmissions, follow the manufacturer&apos;s procedures: replace fluids, filters and gaskets, and fix the cause of the original failure before installing.</p>
        <h2>Safety systems</h2>
        <p>Airbags, seat belts, pretensioners and other SRS components must be installed by a qualified technician.</p>
        <h2>How to make a claim</h2>
        <p><Link href="/returns">Submit a return request</Link> with your order number and a description of the problem, including any diagnostic codes or shop report. Keep the part and its markings intact until we&apos;ve reviewed the claim.</p>
        <p>{contactLine(business)}</p>
      </>
    ),
  },
  privacy: {
    title: "Privacy Policy",
    description: "What we collect, why, and how we protect your information.",
    body: ({ business }: Ctx) => (
      <>
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Information you give us</strong> in forms: name, email, phone, vehicle details, VIN, order numbers and messages (sell-your-car, returns, contact, part requests).</li>
          <li><strong>Newsletter sign-ups:</strong> your email address.</li>
          <li><strong>Orders:</strong> the parts you request, your contact details and shipping address. Card payments are handled by our payment processor; we never see or store full card numbers.</li>
          <li><strong>Technical data:</strong> to block spam, we store a one-way, salted hash of your IP address for a short time. We don&apos;t store raw IP addresses with your form submissions.</li>
        </ul>
        <h2>Cookies</h2>
        <ul>
          <li><strong>My Garage</strong> (<code>{GARAGE_COOKIE}</code>): remembers the vehicle you last searched for, for up to one year. It contains only year/make/model.</li>
          <li><strong>Cart:</strong> remembers the parts in your cart for up to 30 days. It contains only part IDs and quantities.</li>
          <li><strong>Sign-in cookies:</strong> keep you signed in to your customer account.</li>
        </ul>
        <p>We don&apos;t use advertising cookies. If we add analytics, we&apos;ll update this policy.</p>
        <h2>How we use information</h2>
        <p>To respond to your requests, fulfil orders, provide support, prevent fraud and spam, and (if you subscribe) send product updates. You can unsubscribe at any time.</p>
        <h2>Service providers</h2>
        <p>We use trusted providers to run the site: database and hosting (Supabase and our web host), email delivery (Resend), and maps (Google Maps embed on the contact page). They process data on our behalf only.</p>
        <h2>Your choices</h2>
        <p>You can ask us to access, correct or delete your personal information. {contactLine(business)}</p>
      </>
    ),
  },
  terms: {
    title: "Terms of Service",
    description: "The terms that apply when you shop with us.",
    body: ({ business }: Ctx) => (
      <>
        <h2>Using this site</h2>
        <p>By using this website you agree to these terms. We may update them; the version posted here applies.</p>
        <h2>Product information</h2>
        <p>We sell used, recycled original-equipment parts. Listings describe condition, part numbers and fitment as accurately as we can, but fitment can vary by trim, option package and production date. Verify part numbers before installing, or <Link href="/contact?topic=fitment">ask us to check your VIN</Link>.</p>
        <h2>Pricing & availability</h2>
        <p>Most parts are one-of-a-kind and may sell on other channels at the same time. If an item sells before your order is processed, we&apos;ll notify you and refund in full. We may correct pricing errors.</p>
        <h2>Orders & payment</h2>
        <p>An order is accepted when we confirm it by email. Sales tax is charged where required.</p>
        <h2>Shipping, returns & warranty</h2>
        <p>See our <Link href="/policies/shipping">shipping</Link>, <Link href="/policies/returns">returns</Link> ({business.policies.returnDays} days) and <Link href="/policies/warranty">warranty</Link> ({business.policies.warrantyDays} days) policies.</p>
        <h2>Limitation of liability</h2>
        <p>To the extent permitted by law, our liability is limited to the purchase price of the part. We aren&apos;t liable for labor, installation, or incidental or consequential damages.</p>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of the State of Arizona.</p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

async function resolvePolicy(slug: string) {
  const builtIn = POLICIES[slug as PolicySlug];
  if (!builtIn) return null;
  const saved = (await getSetting("policy_pages")).pages[slug as PolicySlug];
  return { builtIn, saved };
}

export async function generateMetadata(props: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const policy = await resolvePolicy(slug);
  if (!policy) return {};
  const { title, description } = policy.saved ?? policy.builtIn;
  return { title, description, alternates: { canonical: `/policies/${slug}` } };
}

/** The URL-dependent part streams inside <Suspense>, so the shell stays instant on navigation. */
export default function PolicyPage(props: PageProps<"/policies/[slug]">) {
  return (
    <Suspense fallback={<PolicySkeleton />}>
      <PolicyContent params={props.params} />
    </Suspense>
  );
}

function PolicySkeleton() {
  return (
    <>
      <div className="h-48 bg-inverse" />
      <div className="mx-auto max-w-7xl space-y-3 px-4 py-12 sm:px-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-5/6 max-w-3xl" />
      </div>
    </>
  );
}

async function PolicyContent({ params }: { params: PageProps<"/policies/[slug]">["params"] }) {
  const { slug } = await params;
  const policy = await resolvePolicy(slug);
  if (!policy) notFound();
  const [business, shippingConfig, pages] = await Promise.all([getBusiness(), getShippingConfig(), getSetting("policy_pages")]);
  const { title, description } = policy.saved ?? policy.builtIn;
  return (
    <>
      <PageHero title={title} description={description} crumbs={[{ label: "Policies" }, { label: title }]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <LastUpdated date={pages.updated || "November 2026"} />
        <Prose>{policy.saved ? <RichText source={policy.saved.body} /> : policy.builtIn.body({ business, shippingConfig })}</Prose>
      </div>
    </>
  );
}
