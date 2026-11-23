"use client";

import { useState } from "react";
import type { CardImage } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { PartImage } from "./part-image";

/** Main photo + clickable thumbnails (first photo loads eagerly; it's the LCP image). */
export function ProductGallery({ images, icon }: { images: CardImage[]; icon: string | null }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0] ?? null;

  return (
    <div>
      <PartImage image={current} icon={icon} sizes="(min-width: 1024px) 600px, 100vw" eager className="rounded-lg border" />
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product photos">
          {images.slice(0, 10).map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === active || undefined}
                className={cn(
                  "block w-full overflow-hidden rounded-md border-2 transition-colors",
                  i === active ? "border-primary" : "border-transparent hover:border-foreground/30",
                )}
              >
                <PartImage image={img} sizes="120px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
