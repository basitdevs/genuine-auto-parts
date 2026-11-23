"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import {
  requestPasswordReset,
  resendConfirmation,
  signInCustomer,
  signUpCustomer,
  updatePassword,
  updateProfile,
} from "@/app/(site)/account/actions";
import { Field, FormStatus, FormSuccess, inputClass, SpamFields } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import type { AccountActionState } from "@/lib/forms/schemas";
import { cn } from "@/lib/utils";

const IDLE: AccountActionState = { status: "idle" };

const errorsOf = (s: AccountActionState) => (s.status === "error" ? (s.fieldErrors ?? {}) : {});
const valueOf = (s: AccountActionState, key: string, fallback = "") => (s.status === "error" ? (s.values?.[key] ?? fallback) : fallback);
const statusOf = (s: AccountActionState) => (s.status === "error" ? ({ status: "error", message: s.message } as const) : ({ status: "idle" } as const));

function Submit({ pending, children, pendingLabel }: { pending: boolean; children: string; pendingLabel: string }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Password input with a show/hide toggle (keeps autocomplete hints for password managers). */
function PasswordInput({
  name,
  autoComplete,
  fieldProps,
  minLength,
}: {
  name: string;
  autoComplete: "current-password" | "new-password";
  fieldProps: { id: string; "aria-invalid"?: true; "aria-describedby"?: string };
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...fieldProps}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        maxLength={72}
        className={cn(inputClass, "pr-11")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={fieldProps.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(
    signInCustomer,
    notice ? { status: "error", message: notice } : IDLE,
  );
  const errors = errorsOf(state);
  return (
    <div className="grid gap-4">
      <form action={action} className="relative grid gap-4">
        <SpamFields />
        <input type="hidden" name="next" value={next} />
        <Field label="Email" required error={errors.email}>
          {(a) => (
            <input {...a} key={valueOf(state, "email")} name="email" type="email" autoComplete="email" required defaultValue={valueOf(state, "email")} className={inputClass} />
          )}
        </Field>
        <Field label="Password" required error={errors.password}>
          {(a) => <PasswordInput name="password" autoComplete="current-password" fieldProps={a} />}
        </Field>
        <div className="-mt-1 text-right text-sm">
          <Link href="/account/forgot-password" className="font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <FormStatus state={statusOf(state)} />
        <Submit pending={pending} pendingLabel="Signing in…">Sign in</Submit>
      </form>
      {state.status === "error" && state.resendEmail ? <ResendConfirmation email={state.resendEmail} /> : null}
    </div>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUpCustomer, IDLE);
  const errors = errorsOf(state);
  if (state.status === "success") {
    return (
      <FormSuccess title="Check your email" message={state.message}>
        <ResendConfirmation email={state.email ?? ""} subtle />
      </FormSuccess>
    );
  }
  return (
    <form action={action} className="relative grid gap-4">
      <SpamFields />
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" required error={errors.name}>
        {(a) => <input {...a} key={valueOf(state, "name")} name="name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={valueOf(state, "name")} className={inputClass} />}
      </Field>
      <Field label="Email" required error={errors.email}>
        {(a) => <input {...a} key={valueOf(state, "email")} name="email" type="email" autoComplete="email" required defaultValue={valueOf(state, "email")} className={inputClass} />}
      </Field>
      <Field label="Password" required error={errors.password} hint="At least 8 characters, with a letter and a number.">
        {(a) => <PasswordInput name="password" autoComplete="new-password" minLength={8} fieldProps={a} />}
      </Field>
      <FormStatus state={statusOf(state)} />
      <Submit pending={pending} pendingLabel="Creating account…">Create account</Submit>
      <p className="text-xs leading-relaxed text-muted-foreground">
        By creating an account you agree to our <Link href="/policies/terms" className="underline hover:text-foreground">Terms</Link> and{" "}
        <Link href="/policies/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
      </p>
    </form>
  );
}

function ResendConfirmation({ email, subtle = false }: { email: string; subtle?: boolean }) {
  const [state, action, pending] = useActionState(resendConfirmation, IDLE);
  if (!email) return null;
  return (
    <form action={action} className={cn("relative text-sm", subtle ? "" : "rounded-md border bg-muted/50 p-4")}>
      <SpamFields />
      <input type="hidden" name="email" value={email} />
      {state.status === "success" ? (
        <p role="status" className="flex items-start gap-2 text-success">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Didn&apos;t get the email?{" "}
          <button type="submit" disabled={pending} className="font-semibold text-primary hover:underline disabled:opacity-60">
            {pending ? "Sending…" : "Resend confirmation link"}
          </button>
          {state.status === "error" ? <span className="mt-1 block text-destructive">{state.message}</span> : null}
        </p>
      )}
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, IDLE);
  const errors = errorsOf(state);
  if (state.status === "success") {
    return (
      <FormSuccess title="Check your email" message={state.message}>
        <Link href="/account/login" className="text-sm font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </FormSuccess>
    );
  }
  return (
    <form action={action} className="relative grid gap-4">
      <SpamFields />
      <Field label="Email" required error={errors.email}>
        {(a) => <input {...a} key={valueOf(state, "email")} name="email" type="email" autoComplete="email" required defaultValue={valueOf(state, "email")} className={inputClass} />}
      </Field>
      <FormStatus state={statusOf(state)} />
      <Submit pending={pending} pendingLabel="Sending link…">Send reset link</Submit>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, IDLE);
  const errors = errorsOf(state);
  return (
    <form action={action} className="grid gap-4">
      <Field label="New password" required error={errors.password} hint="At least 8 characters, with a letter and a number.">
        {(a) => <PasswordInput name="password" autoComplete="new-password" minLength={8} fieldProps={a} />}
      </Field>
      <Field label="Confirm new password" required error={errors.confirm}>
        {(a) => <PasswordInput name="confirm" autoComplete="new-password" minLength={8} fieldProps={a} />}
      </Field>
      <FormStatus state={statusOf(state)} />
      <Submit pending={pending} pendingLabel="Saving…">Save new password</Submit>
    </form>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, IDLE);
  const errors = errorsOf(state);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" required error={errors.name}>
        {(a) => <input {...a} key={valueOf(state, "name", name)} name="name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={valueOf(state, "name", name)} className={inputClass} />}
      </Field>
      <Field label="Phone" error={errors.phone}>
        {(a) => <input {...a} key={valueOf(state, "phone", phone)} name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={valueOf(state, "phone", phone)} className={inputClass} />}
      </Field>
      <Field label="Email" required className="sm:col-span-2" hint="Contact us to change the email on your account.">
        {(a) => <input {...a} value={email} readOnly disabled className={cn(inputClass, "bg-muted text-muted-foreground")} />}
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Saving…" : "Save details"}
        </Button>
        <p aria-live="polite" className={cn("text-sm", state.status === "error" ? "text-destructive" : "text-success")}>
          {state.status === "success" || state.status === "error" ? state.message : ""}
        </p>
      </div>
    </form>
  );
}
