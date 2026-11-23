"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import type { LeadType } from "@/lib/admin/leads";
import { cn } from "@/lib/utils";
import { convertLeadToOrder, updateLead } from "../../actions";

type Props = {
  type: LeadType;
  id: number;
  status: string;
  assignedTo: string;
  notes: string;
  staff: { id: string; label: string }[];
  supportsNotes: boolean;
};

export function LeadControls({ type, id, status, assignedTo, notes, staff, supportsNotes }: Props) {
  const router = useRouter();
  const [v, setV] = useState({ status, assignedTo, notes });
  const [pending, startTransition] = useTransition();
  const dirty = v.status !== status || v.assignedTo !== assignedTo || v.notes !== notes;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateLead({
            type,
            id,
            status: v.status as "new",
            ...(supportsNotes ? { assignedTo: v.assignedTo, internalNotes: v.notes } : {}),
          });
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
          router.refresh();
        });
      }}
      className="grid gap-3"
    >
      <label className="grid gap-1 text-xs font-semibold">
        Status
        <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} className={cn(fieldClass, "h-10 font-normal")}>
          <option value="new">New</option>
          <option value="in_progress">Contacted</option>
          <option value="closed">Closed</option>
          <option value="spam">Spam</option>
        </select>
      </label>
      {supportsNotes ? (
        <>
          <label className="grid gap-1 text-xs font-semibold">
            Assigned to
            <select value={v.assignedTo} onChange={(e) => setV({ ...v, assignedTo: e.target.value })} className={cn(fieldClass, "h-10 font-normal")}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Internal notes
            <textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={5} placeholder="Only staff can see these notes." className={cn(fieldClass, "h-auto py-2 font-normal")} />
          </label>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Notes and assignee need the 0600 database update.</p>
      )}
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save
      </Button>
    </form>
  );
}

export function ConvertToOrder({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmButton
      pending={pending}
      title="Convert to an order?"
      description="Creates a new order with this customer and the requested part (at the offer price if they made one). The lead is marked Contacted."
      confirmLabel="Create order"
      onConfirm={() =>
        startTransition(async () => {
          const r = await convertLeadToOrder({ id });
          if (r.ok && r.data) {
            toast.success(r.message);
            router.push(`/admin/orders/${r.data.orderId}`);
          } else toast.error(r.message);
        })
      }
    >
      <ShoppingBag aria-hidden /> Convert to order
    </ConfirmButton>
  );
}
