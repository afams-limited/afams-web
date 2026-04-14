// ============================================================
// Afams Ltd — Send Order Email (Brevo transactional)
// Path: supabase/functions/send-order-email/index.ts
// Runtime: Supabase Edge Functions (Deno)
// Deploy:  supabase functions deploy send-order-email
//
// Called by the admin panel after a status change to trigger
// the appropriate Brevo transactional email.
//
// Required Supabase Secrets (set via Dashboard or CLI):
//   BREVO_API_KEY
//   BREVO_SENDER_EMAIL   (e.g. orders@afams.co.ke)
//   BREVO_SENDER_NAME    (e.g. Afams)
//   BREVO_TEMPLATE_ORDER_DISPATCHED  (integer template ID)
//   BREVO_TEMPLATE_ORDER_DELIVERED   (integer template ID)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BREVO_TEMPLATES } from "../_shared/types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Brevo helper ──────────────────────────────────────────────
async function sendBrevoTemplate(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  templateId: number,
  toEmail: string,
  toName: string,
  params: Record<string, string | number>,
): Promise<{ messageId?: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName }],
      templateId,
      params,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API error (template ${templateId}): ${res.status} ${text}`);
  }

  let payload: { messageId?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // ignore non-json response
  }
  return payload;
}

// ── Valid admin-triggered email types ────────────────────────
const ADMIN_EMAIL_TYPES = ["order_dispatched", "order_delivered"] as const;
type AdminEmailType = (typeof ADMIN_EMAIL_TYPES)[number];

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Require authenticated user (admin panel sends JWT)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.error("[send-order-email] BREVO_API_KEY not set");
    return new Response(JSON.stringify({ error: "Server misconfigured: missing BREVO_API_KEY" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "orders@afams.co.ke";
  const senderName  = Deno.env.get("BREVO_SENDER_NAME")  ?? "Afams";

  // Parse request body
  let body: { order_id?: string; email_type?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { order_id: orderId, email_type: emailType } = body;

  if (!orderId || typeof orderId !== "string") {
    return new Response(JSON.stringify({ error: "Missing order_id" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!emailType || !ADMIN_EMAIL_TYPES.includes(emailType as AdminEmailType)) {
    return new Response(
      JSON.stringify({ error: `Invalid email_type. Must be one of: ${ADMIN_EMAIL_TYPES.join(", ")}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Authenticate the caller via their JWT — creates a user-scoped client
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Verify session is valid
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Fetch order using service role (bypasses RLS)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    console.error("[send-order-email] Order not found:", orderId, fetchError?.message);
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const orderRef       = order.order_number ?? order.id.slice(0, 8);
  const customerName   = order.customer_name  ?? "Customer";
  const customerEmail  = order.customer_email ?? "";
  const productName    = order.product_name   ?? order.product_sku ?? "—";
  const quantity       = String(order.quantity ?? 1);
  const totalKES       = `KES ${(order.total_amount ?? 0).toLocaleString("en-KE")}`;

  if (!customerEmail) {
    console.warn(`[send-order-email] Order ${orderRef} has no customer_email — skipping`);
    return new Response(JSON.stringify({ sent: false, reason: "no customer email" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    let providerMessageId: string | undefined;
    if (emailType === "order_dispatched") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_DISPATCHED") ?? String(BREVO_TEMPLATES.order_dispatched),
        10,
      );
      const dispatchedAt = order.shipped_at
        ? new Date(order.shipped_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number:       orderRef,
        order_ref:          orderRef,
        order_reference:    orderRef,
        customer_name:      customerName,
        product_name:       productName,
        quantity:           quantity,
        total_amount:       totalKES,
        paystack_reference: order.paystack_ref ?? "—",
        payment_reference:  order.paystack_ref ?? "—",
        estimated_delivery: "2–5 business days",
        tracking_number:    order.tracking_number ?? "—",
        dispatched_at:      dispatchedAt,
      });
      providerMessageId = result.messageId;

      console.log(`[send-order-email] order_dispatched → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "order_delivered") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_DELIVERED") ?? String(BREVO_TEMPLATES.order_delivered),
        10,
      );
      const deliveredAt = order.delivered_at
        ? new Date(order.delivered_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number:  orderRef,
        order_ref:     orderRef,
        order_reference: orderRef,
        customer_name: customerName,
        product_name:  productName,
        quantity:      quantity,
        total_amount:  totalKES,
        paystack_reference: order.paystack_ref ?? "—",
        payment_reference:  order.paystack_ref ?? "—",
        delivered_at:  deliveredAt,
      });
      providerMessageId = result.messageId;

      console.log(`[send-order-email] order_delivered → ${customerEmail} (order ${orderRef})`);
    }

    return new Response(JSON.stringify({ sent: true, emailType, orderRef, providerMessageId }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-order-email] Brevo error:", msg);
    // Return 200 so the admin save still succeeds — email failure is non-blocking.
    // Return a generic message to the client to avoid leaking internal details.
    return new Response(JSON.stringify({ sent: false, error: "Email delivery failed. Check Edge Function logs." }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
