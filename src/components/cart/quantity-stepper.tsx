"use client";

import { Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  max: number;
  min?: number;
  onChange: (next: number) => void;
  label: string;
  busy?: boolean;
  size?: "sm" | "lg";
  className?: string;
};

/** − value + control. Buttons disable at the limits; the value is announced on change. */
export function QuantityStepper({ value, max, min = 1, onChange, label, busy = false, size = "sm", className }: Props) {
  const box = size === "lg" ? "size-12" : "size-8";
  const icon = size === "lg" ? "size-4" : "size-3.5";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center rounded-md border bg-background", size === "lg" ? "h-12" : "h-8", className)}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={busy || value <= min}
        className={cn(box, "inline-flex items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40")}
        aria-label="Decrease quantity"
      >
        <Minus className={icon} aria-hidden />
      </button>
      <span
        aria-live="polite"
        className={cn("text-center font-semibold tabular-nums", size === "lg" ? "w-12 text-base" : "w-8 text-sm")}
      >
        {busy ? <Loader2 className={cn(icon, "mx-auto animate-spin")} aria-hidden /> : value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={busy || value >= max}
        className={cn(box, "inline-flex items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40")}
        aria-label="Increase quantity"
      >
        <Plus className={icon} aria-hidden />
      </button>
    </div>
  );
}
