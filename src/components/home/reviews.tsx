import { ArrowUpRight, BadgeCheck, Languages, MessageSquareReply, Quote, Star } from "lucide-react";
import { reviewMonth, type Review } from "@/content/reviews";
import { getBusiness, getSetting } from "@/lib/settings/server";
import { cn } from "@/lib/utils";
import { Section } from "./section";

/** Google "G" mark, used only to attribute the reviews to their source. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const AVATAR_TONES = ["bg-inverse text-inverse-foreground", "bg-primary text-primary-foreground", "bg-accent text-accent-foreground", "bg-secondary text-foreground"];

function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = name.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "G";
  const tone = AVATAR_TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full font-display text-base font-bold", tone, className)}>
      {letter}
    </span>
  );
}

function Byline({ review, tone = "light" }: { review: Review; tone?: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-inverse-muted" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3">
      <Avatar name={review.author} />
      <div className="min-w-0 text-sm leading-tight">
        <p className="truncate font-semibold">{review.author}</p>
        <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs", muted)}>
          <span>{reviewMonth(review.date)}</span>
          {review.localGuide ? (
            <>
              <span aria-hidden>·</span>
              <span>Local Guide</span>
            </>
          ) : null}
          {review.translatedFrom ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Languages className="size-3" aria-hidden /> Translated
              </span>
            </>
          ) : null}
        </p>
      </div>
      <GoogleMark className="ml-auto size-4 shrink-0" />
    </div>
  );
}

function FeatureCard({ review, hero = false }: { review: Review; hero?: boolean }) {
  return (
    <figure
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border p-6 transition-[border-color,box-shadow] duration-300 sm:p-7",
        hero
          ? "border-inverse-border bg-inverse text-inverse-foreground lg:row-span-2"
          : "bg-card hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5",
      )}
    >
      {hero ? <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" /> : null}
      <Quote aria-hidden className={cn("shrink-0", hero ? "size-10 text-inverse-accent" : "size-6 text-primary")} strokeWidth={2.5} />
      <blockquote className={cn("mt-4 flex-1 leading-relaxed", hero ? "font-display text-xl font-semibold tracking-tight sm:text-2xl sm:leading-snug" : "text-[15px]")}>
        <p>{review.text}</p>
      </blockquote>
      {hero && review.ownerReply ? (
        <div className="mt-6 border-l-2 border-inverse-accent pl-4 text-sm text-inverse-muted">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wider text-inverse-foreground uppercase">
            <MessageSquareReply className="size-3.5 text-inverse-accent" aria-hidden /> Reply from the owner
          </p>
          <p className="line-clamp-3">{review.ownerReply}</p>
        </div>
      ) : null}
      <figcaption className={cn("mt-6 border-t pt-4", hero ? "border-inverse-border" : "")}>
        <Byline review={review} tone={hero ? "dark" : "light"} />
      </figcaption>
    </figure>
  );
}

/** Home page reviews: the featured Google reviews (Admin → Content → Reviews; defaults in src/content/reviews.ts). */
export async function Reviews() {
  const [business, reviewSettings] = await Promise.all([getBusiness(), getSetting("reviews")]);
  const { rating } = business;
  const featured: Review[] = reviewSettings.items
    .filter((r) => r.featured)
    .slice(0, 6)
    .map((r) => ({ ...r, translatedFrom: r.translatedFrom || undefined, ownerReply: r.ownerReply || undefined }));
  const [hero, ...rest] = featured;
  const count = rating?.count ?? business.googleReviewCount;

  return (
    <Section id="reviews" eyebrow="Customer reviews" title="Trusted by Phoenix drivers and mechanics" tone="muted">
      {/* Source summary */}
      <div className="-mt-2 mb-8 flex flex-col gap-4 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-background">
            <GoogleMark className="size-7" />
          </span>
          <div>
            {rating ? (
              <p className="flex items-center gap-2">
                <span className="font-display text-3xl leading-none font-bold">{rating.value.toFixed(1)}</span>
                <span className="inline-flex gap-0.5" role="img" aria-label={`${rating.value.toFixed(1)} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} aria-hidden className={cn("size-4", i < Math.round(rating.value) ? "fill-[#FBBC04] text-[#FBBC04]" : "text-border")} />
                  ))}
                </span>
              </p>
            ) : (
              <p className="font-display text-xl leading-none font-bold tracking-wide uppercase">Reviewed on Google</p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <BadgeCheck className="size-4 text-success" aria-hidden />
              {count} reviews from real customers
            </p>
          </div>
        </div>
        <a
          href={business.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors hover:border-foreground/40 hover:bg-muted"
        >
          Read all on Google <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </div>

      {/* Featured */}
      {hero ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard review={hero} hero />
          {rest.slice(0, 4).map((r) => (
            <FeatureCard key={`${r.author}-${r.date}`} review={r} />
          ))}
        </div>
      ) : null}
    </Section>
  );
}
