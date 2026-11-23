import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs " +
  "placeholder:text-muted-foreground transition-[border-color,box-shadow] outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, className)} {...props} />;
}
