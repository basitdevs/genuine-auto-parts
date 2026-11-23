"use client";

import { useActionState } from "react";
import { Field, FormStatus, inputClass, SpamFields, SubmitButton } from "@/components/forms/fields";
import { signIn, type AdminActionState } from "../actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(signIn, {
    status: notice ? "error" : "idle",
    message: notice ?? "",
  });
  return (
    <form action={action} className="relative grid gap-4">
      <SpamFields />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" required>
        {(a) => <input {...a} name="email" type="email" autoComplete="username" required className={inputClass} />}
      </Field>
      <Field label="Password" required>
        {(a) => <input {...a} name="password" type="password" autoComplete="current-password" required className={inputClass} />}
      </Field>
      <FormStatus state={state.status === "error" ? { status: "error", message: state.message } : { status: "idle" }} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}
