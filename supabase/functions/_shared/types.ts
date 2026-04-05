// ============================================================
// Afams Ltd — Shared Types
// Path: supabase/functions/_shared/types.ts
// ============================================================

/**
 * Brevo transactional email template IDs.
 * Update each value with the real numeric template ID from your Brevo account.
 */
export const BREVO_TEMPLATES = {
  /** Sent to the customer immediately after a successful Paystack payment. */
  ORDER_CONFIRMATION: 1,
  /** Sent to new Growers Club newsletter subscribers. */
  WELCOME: 2,
} as const;
