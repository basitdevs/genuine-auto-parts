"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { subscribeToNewsletter, type NewsletterState } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";

const initial: NewsletterState = { status: "idle", message: "" };

export function Newsletter() {
  const [state, action, pending] = useActionState(subscribeToNewsletter, initial);

  return (
    <section aria-labelledby="newsletter-title" className="border-t bg-background py-16 sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase">
            <span aria-hidden className="h-0.5 w-6 bg-current" /> Get first pick
          </p>
          <h2 id="newsletter-title" className="font-display text-3xl font-bold tracking-tight uppercase sm:text-4xl">
            New parts, before anyone else
          </h2>
          <p className="mt-3 text-muted-foreground">
            One-off parts sell fast. Get new arrivals and donor vehicles in your inbox. No spam, unsubscribe anytime.
          </p>
        </div>

        {state.status === "success" ? (
          <p role="status" className="flex items-center gap-3 rounded-lg bg-success/10 px-5 py-4 font-medium text-success lg:w-[28rem]">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {state.message}
          </p>
        ) : (
          <form action={action} className="w-full lg:w-[28rem]" noValidate>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <div className="relative flex-1">
                <Mail aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={state.status === "error" || undefined}
                  aria-describedby="newsletter-msg"
                  className="h-12 w-full rounded-md border border-input bg-background pr-3 pl-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive"
                />
              </div>
              {/* Honeypot */}
              <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Subscribe
              </Button>
            </div>
            <p id="newsletter-msg" aria-live="polite" className="mt-2 min-h-5 text-sm text-destructive">
              {state.status === "error" ? state.message : ""}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
