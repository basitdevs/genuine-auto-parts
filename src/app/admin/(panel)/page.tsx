import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CircleDollarSign,
  ImageOff,
  Inbox,
  Package,
  PackageCheck,
  Plus,
  ShoppingBag,
  Upload,
} from "lucide-react";
import { ErrorNotice, fmtDate, LEAD_STATUS_META, MigrationNotice, ORDER_STATUS_META, Panel, StatCard, StatusBadge, TableSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { canAccess, requireArea } from "@/lib/admin/access";
import { isMissingSchema } from "@/lib/admin/db";
import { LEAD_TABLES, LEAD_TYPE_LABELS, type LeadType } from "@/lib/admin/leads";
import { formatNumber, formatPrice } from "@/lib/format";
import type { Json } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Dashboard" };

type Stats = {
  products: { active: number; sold: number; draft: number; archived: number; noPhotos: number; total: number };
  leads: { sell_car: number; part: number; return: number; contact: number; stale: number };
  orders: { new: number; confirmed: number; paid: number; shipped: number; open: number; revenue30: number; revenueAll: number };
  imports: { lastAt: string | null; failed: number };
  imageJobs: { failed: number };
  vehicles: { dismantling: number; total: number };
};

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const session = await requireArea("dashboard", "/admin");
  const { db, role } = session;
  const params = await searchParams;

  const [statsRes, recentOrders, recentLeads, activity] = await Promise.all([
    db.rpc("admin_dashboard"),
    db.from("orders").select("id, order_number, customer_name, email, status, total, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(6),
    Promise.all(
      (Object.keys(LEAD_TABLES) as LeadType[]).map(async (type) => {
        const { data } = await db.from(LEAD_TABLES[type]).select("id, name, status, created_at").order("created_at", { ascending: false }).limit(4);
        return (data ?? []).map((l) => ({ ...l, type }));
      }),
    ).then((lists) => lists.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)),
    canAccess(role, "activity")
      ? db.from("audit_log").select("id, actor_email, action, entity_type, entity_id, summary, created_at").order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const missing = isMissingSchema(statsRes.error);
  const stats = (statsRes.data as Json as Stats | null) ?? null;
  const newLeads = stats ? stats.leads.sell_car + stats.leads.part + stats.leads.return + stats.leads.contact : 0;

  const attention: { href: string; label: string; detail: string; icon: typeof AlertTriangle }[] = [];
  if (stats) {
    if (stats.orders.new) attention.push({ href: "/admin/orders?status=new", label: `${stats.orders.new} new order ${stats.orders.new === 1 ? "request" : "requests"}`, detail: "Confirm availability and send a payment link", icon: ShoppingBag });
    if (stats.leads.stale) attention.push({ href: "/admin/leads?status=new", label: `${stats.leads.stale} unanswered ${stats.leads.stale === 1 ? "lead" : "leads"} over 24h old`, detail: "Customers are waiting for a reply", icon: Inbox });
    if (stats.imports.failed && canAccess(role, "imports")) attention.push({ href: "/admin/imports", label: `${stats.imports.failed} import${stats.imports.failed === 1 ? "" : "s"} with errors (30 days)`, detail: "Review row errors and re-run", icon: Upload });
    if (stats.imageJobs.failed && canAccess(role, "imports")) attention.push({ href: "/admin/imports#images", label: `${stats.imageJobs.failed} image job${stats.imageJobs.failed === 1 ? "" : "s"} failed`, detail: "Re-run the job", icon: ImageOff });
    if (stats.products.noPhotos) attention.push({ href: "/admin/products?photos=none&status=active", label: `${formatNumber(stats.products.noPhotos)} active products without photos`, detail: "Listings with photos sell faster", icon: Camera });
  }

  return (
    <>
      {params.error === "forbidden" ? <div className="mb-4"><ErrorNotice message="Your role doesn't include that area. Ask an admin if you need access." /></div> : null}
      {missing ? <div className="mb-6"><MigrationNotice what="the dashboard numbers, orders, settings and activity log" /></div> : null}
      {statsRes.error && !missing ? <div className="mb-6"><ErrorNotice message={`Couldn't load dashboard numbers: ${statsRes.error.message}`} /></div> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active products" value={formatNumber(stats.products.active)} hint={`${formatNumber(stats.products.sold)} sold · ${formatNumber(stats.products.draft)} draft`} icon={Package} href="/admin/products?status=active" />
          <StatCard label="Open orders" value={formatNumber(stats.orders.open)} hint={`${stats.orders.new} new · ${stats.orders.confirmed} confirmed · ${stats.orders.paid} paid`} icon={ShoppingBag} href="/admin/orders" tone={stats.orders.new ? "attention" : "default"} />
          <StatCard label="New leads" value={formatNumber(newLeads)} hint={`${stats.leads.part} part · ${stats.leads.sell_car} sell car · ${stats.leads.return} returns · ${stats.leads.contact} contact`} icon={Inbox} href="/admin/leads?status=new" tone={newLeads ? "attention" : "default"} />
          <StatCard
            label="Revenue (30 days)"
            value={formatPrice(stats.orders.revenue30)}
            hint={stats.orders.revenueAll ? `${formatPrice(stats.orders.revenueAll)} all time · paid, shipped & completed` : "Counts paid orders once payments are recorded"}
            icon={CircleDollarSign}
            tone="success"
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <Panel title="Needs attention" bodyClassName="p-0">
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <PackageCheck className="size-4 text-success" aria-hidden /> All caught up. Nothing needs action right now.
              </p>
            ) : (
              <ul className="divide-y">
                {attention.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                        <a.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{a.label}</span>
                        <span className="block text-xs text-muted-foreground">{a.detail}</span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-xs font-semibold hover:text-primary">View all →</Link>} bodyClassName="p-0">
            {recentOrders.error && isMissingSchema(recentOrders.error) ? (
              <div className="p-5"><MigrationNotice what="orders" /></div>
            ) : (recentOrders.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No orders yet. Order requests from the cart appear here.</p>
            ) : (
              <ul className="divide-y">
                {(recentOrders.data ?? []).map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                      <span className="font-mono text-xs font-semibold">{o.order_number}</span>
                      <span className="min-w-0 flex-1 truncate">{o.customer_name ?? o.email}</span>
                      <StatusBadge tone={ORDER_STATUS_META[o.status]?.tone}>{ORDER_STATUS_META[o.status]?.label ?? o.status}</StatusBadge>
                      <span className="w-20 text-right font-semibold tabular-nums">{formatPrice(Number(o.total))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="justify-start"><Link href="/admin/products/new"><Plus aria-hidden /> New product</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href="/admin/orders?status=new"><ShoppingBag aria-hidden /> New orders</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href="/admin/leads?status=new"><Inbox aria-hidden /> New leads</Link></Button>
              {canAccess(role, "imports") ? (
                <Button asChild variant="outline" className="justify-start"><Link href="/admin/imports"><Upload aria-hidden /> Import CSV</Link></Button>
              ) : (
                <Button asChild variant="outline" className="justify-start"><Link href="/admin/vehicles/new"><Plus aria-hidden /> New vehicle</Link></Button>
              )}
            </div>
          </Panel>

          <Panel title="Recent leads" actions={<Link href="/admin/leads" className="text-xs font-semibold hover:text-primary">View all →</Link>} bodyClassName="p-0">
            {recentLeads.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <ul className="divide-y">
                {recentLeads.map((l) => (
                  <li key={`${l.type}-${l.id}`}>
                    <Link href={`/admin/leads/${l.type}/${l.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{l.name}</span>
                        <span className="block text-xs text-muted-foreground">{LEAD_TYPE_LABELS[l.type]} · {fmtDate(l.created_at)}</span>
                      </span>
                      <StatusBadge tone={LEAD_STATUS_META[l.status]?.tone}>{LEAD_STATUS_META[l.status]?.label ?? l.status}</StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {canAccess(role, "activity") ? (
            <Panel title="Recent activity" actions={<Link href="/admin/activity" className="text-xs font-semibold hover:text-primary">Activity log →</Link>} bodyClassName="p-0">
              {(activity.data ?? []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No admin changes recorded yet.</p>
              ) : (
                <ul className="divide-y">
                  {(activity.data ?? []).map((a) => (
                    <li key={a.id} className="px-5 py-2.5 text-sm">
                      <p className="truncate">
                        <span className="font-semibold">{a.actor_email ?? "System"}</span>{" "}
                        <span className="text-muted-foreground">{a.summary ?? `${a.action} ${a.entity_type.replace(/_/g, " ")}`}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function AdminDashboardPage(props: PageProps<"/admin">) {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">What&apos;s happening across the store today.</p>
      </div>
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
