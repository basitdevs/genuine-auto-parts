import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { partsHref, type PartsSearch } from "@/lib/search/params";
import { cn } from "@/lib/utils";

function pageWindow(current: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({ search, totalPages }: { search: PartsSearch; totalPages: number }) {
  if (totalPages <= 1) return null;
  const current = Math.min(search.page ?? 1, totalPages);
  const link = "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      {current > 1 ? (
        <Link href={partsHref(search, { page: current - 1 })} rel="prev" className={cn(link, "hover:bg-muted")} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : null}
      {pageWindow(current, totalPages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={partsHref(search, { page: p })}
            aria-current={p === current ? "page" : undefined}
            className={cn(link, p === current ? "border-inverse bg-inverse text-inverse-foreground" : "hover:bg-muted")}
          >
            {p}
          </Link>
        ),
      )}
      {current < totalPages ? (
        <Link href={partsHref(search, { page: current + 1 })} rel="next" className={cn(link, "hover:bg-muted")} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
