"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton, FieldError } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import type { SettingsKey, SettingsValues } from "@/lib/settings/schema";
import { POLICY_PAGE_SLUGS } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";
import { resetSetting, saveSetting } from "./actions";

/** Shared Save / Reset frame for one settings key. */
export function SettingsForm<K extends SettingsKey>({
  settingKey,
  value,
  children,
  customised,
  description,
  toValue,
}: {
  settingKey: K;
  value: SettingsValues[K];
  children: (errors: Record<string, string>) => ReactNode;
  customised: boolean;
  description?: ReactNode;
  toValue?: () => unknown;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveSetting(settingKey, toValue ? toValue() : value);
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.message);
        });
      }}
      className="grid gap-5"
    >
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {children(errors)}
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save</Button>
        {customised ? (
          <ConfirmButton
            variant="ghost"
            title="Reset to the built-in default?"
            description="Your saved version is removed and the site goes back to the original text and values."
            confirmLabel="Reset"
            onConfirm={() =>
              startTransition(async () => {
                const r = await resetSetting(settingKey);
                if (r.ok) {
                  toast.success(r.message);
                  router.refresh();
                } else toast.error(r.message);
              })
            }
          >
            <RotateCcw aria-hidden /> Reset to default
          </ConfirmButton>
        ) : (
          <span className="text-xs text-muted-foreground">Showing the built-in default.</span>
        )}
      </div>
    </form>
  );
}

function Text({ label, value, onChange, error, hint, ...props }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass, "h-10 font-normal", error && "border-destructive")} {...props} />
      {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
      <FieldError message={error} />
    </label>
  );
}

function Area({ label, value, onChange, rows = 4, error, hint, mono }: { label: string; value: string; onChange: (v: string) => void; rows?: number; error?: string; hint?: string; mono?: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={cn(fieldClass, "h-auto py-2 font-normal", mono && "font-mono text-xs", error && "border-destructive")} />
      {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
      <FieldError message={error} />
    </label>
  );
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// --------------------------------------------------------------------------- business
export function BusinessEditor({ initial, customised }: { initial: SettingsValues["business"]; customised: boolean }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <SettingsForm settingKey="business" value={v} customised={customised} description="Shown in the header, footer, contact page, packing slips and Google structured data. Empty fields are hidden on the site.">
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Business name" value={v.name} onChange={(x) => set("name", x)} error={e.name} />
            <Text label="Legal name" value={v.legalName} onChange={(x) => set("legalName", x)} error={e.legalName} />
            <Text label="Phone" value={v.phone} onChange={(x) => set("phone", x)} error={e.phone} type="tel" placeholder="(602) 555-0100" />
            <Text label="Email" value={v.email} onChange={(x) => set("email", x)} error={e.email} type="email" />
          </div>
          <Text label="Tagline" value={v.tagline} onChange={(x) => set("tagline", x)} error={e.tagline} />
          <Area label="Short description" value={v.description} onChange={(x) => set("description", x)} rows={2} error={e.description} />
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Address</p>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_80px_100px]">
            <Text label="Street" value={v.street} onChange={(x) => set("street", x)} error={e.street} />
            <Text label="City" value={v.city} onChange={(x) => set("city", x)} error={e.city} />
            <Text label="State" value={v.region} onChange={(x) => set("region", x)} error={e.region} />
            <Text label="ZIP" value={v.postalCode} onChange={(x) => set("postalCode", x)} error={e.postalCode} />
          </div>
          <Text label="Google Maps link" value={v.googleMapsUrl} onChange={(x) => set("googleMapsUrl", x)} error={e.googleMapsUrl} type="url" />
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">Opening hours</p>
            <div className="grid gap-2">
              {v.hours.map((h, i) => (
                <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_110px_110px_auto]">
                  <Text label="Label" value={h.days} onChange={(x) => set("hours", v.hours.map((y, j) => (j === i ? { ...y, days: x } : y)))} placeholder="Mon–Fri" error={e[`hours.${i}.days`]} />
                  <Text label="Opens" value={h.opens} onChange={(x) => set("hours", v.hours.map((y, j) => (j === i ? { ...y, opens: x } : y)))} type="time" error={e[`hours.${i}.opens`]} />
                  <Text label="Closes" value={h.closes} onChange={(x) => set("hours", v.hours.map((y, j) => (j === i ? { ...y, closes: x } : y)))} type="time" error={e[`hours.${i}.closes`]} />
                  <button type="button" onClick={() => set("hours", v.hours.filter((_, j) => j !== i))} className="self-end rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove hours row"><Trash2 className="size-4" aria-hidden /></button>
                  <fieldset className="flex flex-wrap gap-2 sm:col-span-4">
                    <legend className="sr-only">Days</legend>
                    {DAYS.map((d) => (
                      <label key={d} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={h.schemaDays.includes(d)}
                          onChange={(ev) => set("hours", v.hours.map((y, j) => (j === i ? { ...y, schemaDays: ev.target.checked ? [...y.schemaDays, d] : y.schemaDays.filter((z) => z !== d) } : y)))}
                          className="size-3.5 accent-primary"
                        />
                        {d.slice(0, 3)}
                      </label>
                    ))}
                    <FieldError message={e[`hours.${i}.schemaDays`]} />
                  </fieldset>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => set("hours", [...v.hours, { days: "Mon–Fri", opens: "08:00", closes: "17:00", schemaDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }])}>
                  <Plus aria-hidden /> Add hours
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Reviews & social</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Google star rating" value={v.ratingValue === null ? "" : String(v.ratingValue)} onChange={(x) => set("ratingValue", x === "" ? null : Number(x))} inputMode="decimal" placeholder="e.g. 4.9" hint="Leave empty to hide stars." error={e.ratingValue} />
            <Text label="Google review count" value={String(v.googleReviewCount)} onChange={(x) => set("googleReviewCount", Number(x.replace(/\D/g, "") || 0))} inputMode="numeric" error={e.googleReviewCount} />
            <Text label="Facebook URL" value={v.facebook} onChange={(x) => set("facebook", x)} type="url" error={e.facebook} />
            <Text label="Instagram URL" value={v.instagram} onChange={(x) => set("instagram", x)} type="url" error={e.instagram} />
            <Text label="eBay store URL" value={v.ebayStore} onChange={(x) => set("ebayStore", x)} type="url" error={e.ebayStore} />
          </div>
        </>
      )}
    </SettingsForm>
  );
}

