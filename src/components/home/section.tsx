import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: { label: string; href: string };
  tone?: "light" | "muted" | "dark";
  children: ReactNode;
  className?: string;
};

/** Consistent section shell: eyebrow + display heading + optional "view all" link. */
export function Section({ id, eyebrow, title, description, action, tone = "light", children, className }: SectionProps) {
  const dark = tone === "dark";
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "py-16 sm:py-20",
        tone === "muted" && "bg-muted/60",
        dark && "bg-inverse texture-tread text-inverse-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
          <div className="max-w-2xl">
            {eyebrow ? (
              <p className={cn("mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.25em] uppercase", dark ? "text-inverse-accent" : "text-primary")}>
                <span aria-hidden className="h-0.5 w-6 bg-current" />
                {eyebrow}
              </p>
            ) : null}
            <h2 id={`${id}-title`} className="font-display text-3xl leading-tight font-bold tracking-tight uppercase sm:text-4xl">
              {title}
            </h2>
            {description ? (
              <p className={cn("mt-3 text-base leading-relaxed", dark ? "text-inverse-muted" : "text-muted-foreground")}>{description}</p>
            ) : null}
          </div>
          {action ? (
            <Link
              href={action.href}
              className={cn(
                "group inline-flex items-center gap-2 text-sm font-bold tracking-wide uppercase",
                dark ? "text-inverse-foreground hover:text-inverse-accent" : "text-foreground hover:text-primary",
              )}
            >
              {action.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}
