"use client";

import type { z } from "zod";
import { submitCartRequest } from "@/app/(site)/cart/actions";
import { Field, FormStatus, inputClass, SpamFields, SubmitButton, textareaClass } from "@/components/forms/fields";
import { useLeadForm } from "@/components/forms/use-lead-form";
import { cartRequestSchema } from "@/lib/forms/schemas";

type CartRequestInput = z.input<typeof cartRequestSchema>;

/** Order request (until Stripe checkout). Prefilled from the profile when signed in. */
export function CartRequestForm({ name = "", email = "", phone = "" }: { name?: string; email?: string; phone?: string }) {
  const { form, state, pending, formAction, onSubmit } = useLeadForm<CartRequestInput>(cartRequestSchema, submitCartRequest, {
    name,
    email,
    phone,
    postalCode: "",
    notes: "",
    website: "",
    startedAt: "",
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-4">
      <SpamFields />
      <Field label="Full name" required error={errors.name?.message}>
        {(a) => <input {...a} {...register("name")} defaultValue={name} autoComplete="name" className={inputClass} />}
      </Field>
      <Field label="Email" required error={errors.email?.message}>
        {(a) => <input {...a} {...register("email")} defaultValue={email} type="email" autoComplete="email" className={inputClass} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" error={errors.phone?.message}>
          {(a) => <input {...a} {...register("phone")} defaultValue={phone} type="tel" autoComplete="tel" className={inputClass} />}
        </Field>
        <Field label="Ship-to ZIP" error={errors.postalCode?.message}>
          {(a) => <input {...a} {...register("postalCode")} inputMode="numeric" autoComplete="postal-code" maxLength={10} className={inputClass} />}
        </Field>
      </div>
      <Field label="Notes" error={errors.notes?.message} hint="Your VIN, delivery details or questions about fitment.">
        {(a) => <textarea {...a} {...register("notes")} rows={3} className={textareaClass} style={{ minHeight: "5.5rem" }} />}
      </Field>
      <FormStatus state={state} />
      <SubmitButton pending={pending}>Send order request</SubmitButton>
    </form>
  );
}
