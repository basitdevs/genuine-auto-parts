import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { DefinitionList, fmtDate, LEAD_STATUS_META, PageHeader, Panel, StatusBadge, TableSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/admin/access";
import { loadStaff, summarize } from "@/lib/admin/lead-data";
import { LEAD_TABLES, LEAD_TYPE_LABELS, type LeadType } from "@/lib/admin/leads";
import { formatPrice } from "@/lib/format";
import { ConvertToOrder, LeadControls } from "./lead-controls";

export const metadata: Metadata = { title: "Lead" };

const LABELS: Record<string, string> = {
  vehicle_year: "Year", vehicle_make: "Make", vehicle_model: "Model", vin: "VIN", mileage: "Mileage", pickup_location: "Pickup location",
  asking_price: "Asking price", part_name: "Part", part_number: "Part #", offer_amount: "Offer", order_number: "Order #",
  invoice_number: "Invoice #", reason: "Reason", subject: "Subject",
};
const MESSAGE_KEYS = ["notes", "message", "description"];

async function LeadView({ params }: { params: PageProps<"/admin/leads/[type]/[id]">["params"] }) {
  const { type, id } = await params;
  const session = await requireArea("leads", `/admin/leads/${type}/${id}`);
  if (!(type in LEAD_TABLES) || !/^\d+$/.test(id)) notFound();
  const leadType = type as LeadType;
  const { db } = session;
  const [leadRes, staff] = await Promise.all([
    db.from(LEAD_TABLES[leadType]).select(leadType === "part" ? "*, products(id, slug, title, sku, price)" : "*").eq("id", Number(id)).maybeSingle().overrideTypes<Record<string, unknown>, { merge: false }>(),
    loadStaff(db),
  ]);
  const lead = leadRes.data;
  if (!lead) notFound();

  const status = String(lead.status);
  const meta = LEAD_STATUS_META[status];
  const product = (lead.products as { id: string; slug: string; title: string; sku: string; price: number } | null | undefined) ?? null;
  const details: [string, React.ReactNode][] = Object.entries(LABELS)
    .filter(([k]) => lead[k] !== null && lead[k] !== undefined && lead[k] !== "")
    .map(([k, label]) => [label, k === "asking_price" || k === "offer_amount" ? formatPrice(Number(lead[k])) : k === "mileage" ? `${Number(lead[k]).toLocaleString()} mi` : String(lead[k])]);
  const message = MESSAGE_KEYS.map((k) => lead[k]).find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  const supportsNotes = "internal_notes" in lead;
  const subject = `Re: your ${LEAD_TYPE_LABELS[leadType].toLowerCase()} request`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/leads", label: "Leads" }}
        title={<span className="flex flex-wrap items-center gap-3">{String(lead.name)} <StatusBadge tone={meta?.tone}>{meta?.label ?? status}</StatusBadge></span>}
        description={`${LEAD_TYPE_LABELS[leadType]} · ${summarize(leadType, lead)} · received ${fmtDate(String(lead.created_at))}`}
        actions={
          <>
            <Button asChild size="sm">
              <a href={`mailto:${String(lead.email)}?subject=${encodeURIComponent(subject)}`}><Mail aria-hidden /> Reply by email</a>
            </Button>
            {lead.phone ? (
              <Button asChild size="sm" variant="outline"><a href={`tel:${String(lead.phone)}`}><Phone aria-hidden /> Call</a></Button>
            ) : null}
            {leadType === "part" && !lead.order_id ? <ConvertToOrder id={Number(lead.id)} /> : null}
            {leadType === "part" && lead.order_id ? (
              <Button asChild size="sm" variant="outline"><Link href={`/admin/orders/${String(lead.order_id)}`}>View order</Link></Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Request">
            <DefinitionList items={[["Email", String(lead.email)], ["Phone", lead.phone ? String(lead.phone) : null], ...details]} />
            {product ? (
              <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm">
                About product: <Link href={`/admin/products/${product.id}`} className="font-semibold text-primary hover:underline">{product.title}</Link>{" "}
                <span className="text-muted-foreground">({product.sku} · listed at {formatPrice(Number(product.price))})</span>
              </p>
            ) : null}
            {message ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">Message</p>
                <p className="rounded-md border bg-background p-3 text-sm whitespace-pre-line">{message}</p>
              </div>
            ) : null}
          </Panel>
        </div>
        <Panel title="Handle">
          <LeadControls
            type={leadType}
            id={Number(lead.id)}
            status={status}
            assignedTo={String(lead.assigned_to ?? "")}
            notes={String(lead.internal_notes ?? "")}
            staff={staff}
            supportsNotes={supportsNotes}
          />
          {lead.updated_at ? <p className="mt-3 text-xs text-muted-foreground">Last updated {fmtDate(String(lead.updated_at))}</p> : null}
        </Panel>
      </div>
    </>
  );
}

export default function LeadPage(props: PageProps<"/admin/leads/[type]/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <LeadView params={props.params} />
    </Suspense>
  );
}
