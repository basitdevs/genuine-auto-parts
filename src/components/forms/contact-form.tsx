"use client";

import { useWatch } from "react-hook-form";
import { submitContact } from "@/app/actions/leads";
import { CONTACT_TOPICS, contactSchema, type ContactInput, type ContactTopic } from "@/lib/forms/schemas";
import { Field, FormStatus, FormSuccess, inputClass, selectClass, SpamFields, SubmitButton, textareaClass } from "./fields";
import { useLeadForm } from "./use-lead-form";

type Props = { topic?: ContactTopic; sku?: string; productTitle?: string };

export function ContactForm({ topic = "general", sku = "", productTitle }: Props) {
  const defaults: ContactInput = {
    topic, name: "", email: "", phone: "", sku, partName: productTitle ?? "", partNumber: "", vehicleYear: "",
    vehicleMake: "", vehicleModel: "", vin: "", offerAmount: "",
    message: sku && topic === "part-request" ? "Hi, I'd like to buy this part. Please confirm availability and shipping to my ZIP: " : "",
    website: "", startedAt: "",
  };
  const { form, state, pending, formAction, onSubmit } = useLeadForm<ContactInput>(contactSchema, submitContact, defaults);
  const { register, control, formState: { errors } } = form;
  const current = useWatch({ control, name: "topic" });
  const isPart = current === "part-request";
  const needsVehicle = isPart || current === "fitment";

  if (state.status === "success") return <FormSuccess title="Message sent" message={state.message} />;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-5">
      <SpamFields />
      <input type="hidden" {...register("sku")} />
      <Field label="What can we help with?" required error={errors.topic?.message}>
        {(a) => (
          <select {...a} {...register("topic")} className={selectClass}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name?.message}>
          {(a) => <input {...a} {...register("name")} autoComplete="name" className={inputClass} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <input {...a} {...register("email")} type="email" autoComplete="email" className={inputClass} />}
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          {(a) => <input {...a} {...register("phone")} type="tel" autoComplete="tel" className={inputClass} />}
        </Field>
      </div>

      {needsVehicle ? (
        <fieldset className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-bold tracking-wide uppercase">Part & vehicle</legend>
          {sku ? (
            <p className="text-sm sm:col-span-3">
              About: <strong>{productTitle ?? sku}</strong>
            </p>
          ) : null}
          {isPart ? (
            <>
              <Field label="Part name" error={errors.partName?.message} className="sm:col-span-2">
                {(a) => <input {...a} {...register("partName")} placeholder="e.g. Driver side headlight" className={inputClass} />}
              </Field>
              <Field label="Part # / OEM #" error={errors.partNumber?.message}>
                {(a) => <input {...a} {...register("partNumber")} className={`${inputClass} font-mono`} spellCheck={false} />}
              </Field>
            </>
          ) : null}
          <Field label="Year" error={errors.vehicleYear?.message}>
            {(a) => <input {...a} {...register("vehicleYear")} inputMode="numeric" maxLength={4} className={inputClass} />}
          </Field>
          <Field label="Make" error={errors.vehicleMake?.message}>
            {(a) => <input {...a} {...register("vehicleMake")} className={inputClass} />}
          </Field>
          <Field label="Model" error={errors.vehicleModel?.message}>
            {(a) => <input {...a} {...register("vehicleModel")} className={inputClass} />}
          </Field>
          <Field label="VIN" error={errors.vin?.message} hint="The fastest way for us to confirm fitment." className={isPart ? "sm:col-span-2" : "sm:col-span-3"}>
            {(a) => <input {...a} {...register("vin")} maxLength={17} spellCheck={false} className={`${inputClass} font-mono uppercase`} />}
          </Field>
          {isPart ? (
            <Field label="Your offer ($)" error={errors.offerAmount?.message}>
              {(a) => <input {...a} {...register("offerAmount")} inputMode="decimal" className={inputClass} />}
            </Field>
          ) : null}
        </fieldset>
      ) : null}

      <Field label="Message" required error={errors.message?.message}>
        {(a) => <textarea {...a} {...register("message")} rows={6} className={textareaClass} />}
      </Field>

      <FormStatus state={state} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Send message</SubmitButton>
      </div>
    </form>
  );
}
