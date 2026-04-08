// supabase/functions/_shared/types.ts
// Do not modify the orders schema — use these field names exactly.

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  county: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  paystack_ref: string | null;
  payment_method: string | null;
  paid_at: string | null;
  status: OrderStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  notes: string | null;
  flagged: boolean;
  admin_notes: string | null;
  free_seeds: boolean;
  extra_seeds: boolean;
  extra_seeds_count: number;
  extra_seeds_total: number;
  prosoil_qty: number;
  prosoil_unit_price: number;
  prosoil_total: number;
  prosoil_promo_bag: boolean;
  addons_total: number;
}

// CRITICAL: These are the ONLY valid status values.
// The Postgres enum rejects any capitalised or unknown string.
// Flow: paid (webhook) → processing → shipped → delivered
//       cancelled / refunded at any time by admin
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

// Brevo transactional template IDs.
// Override at runtime via BREVO_TEMPLATE_* env vars (recommended).
// These defaults match the numbering in the Mail Templates folder.
export const BREVO_TEMPLATES = {
  order_received:  1,
  payment_success: 2,
  payment_failed:  3,
  admin_new_order: 4,
  order_dispatched: 5,
  order_delivered: 6,
} as const;
