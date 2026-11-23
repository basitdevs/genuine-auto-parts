"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import type { SettingsValues } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";
import { SettingsForm } from "../content/editors";
import { inviteStaff, setUserRole } from "./actions";

export function RoleSelect({ id, role, disabled }: { id: string; role: string; disabled?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`role-${id}`}>Role</label>
      <select
        id={`role-${id}`}
        value={value}
        disabled={pending || disabled}
        onChange={(e) => {
          const next = e.target.value as "customer" | "staff" | "admin";
          const prev = value;
          setValue(next);
          startTransition(async () => {
            const r = await setUserRole({ id, role: next });
            if (r.ok) {
              toast.success(r.message);
              router.refresh();
            } else {
              setValue(prev);
              toast.error(r.message);
            }
          });
        }}
        className="h-8 rounded-md border bg-background px-2 text-xs font-semibold"
      >
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
        <option value="customer">No access (customer)</option>
      </select>
      {pending ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
    </span>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [v, setV] = useState({ email: "", name: "", role: "staff" as "staff" | "admin" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await inviteStaff(v);
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          if (r.ok) {
            toast.success(r.message);
            setV({ email: "", name: "", role: "staff" });
            router.refresh();
          } else toast.error(r.message);
        });
      }}
      className="grid gap-3 sm:grid-cols-[1.4fr_1fr_140px_auto] sm:items-end"
    >
      <label className="grid gap-1 text-xs font-semibold">
        Email
        <input type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={cn(fieldClass, "h-10 font-normal")} />
        <FieldError message={errors.email} />
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        Name
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={cn(fieldClass, "h-10 font-normal")} />
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        Role
        <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as "staff" | "admin" })} className={cn(fieldClass, "h-10 font-normal")}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <Button type="submit" disabled={pending} className="h-10">{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Invite</Button>
    </form>
  );
}

export function NotificationsForm({ initial, customised }: { initial: SettingsValues["notifications"]; customised: boolean }) {
  const [lead, setLead] = useState(initial.leadEmails.join(", "));
  const [order, setOrder] = useState(initial.orderEmails.join(", "));
  const list = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  return (
    <SettingsForm
      settingKey="notifications"
      value={{ leadEmails: list(lead), orderEmails: list(order) }}
      customised={customised}
      description="Who gets an email for new leads and order requests (needs RESEND_API_KEY on the server). LEADS_NOTIFY_EMAIL in the environment is always added too."
    >
      {(e) => (
        <>
          <label className="grid gap-1 text-xs font-semibold">
            Lead notifications (sell your car, part requests, returns, contact)
            <input value={lead} onChange={(ev) => setLead(ev.target.value)} placeholder="sales@example.com, mike@example.com" className={cn(fieldClass, "h-10 font-normal")} />
            <FieldError message={Object.entries(e).find(([k]) => k.startsWith("leadEmails"))?.[1]} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Order request notifications
            <input value={order} onChange={(ev) => setOrder(ev.target.value)} placeholder="Leave empty to use the lead list" className={cn(fieldClass, "h-10 font-normal")} />
            <FieldError message={Object.entries(e).find(([k]) => k.startsWith("orderEmails"))?.[1]} />
          </label>
        </>
      )}
    </SettingsForm>
  );
}

export function FlagsForm({ initial, customised }: { initial: SettingsValues["flags"]; customised: boolean }) {
  const [v, setV] = useState(initial);
  const toggle = (label: string, hint: string, checked: boolean, onChange: (c: boolean) => void) => (
    <label className="flex items-start gap-3 rounded-md border p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
  return (
    <SettingsForm settingKey="flags" value={v} customised={customised}>
      {(e) => (
        <>
          {toggle("Checkout enabled", "Customers can send order requests from the cart. Off shows an “ordering paused, contact us” message.", v.checkoutEnabled, (c) => setV({ ...v, checkoutEnabled: c }))}
          {toggle("Show prices", "Off replaces prices with “Call for price” on cards and product pages.", v.showPrices, (c) => setV({ ...v, showPrices: c }))}
          <div className="grid gap-3 rounded-md border p-3">
            {toggle("Maintenance / announcement banner", "A notice across the top of every public page.", v.maintenanceBanner.enabled, (c) => setV({ ...v, maintenanceBanner: { ...v.maintenanceBanner, enabled: c } }))}
            <label className="grid gap-1 text-xs font-semibold">
              Banner message
              <input value={v.maintenanceBanner.message} onChange={(ev) => setV({ ...v, maintenanceBanner: { ...v.maintenanceBanner, message: ev.target.value } })} maxLength={240} placeholder="e.g. Closed Thanksgiving Day. Orders ship Friday." className={cn(fieldClass, "h-10 font-normal")} />
              <FieldError message={e["maintenanceBanner.message"]} />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Style
              <select value={v.maintenanceBanner.tone} onChange={(ev) => setV({ ...v, maintenanceBanner: { ...v.maintenanceBanner, tone: ev.target.value as "info" | "warning" } })} className={cn(fieldClass, "h-10 w-48 font-normal")}>
                <option value="info">Brand red</option>
                <option value="warning">Warning amber</option>
              </select>
            </label>
          </div>
        </>
      )}
    </SettingsForm>
  );
}
