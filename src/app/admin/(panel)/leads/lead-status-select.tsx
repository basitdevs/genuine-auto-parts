"use client";

import { useOptimistic, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LeadType } from "@/lib/admin/leads";
import { cn } from "@/lib/utils";
import { updateLead } from "./actions";

const OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "Contacted" },
  { value: "closed", label: "Closed" },
  { value: "spam", label: "Spam" },
] as const;

/** Inline status change with an optimistic value and a toast. */
export function LeadStatusSelect({ type, id, status }: { type: LeadType; id: number; status: string }) {
  const [value, setValue] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`lead-${type}-${id}`}>Status</label>
      <select
        id={`lead-${type}-${id}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as (typeof OPTIONS)[number]["value"];
          startTransition(async () => {
            setValue(next);
            const r = await updateLead({ type, id, status: next });
            if (r.ok) toast.success(r.message);
            else toast.error(r.message);
          });
        }}
        className={cn(
          "h-8 rounded-md border px-2 text-xs font-semibold",
          value === "new" ? "border-primary bg-primary text-primary-foreground" : "bg-background",
        )}
      >
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {pending ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
    </span>
  );
}
