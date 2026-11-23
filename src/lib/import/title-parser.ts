import { MAKELESS_MODEL_HINTS, VEHICLE_REFERENCE, type MakeRef, type ModelRef } from "./vehicle-reference";

/**
 * eBay "All active listings" reports carry no item specifics or compatibility
 * table, so fitment and part numbers have to be recovered from titles like:
 *   "08-14 MERCEDES C-CLASS Strut Assembly Left LH W204 Front C300 Rwd"
 *   "2012-2018 BMW 328 328I F30 Front Seat 7243537 Lower Cushion Biege RIGHT Manual"
 */
export type ParsedTitle = {
  years: number[];
  makeSlug: string | null;
  modelSlug: string | null;
  trim: string | null;
  engine: string | null;
  driveType: string | null;
  placement: string | null;
  partNumbers: string[];
  warnings: string[];
};

/** Evaluated when used, never at import time (module-level clocks break prerendering). */
const currentYear = () => new Date().getFullYear();
const MAX_RANGE = 40;

function expandYear(token: string): number | null {
  if (!/^\d{2}(\d{2})?$/.test(token)) return null;
  let year = Number(token);
  if (token.length === 2) year += year <= (currentYear() % 100) + 1 ? 2000 : 1900;
  return year >= 1950 && year <= currentYear() + 1 ? year : null;
}

