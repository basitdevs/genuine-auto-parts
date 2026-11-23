"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CarFront, ChevronDown, Loader2, Search, X } from "lucide-react";
import { rememberVehicle } from "@/app/(site)/account/actions";
import { partsHref, type PartsSearch } from "@/lib/search/params";
import { cn } from "@/lib/utils";
import {
  garageLabel,
  getGarageServerSnapshot,
  getGarageSnapshot,
  parseGarage,
  subscribeGarage,
  writeGarage,
} from "./garage";

export type Option = { value: string; label: string; count?: number };

type Props = {
  years: Option[];
  categories: Option[];
  /** Current /parts filters: prefill the bar and keep other refinements (keyword, price…) on submit. */
  initial?: Partial<PartsSearch>;
  /** Text colour of the "My vehicle" line: `dark` when the bar sits on a black surface. */
  tone?: "light" | "dark";
  onSubmitted?: () => void;
  className?: string;
};

async function fetchOptions(url: string, signal: AbortSignal): Promise<Option[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json: unknown = await res.json();
  return Array.isArray(json) ? (json as Option[]) : [];
}

/**
 * Year → Make → Model → Part finder in one segmented bar.
 * Dependent lists only show combinations that have parts in stock. Works as a plain
 * GET form to /parts without JS. The last vehicle is remembered ("My vehicle").
 */
