// ============================================================
// Afams Ltd — Brevo Transactional Email Service
// Path: supabase/functions/_shared/brevo.ts
// Runtime: Supabase Edge Functions (Deno)
// ============================================================

import { BREVO_TEMPLATES } from "./types.ts";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

/**
 * Send a Brevo transactional email using a pre-built template.
 *
 * @param templateKey - Key from BREVO_TEMPLATES (e.g. "ORDER_CONFIRMATION")
 * @param to          - Recipient email address and display name
 * @param params      - Dynamic variables injected into the template
 * @throws            - Error if BREVO_API_KEY is missing or the API call fails
 */
export async function sendBrevoTemplate(
  templateKey: keyof typeof BREVO_TEMPLATES,
  to: { email: string; name: string },
  params: Record<string, unknown>,
): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    throw new Error("[Brevo] BREVO_API_KEY is not set");
  }

  const templateId = BREVO_TEMPLATES[templateKey];

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      templateId,
      to: [to],
      params,
    }),
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const errJson = await res.json() as { message?: string; code?: string };
      message = errJson.message ?? errJson.code ?? message;
    } catch { /* ignore parse failure — use statusText */ }
    throw new Error(
      `[Brevo] API error ${res.status} for template "${templateKey}": ${message}`,
    );
  }
}
