"use server";

import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

export type NewsletterState = { status: "idle" | "success" | "error"; message: string };

const schema = z.object({
  email: z.email("Please enter a valid email address.").max(254),
  // Honeypot: real users never fill this hidden field.
  company: z.string().max(0).optional(),
});

export async function subscribeToNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    company: String(formData.get("company") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your email address." };
  }

  const db = createPublicClient();
  if (!db) return { status: "error", message: "Sign-up is unavailable right now. Please try again later." };

  // Insert only (anon has no SELECT on subscribers); a duplicate email still counts as success.
  const { error } = await db.from("newsletter_subscribers").insert({ email: parsed.data.email, source: "homepage" });
  if (error && error.code !== "23505") {
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  return { status: "success", message: "You're on the list. Watch your inbox for fresh arrivals." };
}
