"use client";

import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { LeadActionState } from "@/lib/forms/schemas";

type Action = (prev: LeadActionState, formData: FormData) => Promise<LeadActionState>;

/**
 * React Hook Form (instant client validation) + a Server Action (authoritative
 * validation, spam checks, insert). Server field errors are mapped back onto inputs.
 * Without JS the <form action> still posts to the Server Action.
 */
export function useLeadForm<TValues extends FieldValues>(
  schema: z.ZodType<unknown, TValues>,
  action: Action,
  defaultValues: DefaultValues<TValues>,
) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as LeadActionState);
  const form = useForm<TValues>({
    // Validate the raw (string) inputs; the server action parses the transformed output.
    resolver: zodResolver(schema as never) as unknown as Resolver<TValues>,
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    for (const [field, message] of Object.entries(state.fieldErrors)) {
      form.setError(field as Path<TValues>, { type: "server", message });
    }
  }, [state, form]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const element = event.currentTarget; // read before validation; currentTarget is cleared after dispatch
    return form.handleSubmit(() => {
      const data = new FormData(element);
      startTransition(() => formAction(data));
    })(event);
  };

  return { form, state, pending, formAction, onSubmit };
}
