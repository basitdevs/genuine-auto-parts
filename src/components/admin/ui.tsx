import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, DatabaseZap, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Server-safe admin building blocks (no client JS). */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3.5" aria-hidden /> {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-3xl leading-tight font-bold tracking-wide uppercase">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div>
            {title ? <h2 className="font-display text-lg font-bold tracking-wide uppercase">{title}</h2> : null}
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, href, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "attention" | "success";
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-md", tone === "attention" ? "bg-primary text-primary-foreground" : tone === "success" ? "bg-success/10 text-success" : "bg-muted text-foreground")}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-3xl leading-none font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = cn("block rounded-lg border bg-card p-4 transition-colors", tone === "attention" && "border-primary/40", href && "hover:border-foreground/30");
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

const TONES = {
  neutral: "border-border bg-muted text-foreground",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  dark: "border-inverse bg-inverse text-inverse-foreground",
  primary: "border-primary bg-primary text-primary-foreground",
} as const;
export type BadgeTone = keyof typeof TONES;

export function StatusBadge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const ORDER_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "primary" },
  confirmed: { label: "Confirmed", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  shipped: { label: "Shipped", tone: "dark" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "warning" },
  refunded: { label: "Refunded", tone: "warning" },
};

export const PRODUCT_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  sold: { label: "Sold", tone: "dark" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "warning" },
};

export const LEAD_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "primary" },
  in_progress: { label: "Contacted", tone: "info" },
  closed: { label: "Closed", tone: "neutral" },
  spam: { label: "Spam", tone: "warning" },
};

export const VEHICLE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  incoming: { label: "Incoming", tone: "neutral" },
  dismantling: { label: "Dismantling", tone: "primary" },
  parted_out: { label: "Parted out", tone: "dark" },
  crushed: { label: "Crushed", tone: "warning" },
};

export function MigrationNotice({ what = "this page" }: { what?: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
      <DatabaseZap className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Database update needed for {what}</p>
        <p className="mt-1">
          Run <code className="rounded-sm bg-amber-100 px-1">supabase/pending-2026-11-20-admin.sql</code> in the Supabase SQL Editor (Dashboard → SQL Editor
          → New query → Run), then reload this page.
        </p>
      </div>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{message}</p>;
}

export function Table({ children, minWidth = 760 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={cn("border-b bg-muted/60 px-3 py-2.5 text-[11px] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b px-3 py-2.5 align-middle", className)}>{children}</td>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-muted-foreground">{children}</td>
    </tr>
  );
}

/** Server pagination: builds hrefs by merging `page` into the current params. */
export function Pager({ basePath, params, page, pageSize, total }: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (n: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: n > 1 ? String(n) : undefined }).filter((e): e is [string, string] => Boolean(e[1])));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {formatNumber(from)}–{formatNumber(to)} of <strong className="text-foreground">{formatNumber(total)}</strong>
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 font-medium hover:bg-muted" rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Prev
          </Link>
        ) : null}
        <span className="px-2 text-muted-foreground">Page {page} of {formatNumber(pages)}</span>
        {page < pages ? (
          <Link href={href(page + 1)} className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 font-medium hover:bg-muted" rel="next">
            Next <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading">
      <Skeleton className="h-10" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
      {items
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 font-medium break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Phoenix" });
export const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Phoenix" });
export const fmtDate = (v: string | null | undefined) => (v ? dateTime.format(new Date(v)) : "—");
