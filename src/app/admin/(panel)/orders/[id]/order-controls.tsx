"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton, FieldError, useAction } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { addOrderNote, deleteOrder, saveTracking, updateOrderDetails, updateOrderStatus } from "../actions";

const LABELS: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  paid: "Paid",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Status buttons with an optimistic highlight; the server confirms (and adjusts stock). */
export function StatusControl({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  function change(next: OrderStatus) {
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      const result = await updateOrderStatus({ orderId, status: next });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }
  return (
    <div>
      <div role="radiogroup" aria-label="Order status" className="flex flex-wrap gap-1.5">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={optimistic === s}
            onClick={() => change(s)}
            disabled={pending}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-semibold transition-colors disabled:opacity-70",
              optimistic === s ? "border-inverse bg-inverse text-inverse-foreground" : "bg-background hover:border-foreground/40",
            )}
          >
            {LABELS[s]}
          </button>
        ))}
        {pending ? <Loader2 className="ml-1 size-4 animate-spin self-center text-muted-foreground" aria-hidden /> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Paid, shipped and completed take the items out of stock; moving back returns them.</p>
    </div>
  );
}

export function TrackingForm({ orderId, carrier, trackingNumber, status }: { orderId: string; carrier: string; trackingNumber: string; status: OrderStatus }) {
  const [c, setC] = useState(carrier);
  const [t, setT] = useState(trackingNumber);
  const { run, pending } = useAction(saveTracking);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ orderId, carrier: c, trackingNumber: t, markShipped: false });
      }}
      className="grid gap-2"
    >
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <label className="sr-only" htmlFor="carrier">Carrier</label>
        <select id="carrier" value={c} onChange={(e) => setC(e.target.value)} className={cn(fieldClass, "h-9")}>
          <option value="">Carrier</option>
          {["UPS", "FedEx", "USPS", "DHL", "Freight", "Local pickup", "Other"].map((x) => <option key={x}>{x}</option>)}
        </select>
        <label className="sr-only" htmlFor="tracking">Tracking number</label>
        <input id="tracking" value={t} onChange={(e) => setT(e.target.value)} placeholder="Tracking number" className={cn(fieldClass, "h-9 font-mono")} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}><Save aria-hidden /> Save tracking</Button>
        {status !== "shipped" && status !== "completed" ? (
          <Button type="button" size="sm" disabled={pending || !t} onClick={() => run({ orderId, carrier: c, trackingNumber: t, markShipped: true })}>
            <Truck aria-hidden /> Save &amp; mark shipped
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const [note, setNote] = useState("");
  const { run, pending } = useAction(addOrderNote, { onSuccess: () => setNote("") });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ orderId, note });
      }}
      className="grid gap-2"
    >
      <label className="sr-only" htmlFor="order-note">Add a note</label>
      <textarea id="order-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add an internal note to the timeline…" className={cn(fieldClass, "h-auto py-2")} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending || !note.trim()}>Add note</Button>
      </div>
    </form>
  );
}

type Details = {
  customerName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  shippingTotal: string;
  taxTotal: string;
  staffNotes: string;
};

export function DetailsForm({ orderId, initial }: { orderId: string; initial: Details }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const field = (k: keyof Details, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={cn(fieldClass, "h-9 font-normal")} {...props} />
      <FieldError message={errors[k]} />
    </label>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateOrderDetails({ orderId, ...v });
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        });
      }}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field("customerName", "Name")}
        {field("email", "Email", { type: "email" })}
        {field("phone", "Phone", { type: "tel" })}
      </div>
      <p className="mt-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">Shipping address</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("line1", "Address line 1")}
        {field("line2", "Address line 2")}
        {field("city", "City")}
        <div className="grid grid-cols-2 gap-3">
          {field("region", "State")}
          {field("postalCode", "ZIP")}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("shippingTotal", "Shipping ($)", { inputMode: "decimal" })}
        {field("taxTotal", "Tax ($)", { inputMode: "decimal" })}
      </div>
      <label className="grid gap-1 text-xs font-semibold">
        Staff notes (private)
        <textarea value={v.staffNotes} onChange={(e) => setV({ ...v, staffNotes: e.target.value })} rows={3} className={cn(fieldClass, "h-auto py-2 font-normal")} />
      </label>
      <div>
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save details</Button>
      </div>
    </form>
  );
}

export function DeleteOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const { run, pending } = useAction(deleteOrder, { onSuccess: () => router.push("/admin/orders") });
  return (
    <ConfirmButton
      variant="outline"
      size="sm"
      destructive
      pending={pending}
      title={`Delete order ${orderNumber}?`}
      description="The order is hidden from lists and reports (soft delete). Its history stays in the activity log."
      confirmLabel="Delete order"
      onConfirm={() => run(orderId)}
    >
      <Trash2 aria-hidden /> Delete
    </ConfirmButton>
  );
}