// --------------------------------------------------------------------------- policies + shipping
export function PolicyNumbersEditor({ initial, customised }: { initial: SettingsValues["policies"]; customised: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <SettingsForm settingKey="policies" value={v} customised={customised} description="Used everywhere the site mentions the warranty or return window (product pages, cart, FAQ, policies).">
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Parts warranty (days)" value={String(v.warrantyDays)} onChange={(x) => setV({ ...v, warrantyDays: Number(x.replace(/\D/g, "") || 0) })} inputMode="numeric" error={e.warrantyDays} />
          <Text label="Return window (days)" value={String(v.returnDays)} onChange={(x) => setV({ ...v, returnDays: Number(x.replace(/\D/g, "") || 0) })} inputMode="numeric" error={e.returnDays} />
        </div>
      )}
    </SettingsForm>
  );
}

export function ShippingEditor({ initial, customised }: { initial: SettingsValues["shipping"]; customised: boolean }) {
  const [v, setV] = useState(initial);
  const strategy = v.strategy;
  return (
    <SettingsForm settingKey="shipping" value={v} customised={customised} description="Freight items are always quoted manually. Until “Quote prices” is on, the site says shipping is confirmed before payment.">
      {(e) => (
        <>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={v.confirmed} onChange={(ev) => setV({ ...v, confirmed: ev.target.checked })} className="size-4 accent-primary" />
            Quote shipping prices on the site (rules below)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Handling time" value={v.handlingTime} onChange={(x) => setV({ ...v, handlingTime: x })} error={e.handlingTime} />
            <Text label="Free shipping over ($)" value={v.freeOverThreshold === null ? "" : String(v.freeOverThreshold)} onChange={(x) => setV({ ...v, freeOverThreshold: x === "" ? null : Number(x) })} inputMode="decimal" hint="Empty = no free-shipping threshold." error={e.freeOverThreshold} />
          </div>
          <Area label="Freight message" value={v.freightMessage} onChange={(x) => setV({ ...v, freightMessage: x })} rows={2} error={e.freightMessage} />
          <fieldset className="grid gap-3 rounded-md border p-4">
            <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">Rate</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={strategy.kind === "flat"} onChange={() => setV({ ...v, strategy: { kind: "flat", rate: 14.95 } })} className="accent-primary" /> Flat rate</label>
              <label className="flex items-center gap-2"><input type="radio" checked={strategy.kind === "weight"} onChange={() => setV({ ...v, strategy: { kind: "weight", defaultWeightLb: 5, overMaxRate: 89, tiers: [{ maxLb: 2, rate: 9.95 }, { maxLb: 10, rate: 14.95 }, { maxLb: 30, rate: 24.95 }, { maxLb: 70, rate: 49.95 }] } })} className="accent-primary" /> By weight</label>
            </div>
            {strategy.kind === "flat" ? (
              <Text label="Flat rate ($)" value={String(strategy.rate)} onChange={(x) => setV({ ...v, strategy: { kind: "flat", rate: Number(x) || 0 } })} inputMode="decimal" />
            ) : (
              <div className="grid gap-2">
                {strategy.tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <Text label={`Up to (lb)`} value={String(t.maxLb)} onChange={(x) => setV({ ...v, strategy: { ...strategy, tiers: strategy.tiers.map((y, j) => (j === i ? { ...y, maxLb: Number(x) || 0 } : y)) } })} inputMode="decimal" />
                    <Text label="Rate ($)" value={String(t.rate)} onChange={(x) => setV({ ...v, strategy: { ...strategy, tiers: strategy.tiers.map((y, j) => (j === i ? { ...y, rate: Number(x) || 0 } : y)) } })} inputMode="decimal" />
                    <button type="button" onClick={() => setV({ ...v, strategy: { ...strategy, tiers: strategy.tiers.filter((_, j) => j !== i) } })} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove tier"><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Text label="Over the last tier ($)" value={String(strategy.overMaxRate)} onChange={(x) => setV({ ...v, strategy: { ...strategy, overMaxRate: Number(x) || 0 } })} inputMode="decimal" />
                  <Text label="Weight when unknown (lb)" value={String(strategy.defaultWeightLb)} onChange={(x) => setV({ ...v, strategy: { ...strategy, defaultWeightLb: Number(x) || 1 } })} inputMode="decimal" />
                </div>
                <div><Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, strategy: { ...strategy, tiers: [...strategy.tiers, { maxLb: (strategy.tiers.at(-1)?.maxLb ?? 0) + 10, rate: 0 }] } })}><Plus aria-hidden /> Add tier</Button></div>
              </div>
            )}
            <FieldError message={e["strategy.tiers"] ?? e.strategy} />
          </fieldset>
        </>
      )}
    </SettingsForm>
  );
}

