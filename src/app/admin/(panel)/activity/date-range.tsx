"use client";

import { useUrlParams } from "@/components/admin/client";

export function DateRange() {
  const { params, set } = useUrlParams();
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <label className="sr-only" htmlFor="from">From date</label>
      <input id="from" type="date" value={params.get("from") ?? ""} onChange={(e) => set({ from: e.target.value || null })} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
      <span className="text-muted-foreground">–</span>
      <label className="sr-only" htmlFor="to">To date</label>
      <input id="to" type="date" value={params.get("to") ?? ""} onChange={(e) => set({ to: e.target.value || null })} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
    </span>
  );
}
