import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Long-form content styles (no typography plugin needed). */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-3xl text-[15px] leading-relaxed text-foreground/90",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-wide [&_h2]:text-foreground [&_h2]:uppercase",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
        "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** "Last updated" line for policy pages. */
export function LastUpdated({ date }: { date: string }) {
  return <p className="mb-8 text-sm text-muted-foreground">Last updated {date}</p>;
}
