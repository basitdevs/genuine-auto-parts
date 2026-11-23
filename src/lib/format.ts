const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US");

export const formatPrice = (value: number) => usd.format(value);
export const formatCompact = (value: number) => compact.format(value);
export const formatNumber = (value: number) => integer.format(value);

export function formatYearRange(years: number[]): string {
  if (years.length === 0) return "";
  const sorted = [...years].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last ? String(first) : `${first}–${last}`;
}

export const conditionLabel: Record<string, string> = {
  used: "Used OEM",
  new: "New",
  remanufactured: "Remanufactured",
  for_parts: "For parts",
};
