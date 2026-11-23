import { z } from "zod";

/**
 * Lead form schemas, shared by the client (React Hook Form) and the server actions,
 * so validation rules can't drift. Inputs arrive as strings from FormData.
 */
/** Evaluated when used, never at import time (module-level clocks break prerendering). */
const currentYear = () => new Date().getFullYear();

const name = z.string().trim().min(2, "Please enter your name.").max(100);
const email = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address.")).pipe(z.string().max(254));
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^[+()\d\s.-]{7,30}$/.test(v), "Please enter a valid phone number.");
const optionalText = (max: number) => z.string().trim().max(max, `Please keep this under ${max} characters.`);
const vin = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "A VIN has 17 characters (no I, O or Q).");
const year = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= currentYear() + 1), "Please enter a valid year.");
const money = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,7}(\.\d{1,2})?$/.test(v.replace(/[$,]/g, "")), "Please enter an amount like 1500.");

/** Anti-spam fields present on every lead form (see src/lib/forms/spam.ts). */
export const spamFields = {
  website: z.string().max(0).optional().default(""), // honeypot, must stay empty
  startedAt: z.string().optional().default(""), // ms timestamp set when the form mounted
};

export const sellCarSchema = z.object({
  name,
  email,
  phone: phone.refine((v) => v !== "", "Please enter a phone number so we can reach you."),
  vehicleYear: year.refine((v) => v !== "", "Please enter the year."),
  vehicleMake: z.string().trim().min(2, "Please enter the make.").max(60),
  vehicleModel: z.string().trim().min(1, "Please enter the model.").max(60),
  vin,
  mileage: z.string().trim().refine((v) => v === "" || /^\d{1,7}$/.test(v.replace(/,/g, "")), "Numbers only, e.g. 120000."),
  pickupLocation: z.string().trim().min(3, "Where is the vehicle? City or ZIP is fine.").max(200),
  askingPrice: money,
  notes: optionalText(2000),
  ...spamFields,
});
export type SellCarInput = z.input<typeof sellCarSchema>;

export const RETURN_REASONS = [
  { value: "wrong_part", label: "Wrong part / doesn't fit" },
  { value: "defective", label: "Defective or not working" },
  { value: "damaged", label: "Damaged in shipping" },
  { value: "not_as_described", label: "Not as described" },
  { value: "no_longer_needed", label: "No longer needed" },
  { value: "other", label: "Other" },
] as const;

export const returnSchema = z
  .object({
    name,
    email,
    phone,
    orderNumber: optionalText(40),
    invoiceNumber: optionalText(40),
    reason: z.enum(RETURN_REASONS.map((r) => r.value) as [string, ...string[]], { message: "Please choose a reason." }),
    description: z.string().trim().min(10, "Please tell us a bit more (at least 10 characters).").max(3000),
    ...spamFields,
  })
  .refine((v) => v.orderNumber !== "" || v.invoiceNumber !== "", {
    message: "Please enter your order number or invoice number.",
    path: ["orderNumber"],
  });
export type ReturnInput = z.input<typeof returnSchema>;

export const CONTACT_TOPICS = [
  { value: "general", label: "General question" },
  { value: "part-request", label: "Request a part / make an offer" },
  { value: "fitment", label: "Check fitment for my vehicle" },
  { value: "order", label: "Question about an order" },
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export const contactSchema = z
  .object({
    topic: z.enum(["general", "part-request", "fitment", "order"]),
    name,
    email,
    phone,
    sku: optionalText(80),
    partName: optionalText(200),
    partNumber: optionalText(80),
    vehicleYear: year,
    vehicleMake: optionalText(60),
    vehicleModel: optionalText(60),
    vin,
    offerAmount: money,
    message: z.string().trim().min(10, "Please write at least 10 characters.").max(3000),
    ...spamFields,
  })
  .refine((v) => v.topic !== "part-request" || v.partName !== "" || v.partNumber !== "" || v.sku !== "", {
    message: "Tell us which part you need (name or part number).",
    path: ["partName"],
  });
export type ContactInput = z.input<typeof contactSchema>;

/** Result returned by every lead server action. */
export type LeadActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const toNumberOrNull = (v: string) => (v === "" ? null : Number(v.replace(/[$,]/g, "")));
export const toTextOrNull = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

// ---------------------------------------------------------------------------
// Customer accounts
// ---------------------------------------------------------------------------
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.")
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Use at least one letter and one number.");

/** Only same-site relative paths, never protocol-relative ("//evil.com") or auth routes. */
export const safeNextPath = z
  .string()
  .trim()
  .regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/)
  .refine((v) => !v.startsWith("/auth/") && !v.startsWith("/account/login") && !v.startsWith("/account/signup"))
  .catch("/account");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Please enter your password.").max(200),
  next: safeNextPath,
  ...spamFields,
});

export const signUpSchema = z.object({
  name,
  email,
  password,
  next: safeNextPath,
  ...spamFields,
});

export const emailOnlySchema = z.object({ email, ...spamFields });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export const profileSchema = z.object({ name, phone });

// ---------------------------------------------------------------------------
// Cart order request (until Stripe checkout launches)
// ---------------------------------------------------------------------------
export const cartRequestSchema = z.object({
  name,
  email,
  phone,
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}(-\d{4})?$/.test(v), "Please enter a 5-digit ZIP code."),
  notes: optionalText(2000),
  ...spamFields,
});

/** Result returned by account Server Actions. `resendEmail` offers "resend confirmation". */
export type AccountActionState =
  | { status: "idle" }
  | { status: "success"; message: string; email?: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
      resendEmail?: string;
      /** Submitted non-secret values, re-filled after React resets the form. Never passwords. */
      values?: Record<string, string>;
    };
