import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Printer } from "lucide-react";
import { DefinitionList, fmtDate, MigrationNotice, ORDER_STATUS_META, PageHeader, Panel, StatusBadge, TableSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { canAccess, requireArea } from "@/lib/admin/access";
import { isMissingSchema } from "@/lib/admin/db";
import { formatPrice } from "@/lib/format";
import type { OrderStatus } from "@/lib/supabase/database.types";
import { DeleteOrderButton, DetailsForm, NoteForm, StatusControl, TrackingForm } from "./order-controls";

export const metadata: Metadata = { title: "Order" };

type Address = { line1?: string; line2?: string; city?: string; region?: string; postal_code?: string; name?: string };

const SOURCE_LABEL: Record<string, string> = { request: "Website order request", stripe: "Online payment", manual: "Created by staff", lead: "Converted from a lead" };

async function OrderView({ params }: { params: PageProps<"/admin/orders/[id]">["params"] }) {
  const { id } = await params;
  const session = await requireArea("orders", `/admin/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = session;

  const [orderRes, itemsRes, eventsRes] = await Promise.all([
    db.from("orders").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    db.from("order_items").select("id, product_id, sku, title, unit_price, quantity, line_total, products(slug, status, quantity)").eq("order_id", id).order("id"),
    db.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  if (orderRes.error && isMissingSchema(orderRes.error)) return <MigrationNotice what="orders" />;
  const order = orderRes.data;
  if (!order) notFound();

  const addr = (order.shipping_address ?? {}) as Address;
  const items = itemsRes.data ?? [];
  const status = order.status as OrderStatus;
  const meta = ORDER_STATUS_META[status];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={<span className="flex flex-wrap items-center gap-3">Order {order.order_number} <StatusBadge tone={meta?.tone}>{meta?.label ?? status}</StatusBadge></span>}
        description={`${SOURCE_LABEL[order.source] ?? order.source} · placed ${fmtDate(order.placed_at ?? order.created_at)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Your order ${order.order_number}`)}`}><Mail aria-hidden /> Email customer</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/orders/${order.id}/packing-slip`} target="_blank"><Printer aria-hidden /> Packing slip</Link>
            </Button>
            {canAccess(session.role, "settings") ? <DeleteOrderButton orderId={order.id} orderNumber={order.order_number} /> : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Status">
            <StatusControl orderId={order.id} status={status} />
          </Panel>

          <Panel title={`Items (${items.length})`} bodyClassName="p-0">
            <ul className="divide-y">
              {items.map((item) => {
                const product = item.products as unknown as { slug: string; status: string; quantity: number } | null;
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      {item.product_id ? (
                        <Link href={`/admin/products/${item.product_id}`} className="font-medium hover:text-primary">{item.title}</Link>
                      ) : (
                        <span className="font-medium">{item.title}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        SKU {item.sku}
                        {product ? ` · now ${product.status}, ${product.quantity} in stock` : item.product_id ? "" : " · product deleted"}
                      </p>
                    </div>
                    <span className="text-muted-foreground tabular-nums">{formatPrice(Number(item.unit_price))} × {item.quantity}</span>
                    <span className="w-24 text-right font-semibold tabular-nums">{formatPrice(Number(item.line_total))}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="grid gap-1.5 border-t bg-muted/30 px-5 py-4 text-sm">
              {([
                ["Subtotal", Number(order.subtotal)],
                ["Shipping", Number(order.shipping_total)],
                ["Tax", Number(order.tax_total)],
                ...(Number(order.discount_total) ? [["Discount", -Number(order.discount_total)] as [string, number]] : []),
              ] as [string, number][]).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="tabular-nums">{formatPrice(v)}</dd>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(Number(order.total))}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Timeline">
            <NoteForm orderId={order.id} />
            <ol className="mt-5 grid gap-4 border-l-2 pl-5">
              {(eventsRes.data ?? []).map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span aria-hidden className={`absolute top-1 -left-[27px] size-3 rounded-full border-2 border-background ${e.kind === "note" ? "bg-muted-foreground" : "bg-primary"}`} />
                  <p className="font-medium">{e.message ?? e.kind}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}{e.actor_email ? ` · ${e.actor_email}` : ""}</p>
                </li>
              ))}
              {(eventsRes.data ?? []).length === 0 ? <li className="text-sm text-muted-foreground">No events yet.</li> : null}
            </ol>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Customer">
            <DefinitionList
              items={[
                ["Name", order.customer_name],
                ["Email", <a key="e" href={`mailto:${order.email}`} className="text-primary hover:underline">{order.email}</a>],
                ["Phone", order.phone ? <a key="p" href={`tel:${order.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="size-3.5" aria-hidden />{order.phone}</a> : null],
                ["Account", order.customer_id ? <Link key="c" href={`/admin/customers/${order.customer_id}`} className="text-primary hover:underline">View customer</Link> : "Guest"],
                ["Ship to", [addr.line1, addr.line2, [addr.city, addr.region].filter(Boolean).join(", "), addr.postal_code].filter(Boolean).join(" · ") || null],
              ]}
            />
            {order.notes ? (
              <div className="mt-4 rounded-md bg-muted/60 p-3 text-sm">
                <p className="mb-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">Customer notes</p>
                <p className="whitespace-pre-line">{order.notes}</p>
              </div>
            ) : null}
          </Panel>

          <Panel title="Shipping & tracking">
            <TrackingForm orderId={order.id} carrier={order.carrier ?? ""} trackingNumber={order.tracking_number ?? ""} status={status} />
            {order.shipped_at ? <p className="mt-3 text-xs text-muted-foreground">Shipped {fmtDate(order.shipped_at)}</p> : null}
          </Panel>

          <Panel title="Edit details">
            <DetailsForm
              orderId={order.id}
              initial={{
                customerName: order.customer_name ?? "",
                email: order.email,
                phone: order.phone ?? "",
                line1: addr.line1 ?? "",
                line2: addr.line2 ?? "",
                city: addr.city ?? "",
                region: addr.region ?? "",
                postalCode: addr.postal_code ?? "",
                shippingTotal: String(order.shipping_total ?? 0),
                taxTotal: String(order.tax_total ?? 0),
                staffNotes: order.staff_notes ?? "",
              }}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function OrderPage(props: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <OrderView params={props.params} />
    </Suspense>
  );
}
