import type { StaticImageData } from "next/image";
import engineBay from "@/assets/images/engine-bay.jpg";
import salvageYard from "@/assets/images/salvage-yard.jpg";
import workshopLift from "@/assets/images/workshop-lift.jpg";

/**
 * Site photography. All images are from Unsplash under the Unsplash License
 * (free for commercial use, no attribution required). Credits kept here for reference.
 * Swap any of these for photos of the real yard when they're available.
 */
export type SiteImage = { src: StaticImageData; alt: string; credit: string; source: string };

export const media = {
  workshopLift: {
    src: workshopLift,
    alt: "A car raised on a lift in a busy workshop, hood open",
    credit: "KC Shum",
    source: "https://unsplash.com/photos/Hv_gKPOXmwE",
  },
  salvageYard: {
    src: salvageYard,
    alt: "Vehicles stacked at a salvage yard",
    credit: "Documerica (1972), U.S. National Archives",
    source: "https://unsplash.com/photos/W4-ID9V8JSY",
  },
  engineBay: {
    src: engineBay,
    alt: "Clean OEM engine bay with the hood open",
    credit: "Luca Hooijer",
    source: "https://unsplash.com/photos/u3RhNe3QJeM",
  },
} satisfies Record<string, SiteImage>;
