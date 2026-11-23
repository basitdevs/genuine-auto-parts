import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { label: string; href?: string };

/** Dark page header with breadcrumb, used by every inner page. */
export function PageHero({ title, description, crumbs, children }: { title: string; description?: ReactNode; crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-inverse texture-tread text-inverse-foreground">
      <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_80%_20%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-inverse-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-inverse-foreground">Home</Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span aria-hidden>/</span>
                {c.href ? (
                  <Link href={c.href} className="hover:text-inverse-foreground">{c.label}</Link>
                ) : (
                  <span aria-current="page" className="text-inverse-foreground">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="mt-3 font-display text-4xl leading-none font-extrabold tracking-tight uppercase sm:text-5xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-inverse-muted">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
