"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { partsHref, SORT_OPTIONS, type PartsSearch, type SortValue } from "@/lib/search/params";

export function SortSelect({ search, value }: { search: PartsSearch; value: SortValue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="parts-sort" className="text-sm font-medium whitespace-nowrap text-muted-foreground">
        Sort by
      </label>
      <NativeSelect
        id="parts-sort"
        value={value}
        aria-busy={pending}
        className="h-10 w-48"
        onChange={(e) => startTransition(() => router.push(partsHref(search, { sort: e.target.value })))}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
