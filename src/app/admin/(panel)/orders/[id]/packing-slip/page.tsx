import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/admin/access";
import { getBusiness } from "@/lib/settings/server";
import logo from "../../../../../../../public/brand/logo.png";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Packing slip" };

type Address = { line1?: string; line2?: string; city?: string; region?: string; postal_code?: string; name?: string };

async function Slip({ params }: { params: PageProps<"/admin/orders/[id]/packing-slip">["params"] }) {
  const { id } = await params;
  const { db } = await requireArea("orders", `/admin/orders/${id}/packing-slip`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [orderRes, itemsRes, business] = await Promise.all([
    db.from("orders").select("*").eq("id", id).maybeSingle(),
    db.from("order_items").select("sku, title, quantity, products(oem_part_number)").eq("order_id", id).order("id"),
    getBusiness(),
  ]);
  const order = orderRes.data;
  if (!order) notFound();
  const addr = (order.shipping_address ?? {}) as Address;
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/Phoenix" }).format(new Date(order.placed_at ?? order.created_at));
  const from = [business.address.street, `${business.address.city}, ${business.address.region} ${business.address.postalCode}`.trim()].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-5">
        <div>
          <Image src={logo} alt={business.name} sizes="160px" className="h-auto w-40" />
          <p className="mt-2 text-xs leading-relaxed">
            {from.map((l) => <span key={l} className="block">{l}</span>)}
            {business.phone ? <span className="block">{business.phone}</span> : null}
            {business.email ? <span className="block">{business.email}</span> : null}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold tracking-wide uppercase">Packing slip</p>
          <p className="mt-1 font-mono text-sm font-bold">{order.order_number}</p>
          <p className="text-xs">{date}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-5 text-sm">
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-widest uppercase">Ship to</p>
          <p className="font-semibold">{addr.name || order.customer_name || order.email}</p>
          {addr.line1 ? <p>{addr.line1}</p> : null}
          {addr.line2 ? <p>{addr.line2}</p> : null}
          {addr.city || addr.region || addr.postal_code ? <p>{[addr.city, addr.region].filter(Boolean).join(", ")} {addr.postal_code}</p> : null}
          {order.phone ? <p>{order.phone}</p> : null}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-widest uppercase">Shipping</p>
          <p>{order.carrier ?? "Carrier: ________"}</p>
          <p className="font-mono">{order.tracking_number ?? "Tracking: ________________"}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-black text-left text-[10px] tracking-widest uppercase">
            <th className="py-2 pr-2">SKU</th>
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2">OEM #</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 pl-4 text-center">Packed</th>
          </tr>
        </thead>
        <tbody>
          {(itemsRes.data ?? []).map((i, n) => (
            <tr key={n} className="border-b border-black/20 align-top">
              <td className="py-2.5 pr-2 font-mono text-xs">{i.sku}</td>
              <td className="py-2.5 pr-2">{i.title}</td>
              <td className="py-2.5 pr-2 font-mono text-xs">{(i.products as unknown as { oem_part_number: string | null } | null)?.oem_part_number ?? ""}</td>
              <td className="py-2.5 text-right font-semibold">{i.quantity}</td>
              <td className="py-2.5 pl-4 text-center">☐</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.notes ? (
        <p className="mt-5 border border-black/30 p-3 text-xs"><span className="font-bold">Customer notes: </span>{order.notes}</p>
      ) : null}
      <footer className="mt-10 border-t border-black/30 pt-3 text-center text-[11px]">
        Thank you for your order! {business.policies.warrantyDays}-day parts warranty · {business.policies.returnDays}-day returns. Questions? Reply to your order email.
      </footer>
    </div>
  );
}

export default function PackingSlipPage(props: PageProps<"/admin/orders/[id]/packing-slip">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}>
      <Slip params={props.params} />
    </Suspense>
  );
}
