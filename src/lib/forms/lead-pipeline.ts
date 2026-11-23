import "server-only";
import { after } from "next/server";
import type { z } from "zod";
import { notifyNewLead, type LeadEmail } from "@/lib/email/lead-notify";
import { checkSpam } from "@/lib/forms/spam";
import type { LeadActionState } from "@/lib/forms/schemas";

export const GENERIC_ERROR = "Something went wrong sending your request. Please try again, or contact us directly.";

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Shared pipeline: validate -> spam checks -> insert (no .select(): anon is insert-only on leads)
 * -> email notification scheduled with after(), so it never delays or fails the submission.
 */
export async function handleLead<S extends z.ZodType<{ website?: string; startedAt?: string }>>(
  form: string,
  schema: S,
  formData: FormData,
  insert: (data: z.output<S>) => Promise<{ error: { message: string } | null; email: LeadEmail }>,
  successMessage: string,
): Promise<LeadActionState> {
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  const verdict = await checkSpam(form, parsed.data);
  if (verdict === "bot") return { status: "success", message: successMessage }; // don't tip off bots
  if (verdict === "rate-limited") {
    return { status: "error", message: "You've sent several requests in a short time. Please wait a few minutes and try again." };
  }

  try {
    const { error, email } = await insert(parsed.data);
    if (error) throw new Error(error.message);
    after(() => notifyNewLead(email));
  } catch (error) {
    console.error(`[forms] ${form} insert failed: ${error instanceof Error ? error.message : String(error)}`);
    return { status: "error", message: GENERIC_ERROR };
  }
  return { status: "success", message: successMessage };
}
