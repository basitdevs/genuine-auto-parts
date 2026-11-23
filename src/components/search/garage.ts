import { GARAGE_COOKIE } from "@/config/site";

/** "My Garage": the shopper's last selected vehicle, kept in a first-party cookie for a year. */
export type GarageVehicle = {
  year?: number;
  make?: string;
  makeLabel?: string;
  model?: string;
  modelLabel?: string;
};

const EVENT = "garage-change";

/** Raw cookie value; a string so useSyncExternalStore gets a stable snapshot. */
export function getGarageSnapshot(): string {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${GARAGE_COOKIE}=`));
  return raw ? raw.slice(GARAGE_COOKIE.length + 1) : "";
}

export const getGarageServerSnapshot = () => "";

export function subscribeGarage(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function parseGarage(raw: string): GarageVehicle | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const str = (x: unknown) => (typeof x === "string" && x ? x : undefined);
    return {
      year: typeof v.year === "number" ? v.year : undefined,
      make: str(v.make),
      makeLabel: str(v.makeLabel),
      model: str(v.model),
      modelLabel: str(v.modelLabel),
    };
  } catch {
    return null;
  }
}

export function writeGarage(vehicle: GarageVehicle | null) {
  if (!vehicle || (!vehicle.year && !vehicle.make)) {
    document.cookie = `${GARAGE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } else {
    document.cookie = `${GARAGE_COOKIE}=${encodeURIComponent(JSON.stringify(vehicle))}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function garageLabel(v: GarageVehicle): string {
  return [v.year, v.makeLabel ?? v.make, v.modelLabel ?? v.model].filter(Boolean).join(" ");
}
