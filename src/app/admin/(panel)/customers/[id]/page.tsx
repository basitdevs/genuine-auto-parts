import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarFront, Mail } from "lucide-react";
import { DefinitionList, fmtDate, LEAD_STATUS_META, ORDER_STATUS_META, PageHeader, Panel, StatusBadge, TableSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { canAccess, requireArea } from "@/lib/admin/access";
import { summarize } from "@/lib/admin/lead-data";
import { LEAD_TABLES, LEAD_TYPE_LABELS, type LeadType } from "@/lib/admin/leads";
import { formatPrice } from "@/lib/format";
import { DisableToggle } from "./disable-toggle";

export const metadata: Metadata = { title: "Customer" };

async function CustomerView({ params }: { params: PageProps<"/admin/customers/[id]">["params"] }) {
  const { id } = await params;
  const session = await requireArea("customers", `/admin/customers/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = session;
  const { data: profile } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();
  const email = profile.email ?? "";

  const [orders, leads] = await Promise.all([
    db.from("orders").select("id, order_number, status, total, created_at").or(`customer_id.eq.${id}${email ? `,email.eq.${email}` : ""}`).order("created_at", { ascending: false }).limit(50),
    email
      ? Promise.all(
          (Object.keys(LEAD_TABLES) as LeadType[]).map(async (type) => {
            const { data } = await db.from(LEAD_TABLES[type]).select("*").eq("email", email).order("created_at", { ascending: false }).limit(20).overrideTypes<Record<string, unknown>[], { merge: false }>();
            return (data ?? []).map((row) => ({ type, row }));
          }),
        ).then((l) => l.flat().sort((a, b) => String(b.row.created_at).localeCompare(String(a.row.created_at))))
      : Promise.resolve([]),
  ]);

  const p = profile as typeof profile & { disabled_at?: string | null; garage?: { year?: number; makeLabel?: string; modelLabel?: string } | null };
  const garage = p.garage ? [p.garage.year, p.garage.makeLabel, p.garage.modelLabel].filter(Boolean).join(" ") : "";
  const spent = (orders.data ?? []).filter((o) => ["paid", "shipped", "completed"].includes(o.status)).reduce((n, o) => n + Number(o.total), 0);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={<span className="flex flex-wrap items-center gap-3">{profile.full_name || profile.email} {p.disabled_at ? <StatusBadge tone="warning">Disabled</StatusBadge> : null} {profile.role !== "customer" ? <StatusBadge tone="dark">{profile.role}</StatusBadge> : null}</span>}
        description={`Joined ${fmtDate(profile.created_at)}`}
        actions={
          <>
            {email ? <Button asChild size="sm" variant="outline"><a href={`mailto:${email}`}><Mail aria-hidden /> Email</a></Button> : null}
            {canAccess(session.role, "settings") && profile.id !== session.userId ? <DisableToggle id={profile.id} disabled={Boolean(p.disabled_at)} /> : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-6">
          <Panel title="Profile">
            <DefinitionList items={[["Name", profile.full_name], ["Email", profile.email], ["Phone", profile.phone], ["Role", profile.role], ["Orders", String(orders.data?.length ?? 0)], ["Spent", formatPrice(spent)]]} />
          </Panel>
          <Panel title="Saved vehicle">
            {garage ? (
              <p className="flex items-center gap-2 text-sm font-medium"><CarFront className="size-4 text-primary" aria-hidden /> {garage}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No saved vehicle. It&apos;s recorded when they search by vehicle while signed in.</p>
            )}
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <Panel title={`Orders (${orders.data?.length ?? 0})`} bodyClassName="p-0">
            {(orders.data ?? []).length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No orders yet.</p> : (
              <ul className="divide-y">
                {(orders.data ?? []).map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/40">
                      <span className="font-mono text-xs font-bold">{o.order_number}</span>
                      <span className="flex-1 text-muted-foreground">{fmtDate(o.created_at)}</span>
                      <StatusBadge tone={ORDER_STATUS_META[o.status]?.tone}>{ORDER_STATUS_META[o.status]?.label ?? o.status}</StatusBadge>
                      <span className="w-20 text-right font-semibold tabular-nums">{formatPrice(Number(o.total))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Leads (${leads.length})`} bodyClassName="p-0">
            {leads.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No leads from this email.</p> : (
              <ul className="divide-y">
                {leads.map(({ type, row }) => (
                  <li key={`${type}-${String(row.id)}`}>
                    <Link href={`/admin/leads/${type}/${String(row.id)}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{summarize(type, row)}</span>
                        <span className="block text-xs text-muted-foreground">{LEAD_TYPE_LABELS[type]} · {fmtDate(String(row.created_at))}</span>
                      </span>
                      <StatusBadge tone={LEAD_STATUS_META[String(row.status)]?.tone}>{LEAD_STATUS_META[String(row.status)]?.label}</StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function CustomerPage(props: PageProps<"/admin/customers/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <CustomerView params={props.params} />
    </Suspense>
  );
}
