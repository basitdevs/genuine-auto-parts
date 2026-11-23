import { AlertTriangle, Info } from "lucide-react";
import { getFlags } from "@/lib/settings/server";
import { cn } from "@/lib/utils";

/** Site-wide notice controlled from Admin → Settings → Feature flags. */
export async function MaintenanceBanner() {
  const { maintenanceBanner: banner } = await getFlags();
  if (!banner.enabled || !banner.message) return null;
  const Icon = banner.tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      role="status"
      className={cn(
        "px-4 py-2 text-center text-sm font-medium",
        banner.tone === "warning" ? "bg-warning text-white" : "bg-primary text-primary-foreground",
      )}
    >
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden /> {banner.message}
      </p>
    </div>
  );
}
