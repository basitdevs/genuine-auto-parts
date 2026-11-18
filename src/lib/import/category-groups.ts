/**
 * Top-level storefront categories. eBay leaf categories are attached as children
 * by the importer using the keyword rules below (first match wins), and the
 * eBay category number is stored on the child (`categories.ebay_category_id`).
 */
export type CategoryGroup = {
  slug: string;
  name: string;
  icon: string; // lucide-react icon name, see src/components/catalog/category-icon.tsx
  description: string;
  /** Lower-case substrings matched against the eBay category name. */
  match: string[];
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    slug: "airbags-safety",
    name: "Airbags & Safety",
    icon: "shield",
    description: "Seat belts, SRS modules and safety components.",
    match: ["seat belt", "airbag"],
  },
  {
    slug: "lighting",
    name: "Headlights & Taillights",
    icon: "lightbulb",
    description: "Headlights, taillights, fog lights, ballasts and interior lighting.",
    match: ["light", "lamp", "ballast", "reflector"],
  },
  {
    slug: "electrical-modules",
    name: "ECUs, Modules & Electrical",
    icon: "cpu",
    description: "Engine computers, control modules, switches, wiring and charging.",
    match: [
      "ecu", "computer", "switches", "wiring", "starter", "alternator", "ignition", "relay",
      "battery", "voltage", "converters & inverters", "electric", "sensor", "key blank",
      "anti-theft", "power outlet", "radar",
    ],
  },
  {
    slug: "audio-electronics",
    name: "Audio, Nav & Gauges",
    icon: "radio",
    description: "Stereos, screens, speakers, cameras and instrument clusters.",
    match: ["stereo", "speaker", "screen", "camera", "antenna", "faceplate", "instrument", "gauge", "clock"],
  },
  {
    slug: "engine",
    name: "Engines & Components",
    icon: "cog",
    description: "Engines, heads, intake, throttle bodies, turbos and engine hardware.",
    match: [
      "engine", "intake", "throttle", "turbo", "intercooler", "camshaft", "crankshaft", "cylinder head",
      "valve", "timing", "oil", "belt", "pulley", "idler", "flywheel", "vacuum pump", "manifolds & headers",
      "air filter",
    ],
  },
  {
    slug: "transmission-drivetrain",
    name: "Transmissions & Drivetrain",
    icon: "settings-2",
    description: "Transmissions, axles, differentials, driveshafts and shifters.",
    match: ["transmission", "axle", "differential", "driveshaft", "clutch", "torque converter", "shifter", "drivetrain"],
  },
  {
    slug: "suspension-steering",
    name: "Suspension & Steering",
    icon: "move-vertical",
    description: "Control arms, struts, knuckles, racks and wheel bearings.",
    match: ["control arm", "shocks", "strut", "knuckle", "rack", "steering", "sway bar", "spring", "wheel bearing", "suspension"],
  },
  {
    slug: "brakes",
    name: "Brakes & ABS",
    icon: "disc",
    description: "Calipers, ABS pumps, master cylinders and brake hardware.",
    match: ["brake", "caliper", "abs", "master cylinder"],
  },
  {
    slug: "cooling-hvac",
    name: "Cooling & A/C",
    icon: "snowflake",
    description: "Radiators, fans, A/C compressors, condensers and climate controls.",
    match: ["a/c", "radiator", "fan", "hvac", "heater", "thermostat", "water pump", "expansion", "air conditioning", "ducts"],
  },
  {
    slug: "fuel-exhaust",
    name: "Fuel & Exhaust",
    icon: "fuel",
    description: "Fuel pumps, tanks, injectors, exhaust and emissions parts.",
    match: ["fuel", "exhaust", "muffler", "catalytic", "egr", "smog", "emission"],
  },
  {
    slug: "wheels-tires",
    name: "Wheels & Tires",
    icon: "circle-dot",
    description: "OEM wheels, spares, center caps, jacks and TPMS sensors.",
    match: ["wheel", "tire"],
  },
  {
    slug: "interior",
    name: "Interior",
    icon: "armchair",
    description: "Seats, door panels, consoles, dash, visors and interior trim.",
    match: [
      "seat", "door panel", "console", "dash", "visor", "interior", "cup holder", "glove box", "headliner",
      "floor mat", "cargo", "pedal", "window crank", "manual", "trim",
    ],
  },
  {
    slug: "body-exterior",
    name: "Body & Exterior",
    icon: "car-front",
    description: "Bumpers, fenders, doors, hoods, grilles, mirrors and glass.",
    match: [
      "bumper", "fender", "door", "hood", "grille", "mirror", "hatch", "trunk", "liftgate", "tailgate", "panel",
      "molding", "body", "glass", "spoiler", "air dam", "roof", "sunroof", "convertible", "hardtop", "running board",
      "splash", "lock", "hinge", "window motor", "wiper", "washer", "license plate", "hitch", "exterior", "lift support",
      "handlebar",
    ],
  },
];

/** Catch-all when no rule matches. */
export const FALLBACK_CATEGORY_GROUP: CategoryGroup = {
  slug: "other-parts",
  name: "Other Parts & Accessories",
  icon: "package",
  description: "Everything else from our dismantling line.",
  match: [],
};

/** Explicit eBay category number -> group slug, for names the keyword rules get wrong. */
export const EBAY_CATEGORY_OVERRIDES: Record<number, string> = {
  33704: "interior", // Steering Wheels & Horn Buttons
  262120: "cooling-hvac", // Fan Clutches
  183718: "other-parts", // Owner & Operator Manuals
};

export function groupForEbayCategory(ebayCategoryName: string, ebayCategoryId?: number): CategoryGroup {
  const overrideSlug = ebayCategoryId ? EBAY_CATEGORY_OVERRIDES[ebayCategoryId] : undefined;
  if (overrideSlug) {
    return CATEGORY_GROUPS.find((g) => g.slug === overrideSlug) ?? FALLBACK_CATEGORY_GROUP;
  }
  const name = ebayCategoryName.toLowerCase();
  return CATEGORY_GROUPS.find((group) => group.match.some((m) => name.includes(m))) ?? FALLBACK_CATEGORY_GROUP;
}
