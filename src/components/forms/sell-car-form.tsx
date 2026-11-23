"use client";

import Link from "next/link";
import { submitSellCar } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { sellCarSchema, type SellCarInput } from "@/lib/forms/schemas";
import { Field, FormStatus, FormSuccess, inputClass, SpamFields, SubmitButton, textareaClass } from "./fields";
import { useLeadForm } from "./use-lead-form";

const defaults: SellCarInput = {
  name: "", email: "", phone: "", vehicleYear: "", vehicleMake: "", vehicleModel: "", vin: "",
  mileage: "", pickupLocation: "", askingPrice: "", notes: "", website: "", startedAt: "",
};

export function SellCarForm() {
  const { form, state, pending, formAction, onSubmit } = useLeadForm<SellCarInput>(sellCarSchema, submitSellCar, defaults);
  const { register, formState: { errors } } = form;

  if (state.status === "success") {
    return (
      <FormSuccess title="Request received" message={state.message}>
        <Button asChild variant="outline">
          <Link href="/parts">Browse parts while you wait</Link>
        </Button>
      </FormSuccess>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-6">
      <SpamFields />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-bold tracking-wide uppercase">Your details</legend>
        <Field label="Full name" required error={errors.name?.message}>
          {(a) => <input {...a} {...register("name")} autoComplete="name" className={inputClass} />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message}>
          {(a) => <input {...a} {...register("phone")} type="tel" autoComplete="tel" className={inputClass} />}
        </Field>
        <Field label="Email" required error={errors.email?.message} className="sm:col-span-2">
          {(a) => <input {...a} {...register("email")} type="email" autoComplete="email" className={inputClass} />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 font-display text-lg font-bold tracking-wide uppercase">Your vehicle</legend>
        <Field label="Year" required error={errors.vehicleYear?.message}>
          {(a) => <input {...a} {...register("vehicleYear")} inputMode="numeric" maxLength={4} placeholder="2015" className={inputClass} />}
        </Field>
        <Field label="Make" required error={errors.vehicleMake?.message}>
          {(a) => <input {...a} {...register("vehicleMake")} placeholder="BMW" className={inputClass} />}
        </Field>
        <Field label="Model" required error={errors.vehicleModel?.message}>
          {(a) => <input {...a} {...register("vehicleModel")} placeholder="328i" className={inputClass} />}
        </Field>
        <Field label="VIN" error={errors.vin?.message} hint="Helps us make an accurate offer." className="sm:col-span-2">
          {(a) => <input {...a} {...register("vin")} maxLength={17} autoComplete="off" spellCheck={false} className={`${inputClass} font-mono uppercase`} />}
        </Field>
        <Field label="Mileage" error={errors.mileage?.message}>
          {(a) => <input {...a} {...register("mileage")} inputMode="numeric" placeholder="120000" className={inputClass} />}
        </Field>
        <Field label="Pickup location" required error={errors.pickupLocation?.message} hint="City and ZIP, or full address." className="sm:col-span-2">
          {(a) => <input {...a} {...register("pickupLocation")} autoComplete="street-address" className={inputClass} />}
        </Field>
        <Field label="Asking price ($)" error={errors.askingPrice?.message}>
          {(a) => <input {...a} {...register("askingPrice")} inputMode="decimal" placeholder="1500" className={inputClass} />}
        </Field>
        <Field label="Condition & notes" error={errors.notes?.message} hint="Runs? Accident damage? Missing parts? Title status?" className="sm:col-span-3">
          {(a) => <textarea {...a} {...register("notes")} rows={5} className={textareaClass} />}
        </Field>
      </fieldset>

      <FormStatus state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">We only use your details to respond to this request.</p>
        <SubmitButton pending={pending}>Get my estimate</SubmitButton>
      </div>
    </form>
  );
}
