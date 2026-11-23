import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)}
      {...props}
    />
  );
}
