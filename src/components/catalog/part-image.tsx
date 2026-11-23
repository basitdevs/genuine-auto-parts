import Image from "next/image";
import type { CardImage } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

type Props = {
  image: CardImage | null;
  icon?: string | null;
  sizes: string;
  className?: string;
  eager?: boolean;
};

/**
 * Product/vehicle image with a branded fallback. The eBay active-listings export has
 * no pictures, so many parts start image-less; the fallback keeps the grid consistent.
 */
export function PartImage({ image, icon, sizes, className, eager = false }: Props) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-muted", className)}>
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-secondary text-muted-foreground">
          <div aria-hidden className="absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(-45deg,transparent_0_10px,color-mix(in_srgb,var(--foreground)_4%,transparent)_10px_11px)]" />
          <CategoryIcon name={icon} className="relative size-10 stroke-[1.4] text-foreground/30 transition-colors duration-300 group-hover:text-primary/70" />
          <span className="relative text-[10px] font-semibold tracking-[0.2em] uppercase">Photo on request</span>
        </div>
      )}
    </div>
  );
}