/** Reads the leading year list/range ("2007 2008 2009 - 2014", "08-14", "2019-2024"). */
export function parseLeadingYears(title: string): { years: number[]; rest: string } {
  // Only the leading tokens are split on "-" ("08-14"); part numbers later in the title keep their hyphens.
  const tokens = title.trim().split(/\s+/);
  const years = new Set<number>();
  let last: number | null = null;
  let pendingRange = false;
  let i = 0;
  for (; i < tokens.length; i++) {
    const parts = tokens[i].split(/(-)/).filter(Boolean);
    if (!parts.every((p) => (p === "-" ? last !== null || parts.indexOf(p) > 0 : expandYear(p) !== null))) break;
    for (const part of parts) {
      if (part === "-") {
        pendingRange = true;
        continue;
      }
      const year = expandYear(part) as number;
      if (pendingRange && last !== null && year > last && year - last <= MAX_RANGE) {
        for (let y = last + 1; y <= year; y++) years.add(y);
      } else {
        years.add(year);
      }
      pendingRange = false;
      last = year;
    }
  }
  return { years: [...years].sort((a, b) => a - b), rest: tokens.slice(i).join(" ") };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (alias: string) => new RegExp(`(?:^|[^A-Z0-9])${escapeRe(alias)}(?=$|[^A-Z0-9])`);

type AliasEntry<T> = { alias: string; re: RegExp; ref: T };

function aliasIndex<T>(items: T[], aliasesOf: (item: T) => string[]): AliasEntry<T>[] {
  return items
    .flatMap((ref) => aliasesOf(ref).map((alias) => ({ alias, re: wordRe(alias), ref })))
    .sort((a, b) => b.alias.length - a.alias.length); // longest alias first ("RANGE ROVER SPORT" before "RANGE ROVER")
}

const MAKE_INDEX = aliasIndex(VEHICLE_REFERENCE, (make) => make.aliases);
const MODEL_INDEX = new Map<string, AliasEntry<ModelRef>[]>(
  VEHICLE_REFERENCE.map((make) => [make.slug, aliasIndex(make.models, (model) => model.aliases)]),
);
const MAKELESS_INDEX = Object.entries(MAKELESS_MODEL_HINTS)
  .map(([alias, hint]) => ({ alias, re: wordRe(alias), hint }))
  .sort((a, b) => b.alias.length - a.alias.length);

const PLACEMENT_RULES: Array<[RegExp, string]> = [
  [/\b(FRONT|FRT)\b/, "Front"],
  [/\b(REAR|RR)\b/, "Rear"],
  [/\b(LEFT|LH|DRIVER)\b/, "Left"],
  [/\b(RIGHT|RH|PASSENGER)\b/, "Right"],
  [/\b(UPPER)\b/, "Upper"],
  [/\b(LOWER)\b/, "Lower"],
];

const DRIVE_RE = /\b(AWD|FWD|RWD|4WD|4X4|4MATIC|XDRIVE|QUATTRO)\b/;
const ENGINE_RE = /\b(\d\.\d)\s?L\b/;

/** Words that look like part numbers but are not. */
const NOT_PART_NUMBER = /^(\d{2}X\d|\d{1,2}X\d|\d\.\dL?$|\d{1,4}$|[A-Z]+$|W\d{3}$|[FGE]\d{2}$|R\d{3}$|\d{3,4}[RIX]$)/;

const compactPn = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Words glued together by the listing tool ("LEFT204", "RIGHTRH204", "W204C300", "C300000"):
 * a placement word or a model/chassis code followed by more characters.
 */
function isGluedWord(token: string): boolean {
  const t = compactPn(token);
  if (/^(LEFT|RIGHT|LH|RH|FRONT|REAR|UPPER|LOWER)[A-Z0-9]/.test(t)) return true;
  if (/^[A-Z]{1,3}\d{3}[A-Z]\d{2,3}$/.test(t)) return true; // W204C300
  if (/^\d{2,4}[A-Z]{4,}$/.test(t)) return true; // 2023MALIBU
  for (const vehicle of VEHICLE_TOKENS) {
    if (t !== vehicle && t.startsWith(vehicle) && /^[A-Z]/.test(vehicle)) return true; // C300000
  }
  return false;
}

/** Model / trim / chassis aliases ("IS350", "ML350", "328I") are never part numbers. */
const VEHICLE_TOKENS = new Set(
  VEHICLE_REFERENCE.flatMap((make) => make.models.flatMap((model) => [...model.aliases, ...Object.keys(model.trims ?? {})]))
    .map(compactPn)
    .filter((t) => t.length >= 4),
);

/**
 * Pulls OEM-style part numbers from the remaining title text.
 * Handles explicit markers ("Part# 52029841 AE", "P/N 123"), grouped formats
 * ("A 176 860 0269", "3C8 868 133", "92401 J5000", "14041 - 3TA1A") and plain tokens.
 */
export function extractPartNumbers(text: string): string[] {
  const upper = ` ${text.toUpperCase()} `;
  const candidates: { value: string; index: number }[] = [];
  const push = (value: string, index: number) => {
    const v = value.trim().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ");
    const compact = compactPn(v);
    if (compact.length < 5 || !/\d{3}/.test(compact) || VEHICLE_TOKENS.has(compact)) return;
    // Grouped matches like "320 328 328I" are trim lists, not part numbers.
    if (v.split(/[\s-]+/).some((part) => VEHICLE_TOKENS.has(compactPn(part)))) return;
    candidates.push({ value: v, index });
  };

  const patterns: RegExp[] = [
    /\b(A\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2})\b/g, // Mercedes "A 176 860 0269"
    /\b(\d{3}\s\d{3}\s\d{2}\s?\d{2})\b/g, // Mercedes without prefix "002 540 1897"
    /\b(\d[A-Z0-9]{2}\s\d{3}\s\d{3}(?:\s?[A-Z]{1,2})?)\b/g, // VAG "3C8 868 133", "4G0 121 403 R"
    /\b(\d{5}\s?-\s?[A-Z0-9]{5})\b/g, // Hyundai/Kia/Nissan "14041 - 3TA1A"
    /\b(\d{5}\s[A-Z]\d{4})\b/g, // "92401 J5000"
    /\b(\d{4}\s\d{3}\s\d{3})\b/g, // Bosch "0130 822 662"
    /\b([A-Z0-9]{4}[- ][A-Z0-9]{4,6}-[A-Z]{1,3})\b/g, // Ford "DS7E-9F991-BB" / "DS7E 9F991-BB"
  ];
  for (const re of patterns) for (const match of upper.matchAll(re)) push(match[1], match.index ?? 0);

  // Plain tokens (hyphens kept): 5+ chars with at least 3 digits, not a dimension, year or chassis code.
  let offset = 0;
  let previous = "";
  for (const raw of upper.split(/\s+/)) {
    const index = upper.indexOf(raw, offset);
    offset = index + raw.length;
    const token = raw.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "").replace(/^PART#?/, "");
    const afterVin = previous === "VIN"; // "From Vin F016399" is a VIN fragment, not a part number
    previous = token;
    if (afterVin || compactPn(token).length < 5 || NOT_PART_NUMBER.test(token) || isGluedWord(token)) continue;
    if ((token.match(/\d/g) ?? []).length < 3) continue;
    push(token, index);
  }

  // Keep the most complete form: drop candidates contained in a longer one, then dedupe; title order.
  const kept = candidates.filter(
    (c) => !candidates.some((o) => o !== c && compactPn(o.value).length > compactPn(c.value).length && compactPn(o.value).includes(compactPn(c.value))),
  );
  const seen = new Set<string>();
  return kept
    .sort((a, b) => a.index - b.index)
    .filter((c) => {
      const key = compactPn(c.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => c.value);
}

function findModel(make: MakeRef, text: string): { model: ModelRef; trim: string | null } | null {
  const index = MODEL_INDEX.get(make.slug) ?? [];
  let model: ModelRef | null = null;
  for (const entry of index) {
    if (entry.re.test(text)) {
      model = entry.ref;
      break;
    }
  }
  if (!model) return null;
  // The first trim alias in the title wins; on the same position the longer one ("328I" over "328").
  let best: { key: string; index: number } | null = null;
  for (const key of Object.keys(model.trims ?? {})) {
    const match = wordRe(key).exec(text);
    if (!match) continue;
    if (!best || match.index < best.index || (match.index === best.index && key.length > best.key.length)) {
      best = { key, index: match.index };
    }
  }
  return { model, trim: best ? (model.trims?.[best.key] ?? null) : null };
}

export function parseTitle(title: string): ParsedTitle {
  const warnings: string[] = [];
  const { years, rest } = parseLeadingYears(title);
  const text = ` ${rest.toUpperCase()} `;
  if (years.length === 0) warnings.push("No model years found at the start of the title");

  let make: MakeRef | null = null;
  let makeEnd = 0;
  for (const entry of MAKE_INDEX) {
    const match = entry.re.exec(text);
    if (match) {
      make = entry.ref;
      makeEnd = match.index + match[0].length;
      break;
    }
  }

  let modelSlug: string | null = null;
  let trim: string | null = null;
  if (make) {
    // "DODGE RAM ..." keeps Dodge; a bare "RAM 1500" is the Ram brand.
    const found = findModel(make, text.slice(makeEnd)) ?? findModel(make, text);
    modelSlug = found?.model.slug ?? null;
    trim = found?.trim ?? null;
  } else {
    const hint = MAKELESS_INDEX.find((entry) => entry.re.test(text));
    if (hint) {
      make = VEHICLE_REFERENCE.find((mk) => mk.slug === hint.hint.make) ?? null;
      modelSlug = hint.hint.model;
      if (make) trim = findModel(make, text)?.trim ?? null;
    }
  }
  if (!make) warnings.push("Make not recognised");
  else if (!modelSlug) warnings.push(`Model not recognised for ${make.name}`);

  const placementParts = PLACEMENT_RULES.filter(([re]) => re.test(text)).map(([, label]) => label);
  const engine = ENGINE_RE.exec(text)?.[1];
  const drive = DRIVE_RE.exec(text)?.[1];

  return {
    years,
    makeSlug: make?.slug ?? null,
    modelSlug,
    trim,
    engine: engine ? `${engine}L` : null,
    driveType: drive ?? null,
    placement: placementParts.length ? placementParts.join(" ") : null,
    partNumbers: extractPartNumbers(rest),
    warnings,
  };
}