export function VehicleSearch({ years, categories, initial, tone = "light", onSubmitted, className }: Props) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Saved vehicle cookie, read without a hydration mismatch (server snapshot is empty).
  const garageRaw = useSyncExternalStore(subscribeGarage, getGarageSnapshot, getGarageServerSnapshot);
  const garage = useMemo(() => parseGarage(garageRaw), [garageRaw]);
  const urlHasVehicle = Boolean(initial?.year || initial?.make);

  // `undefined` = untouched: fall back to the URL, then to the saved vehicle.
  const [yearSel, setYear] = useState<string | undefined>(initial?.year ? String(initial.year) : undefined);
  const [makeSel, setMake] = useState<string | undefined>(initial?.make);
  const [modelSel, setModel] = useState<string | undefined>(initial?.model);
  const [category, setCategory] = useState(initial?.category ?? "");
  const year = yearSel ?? (!urlHasVehicle && garage?.year ? String(garage.year) : "");
  const makeChoice = makeSel ?? (!urlHasVehicle ? (garage?.make ?? "") : "");
  const modelChoice = modelSel ?? (!urlHasVehicle ? (garage?.model ?? "") : "");

  // Dependent option lists, keyed by the inputs they were loaded for.
  const [makesData, setMakesData] = useState<{ key: string | null; options: Option[] }>({ key: null, options: [] });
  const [modelsData, setModelsData] = useState<{ key: string | null; options: Option[] }>({ key: null, options: [] });
  const loadingMakes = makesData.key !== year;
  const makes = makesData.options;
  const make = !makeChoice || loadingMakes || makes.some((o) => o.value === makeChoice) ? makeChoice : "";
  const modelsKey = `${make}|${year}`;
  const loadingModels = Boolean(make) && modelsData.key !== modelsKey;
  const models = make && !loadingModels ? modelsData.options : [];
  const model = !modelChoice || loadingModels || models.some((o) => o.value === modelChoice) ? modelChoice : "";

  useEffect(() => {
    const controller = new AbortController();
    fetchOptions(`/api/fitment/makes${year ? `?year=${year}` : ""}`, controller.signal)
      .then((options) => setMakesData({ key: year, options }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [year]);

  useEffect(() => {
    if (!make) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ make });
    if (year) params.set("year", year);
    fetchOptions(`/api/fitment/models?${params}`, controller.signal)
      .then((options) => setModelsData({ key: `${make}|${year}`, options }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [make, year]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const makeLabel = makes.find((o) => o.value === make)?.label;
    const modelLabel = models.find((o) => o.value === model)?.label;
    if (year || make) {
      const saved = { year: year ? Number(year) : undefined, make: make || undefined, makeLabel, model: model || undefined, modelLabel };
      writeGarage(saved);
      void rememberVehicle(saved).catch(() => undefined);
    }
    // Keep keyword/price/condition refinements from the current listing; vehicle + part replace.
    const keep: Partial<PartsSearch> = { ...initial, page: undefined, vehicle: undefined };
    const href = partsHref(keep, {
      year: year || null,
      make: make || null,
      model: model || null,
      category: category || null,
      stock: initial ? (initial.stock ?? false) : true,
    });
    startTransition(() => router.push(href));
    onSubmitted?.();
  }

  function clearGarage() {
    writeGarage(null);
    setYear("");
    setMake("");
    setModel("");
  }

  const savedLabel = garage ? garageLabel(garage) : "";

  return (
    <form action="/parts" method="get" onSubmit={onSubmit} role="search" aria-label="Find parts by vehicle" className={className}>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-lg shadow-black/10 ring-1 ring-border lg:grid-cols-[0.8fr_1fr_1.1fr_1.2fr_auto]">
        <Segment id={`${id}-year`} step={1} label="Year" done={Boolean(year)}>
          <select id={`${id}-year`} name="year" value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
            <option value="">Select year</option>
            {years.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Segment>

        <Segment id={`${id}-make`} step={2} label="Make" done={Boolean(make)} busy={loadingMakes}>
          <select
            id={`${id}-make`}
            name="make"
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
            }}
            aria-busy={loadingMakes}
            className={selectClass}
          >
            <option value="">{loadingMakes && makes.length === 0 ? "Loading…" : "Select make"}</option>
            {makes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Segment>

        <Segment id={`${id}-model`} step={3} label="Model" done={Boolean(model)} busy={loadingModels}>
          <select
            id={`${id}-model`}
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!make}
            aria-busy={loadingModels}
            className={selectClass}
          >
            <option value="">{!make ? "Select make first" : loadingModels ? "Loading…" : "Select model"}</option>
            {models.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Segment>

        <Segment id={`${id}-part`} step={4} label="Part" done={Boolean(category)}>
          <select id={`${id}-part`} name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">All parts</option>
            {categories.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Segment>

        {/* No-JS submit keeps the in-stock default. */}
        {!initial || initial.stock ? <input type="hidden" name="stock" value="1" /> : null}

        <button
          type="submit"
          disabled={pending}
          className="col-span-2 inline-flex h-14 items-center justify-center gap-2.5 bg-primary px-8 font-display text-lg font-bold tracking-wider text-primary-foreground uppercase transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary-foreground disabled:opacity-90 lg:col-span-1 lg:h-16"
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden strokeWidth={2.5} />}
          Search
        </button>
      </div>

      {savedLabel ? (
        <p className={cn("mt-3 flex flex-wrap items-center gap-2 text-sm", tone === "dark" ? "text-inverse-muted" : "text-muted-foreground")}>
          <CarFront className={cn("size-4", tone === "dark" ? "text-inverse-accent" : "text-primary")} aria-hidden />
          <span>My vehicle:</span>
          <span className={cn("font-semibold", tone === "dark" ? "text-inverse-foreground" : "text-foreground")}>{savedLabel}</span>
          <button
            type="button"
            onClick={clearGarage}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-1 text-xs underline-offset-2 hover:underline",
              tone === "dark" ? "hover:text-inverse-foreground" : "hover:text-foreground",
            )}
          >
            <X className="size-3" aria-hidden /> Clear
          </button>
        </p>
      ) : null}
    </form>
  );
}

const selectClass =
  "peer h-14 w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pt-5 pr-9 pl-4 text-[15px] font-medium text-foreground outline-none " +
  "disabled:cursor-not-allowed disabled:text-muted-foreground lg:h-16 lg:pt-6";

function Segment({
  id,
  step,
  label,
  done,
  busy = false,
  children,
}: {
  id: string;
  step: number;
  label: string;
  done: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-0 bg-background transition-colors hover:bg-muted/50 has-[select:disabled]:bg-muted/30 has-[select:disabled]:hover:bg-muted/30 has-[select:focus-visible]:bg-accent/60 has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-primary has-[select:focus-visible]:ring-inset">
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-2 left-4 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase lg:top-2.5"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-4 items-center justify-center rounded-full text-[9px] tracking-normal transition-colors",
            done ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-muted-foreground",
          )}
        >
          {step}
        </span>
        {label}
      </label>
      {children}
      {busy ? (
        <Loader2 aria-hidden className="pointer-events-none absolute right-3 bottom-4 size-4 animate-spin text-muted-foreground lg:bottom-5" />
      ) : (
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 bottom-4 size-4 text-muted-foreground lg:bottom-5" />
      )}
    </div>
  );
}
