import "server-only";
import { business } from "@/content/business";
import { getNotificationSettings } from "@/lib/settings/server";
import { env } from "@/lib/env";

/**
 * New-lead notifications via Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Env: RESEND_API_KEY, LEADS_NOTIFY_EMAIL (comma-separated), optional RESEND_FROM.
 * Never throws: failures are logged and swallowed, and callers run this in after() so
 * a slow or failed email can't block or break a form submission.
 */
export type LeadKind = "sell_car" | "part_request" | "offer" | "fitment" | "order_request" | "return" | "contact";

export type LeadEmail = {
  kind: LeadKind;
  name: string;
  email: string;
  phone?: string | null;
  /** Ordered label/value pairs shown in the email body. Empty values are skipped. */
  fields: [string, string | number | null | undefined][];
  message?: string | null;
  product?: { title: string; slug: string; sku: string } | null;
};

const TITLES: Record<LeadKind, string> = {
  sell_car: "New sell-your-car request",
  part_request: "New part request",
  offer: "New offer on a part",
  fitment: "New fitment check",
  order_request: "New cart order request",
  return: "New return request",
  contact: "New contact message",
};

const BRAND = { red: "#c01426", ink: "#0b0b0c", muted: "#52525b", border: "#e4e4e7", bg: "#f4f4f5" };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderLeadEmail(lead: LeadEmail): { subject: string; html: string; text: string } {
  const title = TITLES[lead.kind];
  const subject = `${title}: ${lead.name}${lead.product ? `, ${lead.product.title.slice(0, 60)}` : ""}`;
  const productUrl = lead.product ? `${env.siteUrl}/parts/${lead.product.slug}` : null;
  const all: [string, string][] = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone ?? ""],
    ...lead.fields.map(([k, v]): [string, string] => [k, v === null || v === undefined ? "" : String(v)]),
  ];
  const rows = all.filter(([, v]) => v.trim() !== "");

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:${BRAND.muted};font-size:13px;white-space:nowrap;vertical-align:top;border-bottom:1px solid ${BRAND.border}">${escapeHtml(k)}</td>` +
        `<td style="padding:8px 12px;font-size:14px;color:${BRAND.ink};white-space:pre-line;border-bottom:1px solid ${BRAND.border}">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BRAND.border}">
  <tr><td style="background:${BRAND.ink};padding:18px 24px;border-bottom:4px solid ${BRAND.red}">
    <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${escapeHtml(business.name)}</span>
  </td></tr>
  <tr><td style="padding:24px 24px 8px">
    <p style="margin:0;color:${BRAND.red};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">New lead</p>
    <h1 style="margin:6px 0 0;font-size:22px;color:${BRAND.ink}">${escapeHtml(title)}</h1>
  </td></tr>
  ${
    lead.product && productUrl
      ? `<tr><td style="padding:12px 24px"><table role="presentation" width="100%" style="background:${BRAND.bg};border-radius:6px"><tr><td style="padding:12px 14px">
      <p style="margin:0;font-size:12px;color:${BRAND.muted}">Product · SKU ${escapeHtml(lead.product.sku)}</p>
      <p style="margin:4px 0 10px;font-size:15px;font-weight:bold;color:${BRAND.ink}">${escapeHtml(lead.product.title)}</p>
      <a href="${escapeHtml(productUrl)}" style="display:inline-block;background:${BRAND.red};color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:8px 14px;border-radius:4px">View product</a>
    </td></tr></table></td></tr>`
      : ""
  }
  <tr><td style="padding:12px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table></td></tr>
  ${
    lead.message
      ? `<tr><td style="padding:12px 24px"><p style="margin:0 0 6px;font-size:13px;color:${BRAND.muted}">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:${BRAND.ink};white-space:pre-wrap">${escapeHtml(lead.message)}</p></td></tr>`
      : ""
  }
  <tr><td style="padding:20px 24px 24px">
    <a href="mailto:${escapeHtml(lead.email)}" style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:10px 16px;border-radius:4px">Reply to ${escapeHtml(lead.name)}</a>
    <a href="${escapeHtml(`${env.siteUrl}/admin/leads`)}" style="margin-left:12px;color:${BRAND.red};font-size:13px">Open leads inbox</a>
  </td></tr>
</table>
<p style="color:${BRAND.muted};font-size:11px;margin-top:12px">Sent automatically by ${escapeHtml(business.name)} website.</p>
</td></tr></table></body></html>`;

  const text = [
    title,
    lead.product && productUrl ? `Product: ${lead.product.title} (SKU ${lead.product.sku})\n${productUrl}` : "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    lead.message ? `\nMessage:\n${lead.message}` : "",
    `\nLeads inbox: ${env.siteUrl}/admin/leads`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export async function notifyNewLead(lead: LeadEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const settings = await getNotificationSettings().catch(() => null);
  const fromSettings = lead.kind === "order_request" ? (settings?.orderEmails.length ? settings.orderEmails : settings?.leadEmails ?? []) : (settings?.leadEmails ?? []);
  const to = [...new Set([...fromSettings, ...(process.env.LEADS_NOTIFY_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean)])];
  if (!apiKey || to.length === 0) {
    console.warn("[email] RESEND_API_KEY or notification recipients not set; lead notification skipped");
    return;
  }
  const { subject, html, text } = renderLeadEmail(lead);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? `${business.name} <onboarding@resend.dev>`,
        to,
        reply_to: lead.email,
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[email] Resend rejected lead notification: ${res.status} ${(await res.text()).slice(0, 300)}`);
  } catch (error) {
    console.error(`[email] lead notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