// --------------------------------------------------------------------------- home
const SECTION_LABELS: Record<keyof SettingsValues["home"]["sections"], string> = {
  makes: "Shop by make", categories: "Shop by category", newest: "Newest arrivals", vehicles: "Currently dismantling",
  sellCar: "Sell your car", quality: "Quality standard", reviews: "Customer reviews", newsletter: "Newsletter",
};

export function HomeEditor({ initial, customised }: { initial: SettingsValues["home"]; customised: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <SettingsForm settingKey="home" value={v} customised={customised} description="Hero text, the four stats under it, and which sections appear on the home page.">
      {(e) => (
        <>
          <Text label="Small label above the headline" value={v.heroEyebrow} onChange={(x) => setV({ ...v, heroEyebrow: x })} error={e.heroEyebrow} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Headline (white)" value={v.heroTitle} onChange={(x) => setV({ ...v, heroTitle: x })} error={e.heroTitle} />
            <Text label="Headline (red)" value={v.heroAccent} onChange={(x) => setV({ ...v, heroAccent: x })} error={e.heroAccent} />
          </div>
          <Area label="Intro text" value={v.heroText} onChange={(x) => setV({ ...v, heroText: x })} rows={2} hint="Leave empty for the automatic text with the live part count." error={e.heroText} />
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">Stats</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {v.stats.map((st, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-3">
                  <Text label={`Value ${i + 1}`} value={st.value} onChange={(x) => setV({ ...v, stats: v.stats.map((y, j) => (j === i ? { ...y, value: x } : y)) })} error={e[`stats.${i}.value`]} />
                  <Text label="Label" value={st.label} onChange={(x) => setV({ ...v, stats: v.stats.map((y, j) => (j === i ? { ...y, label: x } : y)) })} error={e[`stats.${i}.label`]} />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Use <code>{"{parts}"}</code> or <code>{"{makes}"}</code> as a value for the live catalog numbers.</p>
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">Sections</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((k) => (
                <label key={k} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input type="checkbox" checked={v.sections[k]} onChange={(ev) => setV({ ...v, sections: { ...v.sections, [k]: ev.target.checked } })} className="size-4 accent-primary" />
                  {SECTION_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </SettingsForm>
  );
}

// --------------------------------------------------------------------------- reviews
type Review = SettingsValues["reviews"]["items"][number];
export function ReviewsEditor({ initial, customised }: { initial: SettingsValues["reviews"]; customised: boolean }) {
  const [items, setItems] = useState<Review[]>(initial.items);
  const featured = items.filter((r) => r.featured).length;
  const update = (i: number, patch: Partial<Review>) => setItems((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => setItems((list) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  return (
    <SettingsForm settingKey="reviews" value={{ items }} customised={customised} description={<>Star the reviews to feature on the home page (up to 6; the first starred one is shown large). <strong>{featured}</strong> featured.</>}>
      {(e) => (
        <div className="grid gap-3">
          {items.map((r, i) => (
            <div key={i} className={cn("grid gap-3 rounded-md border p-3", r.featured && "border-primary/50 bg-accent/30")}>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => update(i, { featured: !r.featured })} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold", r.featured ? "border-primary bg-primary text-white" : "bg-background")} aria-pressed={r.featured}>
                  <Star className={cn("size-3.5", r.featured && "fill-white")} aria-hidden /> {r.featured ? "Featured" : "Feature"}
                </button>
                <span className="text-sm font-semibold">{r.author || "New review"}</span>
                <span className="text-xs text-muted-foreground">{r.date}</span>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Move up"><ArrowUp className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Move down"><ArrowDown className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => setItems((list) => list.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete review"><Trash2 className="size-4" aria-hidden /></button>
                </div>
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Edit</summary>
                <div className="mt-3 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Text label="Author" value={r.author} onChange={(x) => update(i, { author: x })} error={e[`items.${i}.author`]} />
                    <Text label="Month (YYYY-MM)" value={r.date} onChange={(x) => update(i, { date: x })} error={e[`items.${i}.date`]} />
                    <Text label="Translated from" value={r.translatedFrom} onChange={(x) => update(i, { translatedFrom: x })} placeholder="e.g. Spanish" />
                  </div>
                  <Area label="Review" value={r.text} onChange={(x) => update(i, { text: x })} rows={3} error={e[`items.${i}.text`]} />
                  <Area label="Owner reply" value={r.ownerReply} onChange={(x) => update(i, { ownerReply: x })} rows={2} />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={r.localGuide} onChange={(ev) => update(i, { localGuide: ev.target.checked })} className="size-3.5 accent-primary" /> Local Guide</label>
                </div>
              </details>
              {!r.featured ? null : <p className="line-clamp-2 text-sm text-muted-foreground">“{r.text}”</p>}
            </div>
          ))}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems([{ author: "", text: "", date: new Date().toISOString().slice(0, 7), localGuide: false, translatedFrom: "", ownerReply: "", featured: false }, ...items])}>
              <Plus aria-hidden /> Add review
            </Button>
          </div>
        </div>
      )}
    </SettingsForm>
  );
}

// --------------------------------------------------------------------------- FAQ
export function FaqEditor({ initial, customised, builtIn }: { initial: SettingsValues["faq"]; customised: boolean; builtIn: SettingsValues["faq"] }) {
  const [groups, setGroups] = useState(initial.groups.length ? initial.groups : builtIn.groups);
  return (
    <SettingsForm settingKey="faq" value={{ groups }} customised={customised} description={<>Answers support <code>**bold**</code> and links like <code>[contact us](/contact)</code>. {customised ? "" : "Starting from the built-in FAQ; saving replaces it."}</>}>
      {(e) => (
        <div className="grid gap-4">
          {groups.map((g, gi) => (
            <fieldset key={gi} className="grid gap-3 rounded-md border p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1"><Text label="Group" value={g.group} onChange={(x) => setGroups(groups.map((y, j) => (j === gi ? { ...y, group: x } : y)))} error={e[`groups.${gi}.group`]} /></div>
                <button type="button" onClick={() => setGroups(groups.filter((_, j) => j !== gi))} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove group"><Trash2 className="size-4" aria-hidden /></button>
              </div>
              {g.items.map((item, ii) => (
                <div key={ii} className="grid gap-2 border-l-2 pl-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><Text label="Question" value={item.q} onChange={(x) => setGroups(groups.map((y, j) => (j === gi ? { ...y, items: y.items.map((z, k) => (k === ii ? { ...z, q: x } : z)) } : y)))} error={e[`groups.${gi}.items.${ii}.q`]} /></div>
                    <button type="button" onClick={() => setGroups(groups.map((y, j) => (j === gi ? { ...y, items: y.items.filter((_, k) => k !== ii) } : y)))} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove question"><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                  <Area label="Answer" value={item.a} onChange={(x) => setGroups(groups.map((y, j) => (j === gi ? { ...y, items: y.items.map((z, k) => (k === ii ? { ...z, a: x } : z)) } : y)))} rows={3} error={e[`groups.${gi}.items.${ii}.a`]} />
                </div>
              ))}
              <div><Button type="button" variant="outline" size="sm" onClick={() => setGroups(groups.map((y, j) => (j === gi ? { ...y, items: [...y.items, { q: "", a: "" }] } : y)))}><Plus aria-hidden /> Add question</Button></div>
            </fieldset>
          ))}
          <div><Button type="button" variant="outline" size="sm" onClick={() => setGroups([...groups, { group: "New group", items: [{ q: "", a: "" }] }])}><Plus aria-hidden /> Add group</Button></div>
        </div>
      )}
    </SettingsForm>
  );
}

// --------------------------------------------------------------------------- policy pages
export function PolicyPagesEditor({ initial, customised, builtInTitles }: { initial: SettingsValues["policy_pages"]; customised: boolean; builtInTitles: Record<string, { title: string; description: string }> }) {
  const [v, setV] = useState(initial);
  const [slug, setSlug] = useState<(typeof POLICY_PAGE_SLUGS)[number]>("shipping");
  const page = v.pages[slug];
  return (
    <SettingsForm settingKey="policy_pages" value={v} customised={customised} description={<>Pages without saved text use the built-in wording (with your live warranty, return and shipping numbers). Write with <code>## Heading</code>, <code>- bullet</code>, <code>**bold**</code> and <code>[link](/path)</code>.</>}>
      {(e) => (
        <>
          <div className="flex flex-wrap gap-1" role="tablist">
            {POLICY_PAGE_SLUGS.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={slug === s} onClick={() => setSlug(s)} className={cn("h-8 rounded-md border px-3 text-xs font-semibold capitalize", slug === s ? "border-inverse bg-inverse text-inverse-foreground" : "bg-background")}>
                {s}{v.pages[s] ? " •" : ""}
              </button>
            ))}
          </div>
          {page ? (
            <div className="grid gap-3">
              <Text label="Title" value={page.title} onChange={(x) => setV({ ...v, pages: { ...v.pages, [slug]: { ...page, title: x } } })} error={e[`pages.${slug}.title`]} />
              <Text label="Description" value={page.description} onChange={(x) => setV({ ...v, pages: { ...v.pages, [slug]: { ...page, description: x } } })} error={e[`pages.${slug}.description`]} />
              <Area label="Body" value={page.body} onChange={(x) => setV({ ...v, pages: { ...v.pages, [slug]: { ...page, body: x } } })} rows={18} mono error={e[`pages.${slug}.body`]} />
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  const next = { ...v.pages };
                  delete next[slug];
                  setV({ ...v, pages: next });
                }}>
                  <RotateCcw aria-hidden /> Use built-in text for this page
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-5 text-sm">
              <p><strong>{builtInTitles[slug]?.title}</strong> uses the built-in text.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setV({ ...v, pages: { ...v.pages, [slug]: { title: builtInTitles[slug]?.title ?? slug, description: builtInTitles[slug]?.description ?? "", body: `## ${builtInTitles[slug]?.title ?? slug}\n\nWrite this policy here.` } } })}>
                Write custom text
              </Button>
            </div>
          )}
          <Text label="“Last updated” label" value={v.updated} onChange={(x) => setV({ ...v, updated: x })} placeholder="November 2026" />
        </>
      )}
    </SettingsForm>
  );
}
