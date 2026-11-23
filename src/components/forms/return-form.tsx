"use client";

import { submitReturn } from "@/app/actions/leads";
import { RETURN_REASONS, returnSchema, type ReturnInput } from "@/lib/forms/schemas";
import { Field, FormStatus, FormSuccess, inputClass, selectClass, SpamFields, SubmitButton, textareaClass } from "./fields";
import { useLeadForm } from "./use-lead-form";

const defaults: ReturnInput = {
  name: "", email: "", phone: "", orderNumber: "", invoiceNumber: "", reason: "", description: "", website: "", startedAt: "",
};

export function ReturnForm() {
  const { form, state, pending, formAction, onSubmit } = useLeadForm<ReturnInput>(returnSchema, submitReturn, defaults);
  const { register, formState: { errors } } = form;

  if (state.status === "success") return <FormSuccess title="Return request received" message={state.message} />;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-6">
      <SpamFields />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-bold tracking-wide uppercase">Order information</legend>
        <Field label="Order number" error={errors.orderNumber?.message} hint="e.g. GA-100123, or your eBay order number.">
          {(a) => <input {...a} {...register("orderNumber")} className={inputClass} />}
        </Field>
        <Field label="Invoice number" error={errors.invoiceNumber?.message} hint="Printed on your packing slip.">
          {(a) => <input {...a} {...register("invoiceNumber")} className={inputClass} />}
        </Field>
        <Field label="Full name" required error={errors.name?.message}>
          {(a) => <input {...a} {...register("name")} autoComplete="name" className={inputClass} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <input {...a} {...register("email")} type="email" autoComplete="email" className={inputClass} />}
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          {(a) => <input {...a} {...register("phone")} type="tel" autoComplete="tel" className={inputClass} />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-3 font-display text-lg font-bold tracking-wide uppercase">What&apos;s wrong?</legend>
        <Field label="Reason for return" required error={errors.reason?.message}>
          {(a) => (
            <select {...a} {...register("reason")} className={selectClass}>
              <option value="">Choose a reason…</option>
              {RETURN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Description" required error={errors.description?.message} hint="Which part, what happened, and photos you can email us if it's damaged.">
          {(a) => <textarea {...a} {...register("description")} rows={6} className={textareaClass} />}
        </Field>
      </fieldset>

      <FormStatus state={state} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Submit return request</SubmitButton>
      </div>
    </form>
  );
}
