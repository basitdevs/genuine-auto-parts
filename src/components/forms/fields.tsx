"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LeadActionState } from "@/lib/forms/schemas";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

/** Label + control + hint/error, wired for screen readers (aria-invalid / aria-describedby). */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required ? (
          <span className="text-primary" aria-hidden>
            {" "}*
          </span>
        ) : (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = fieldClass;
export const textareaClass = cn(fieldClass, "h-auto min-h-32 py-2.5 leading-relaxed");
export const selectClass = cn(fieldClass, "cursor-pointer");

/** Honeypot + time trap. Must be rendered inside every lead form. */
export function SpamFields() {
  const startedRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (startedRef.current) startedRef.current.value = String(Date.now());
  }, []);
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
      <input ref={startedRef} type="hidden" name="startedAt" defaultValue="" />
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? "Sending…" : children}
    </Button>
  );
}

/** Form-level status (server errors). Success replaces the form via <FormSuccess>. */
export function FormStatus({ state }: { state: LeadActionState }) {
  return (
    <div aria-live="polite" className="min-h-0">
      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function FormSuccess({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-lg border border-success/30 bg-success/5 p-6 outline-none sm:p-8">
      <CheckCircle2 className="size-8 text-success" aria-hidden />
      <h2 className="mt-3 font-display text-2xl font-bold tracking-wide uppercase">{title}</h2>
      <p className="mt-2 text-muted-foreground">{message}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
