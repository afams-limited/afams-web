// ============================================================
// Afams Ltd — Paystack Webhook Handler
// Path: supabase/functions/paystack-webhook/index.ts
// Runtime: Supabase Edge Functions (Deno)
// Deploy:  supabase functions deploy paystack-webhook --no-verify-jwt
//
// Required Supabase Secrets:
//   PAYSTACK_SECRET_KEY
//   BREVO_API_KEY
//   BREVO_SENDER_EMAIL          (e.g. orders@afams.co.ke)
//   BREVO_SENDER_NAME           (e.g. Afams)
//   BREVO_ADMIN_EMAIL           (admin notification recipient)
//   BREVO_TEMPLATE_ORDER_RECEIVED    (integer template ID)
//   BREVO_TEMPLATE_PAYMENT_SUCCESS   (integer template ID)
//   BREVO_TEMPLATE_ADMIN_NEW_ORDER   (integer template ID)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BREVO_TEMPLATES } from "../_shared/types.ts";

// ── Brevo email helper ────────────────────────────────────────
async function sendBrevoTemplate(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  templateId: number,
  toEmail: string,
  toName: string,
  params: Record<string, string | number>,
): Promise<void> {
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
    console.error(`[Webhook/Brevo] template ${templateId} failed: ${res.status} ${text}`);
  }
}

// ── HMAC-SHA512 signature verification ───────────────────────
async function verifySignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body),
  );
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

function formatPaymentMethod(raw: unknown): string {
  const val = String(raw ?? "").trim().toLowerCase();
  if (val === "mobile_money_mtn" || val.includes("airtel")) return "Airtel Money";
  if (val === "mobile_money" || val.includes("mpesa") || val.includes("m-pesa")) return "M-Pesa";
  if (val.includes("till")) return "M-Pesa Till";
  if (val.includes("card")) return "Card";
  if (!val || val === "paystack") return "M-Pesa / M-Pesa Till / Airtel Money / Card";
  return String(raw);
}

function parseMetadataArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      return typeof parsed === "object" && parsed !== null ? [parsed] : [];
    } catch {
      return [];
    }
  }
  if (typeof value === "object") return [value];
  return [];
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecret) {
    console.error("[Webhook] PAYSTACK_SECRET_KEY is not set");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read raw body — required for HMAC verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  if (!signature || !(await verifySignature(rawBody, signature, paystackSecret))) {
    console.error("[Webhook] Invalid Paystack signature");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Bad Request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = payload.event as string | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  console.log(`[Webhook] Event: ${eventType} | Ref: ${(data as { reference?: string })?.reference}`);

  // ── Handle charge.success ───────────────────────────────────
  if (eventType === "charge.success" && data) {
    const reference = data.reference as string | undefined;
    const amount = data.amount as number | undefined;
    const customer = data.customer as Record<string, string> | undefined;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    const paid_at = data.paid_at as string | undefined;
    const paymentChannel = data.channel as string | undefined;
    const paymentMethodLabel = formatPaymentMethod(paymentChannel || metadata.payment_method);

    if (!reference) {
      console.error("[Webhook] charge.success missing reference");
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!paid_at) {
      console.warn(`[Webhook] paid_at missing for ref ${reference} — using server time`);
    }

    const totalKes = Math.round((amount ?? 0) / 100); // kobo/cents → KES

    // metadata shape set during Paystack popup initialisation:
    // { customer_name, customer_phone, product_sku, product_name,
    //   quantity, unit_price, delivery_address, county }
    const customer_name = metadata.customer_name as string | undefined;
    const customer_phone = metadata.customer_phone as string | undefined;
    const product_sku = metadata.product_sku as string | undefined;
    const product_name = metadata.product_name as string | undefined;
    const quantity = metadata.quantity as string | number | undefined;
    const unit_price = metadata.unit_price as string | number | undefined;
    const delivery_address = metadata.delivery_address as string | undefined;
    const county = metadata.county as string | undefined;

    // Add-on fields (set by checkout.html for FarmBag orders)
    const rawFreeSeeds   = metadata.free_seeds;
    const rawExtraSeeds  = metadata.extra_seeds;
    const extra_seeds_count = parseInt(String(metadata.extra_seeds_count  ?? "0"), 10) || 0;
    const extra_seeds_total = parseInt(String(metadata.extra_seeds_total  ?? "0"), 10) || 0;
    const prosoil_qty       = parseInt(String(metadata.prosoil_qty        ?? "0"), 10) || 0;
    const prosoil_total     = parseInt(String(metadata.prosoil_total      ?? "0"), 10) || 0;
    const prosoil_promo_bag = metadata.prosoil_promo_bag === true || metadata.prosoil_promo_bag === "true";
    const addons_total      = parseInt(String(metadata.addons_total       ?? "0"), 10) || 0;

    // Compute prosoil_promo_qty: from metadata if provided, otherwise derive from cart_items
    let prosoil_promo_qty   = parseInt(String(metadata.prosoil_promo_qty  ?? "0"), 10) || 0;
    if (!prosoil_promo_qty && metadata.cart_items) {
      try {
        const cartItems = Array.isArray(metadata.cart_items)
          ? metadata.cart_items
          : JSON.parse(String(metadata.cart_items));
        const hasFarmBag = Array.isArray(cartItems) &&
          cartItems.some((i: any) => ["FB-CLS-01", "FB-GRW-01"].includes(i.sku));
        if (hasFarmBag && prosoil_qty >= 3) {
          prosoil_promo_qty = Math.floor(prosoil_qty / 3);
        }
      } catch { /* ignore parse errors */ }
    }

    const free_seeds = parseMetadataArray(rawFreeSeeds);
    const extra_seeds = parseMetadataArray(rawExtraSeeds);

    // Supabase client — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency check — skip duplicate events
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("paystack_ref", reference)
      .single();

    if (existing) {
      console.log(`[Webhook] Duplicate ref ${reference} — skipping`);
      return new Response(JSON.stringify({ status: "duplicate" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resolvedCustomerName = customer_name || customer?.name;
    if (!resolvedCustomerName) {
      console.warn(`[Webhook] customer_name missing for ref ${reference} — order will be flagged as Unknown`);
    }

    // Write order to Supabase
    const { error } = await supabase.from("orders").insert({
      customer_name:    resolvedCustomerName || "Unknown",
      customer_email:   customer?.email,
      customer_phone:   customer_phone || customer?.phone,
      delivery_address: delivery_address || null,
      county:           county || null,
      product_sku:      product_sku || null,
      product_name:     product_name || "FarmBag Product",
      quantity:         parseInt(String(quantity ?? "1"), 10) || 1,
      unit_price:       parseInt(String(unit_price ?? "0"), 10) || 0,
      total_amount:     totalKes,
      paystack_ref:     reference,
      payment_method:   "paystack",
      status:           "paid",
      paid_at:          paid_at || new Date().toISOString(),
      free_seeds:       free_seeds,
      extra_seeds:      extra_seeds,
      extra_seeds_count: extra_seeds_count,
      extra_seeds_total: extra_seeds_total,
      prosoil_qty:      prosoil_qty,
      prosoil_total:    prosoil_total,
      prosoil_promo_bag: prosoil_promo_bag,
      prosoil_promo_qty: prosoil_promo_qty,
      addons_total:     addons_total,
    });

    if (error) {
      console.error("[Webhook] Supabase insert error:", error);
      return new Response(JSON.stringify({ error: "DB write failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[Webhook] Order created — ${customer?.email} KES ${totalKes}`);

    // ── Send Brevo transactional emails ──────────────────────
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey && customer?.email) {
      const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "orders@afams.co.ke";
      const senderName  = Deno.env.get("BREVO_SENDER_NAME")  ?? "Afams";
      const adminEmail  = Deno.env.get("BREVO_ADMIN_EMAIL")  ?? "iammwombe@gmail.com";

      // Fetch the newly created order to get the generated order_number
      const { data: newOrder } = await supabase
        .from("orders")
        .select("order_number")
        .eq("paystack_ref", reference)
        .single();

      const orderRef   = newOrder?.order_number ?? reference.slice(0, 8);
      const custName   = resolvedCustomerName ?? "Customer";
      const custEmail  = customer.email;
      const prodName   = product_name ?? "FarmBag Product";
      const qty        = String(parseInt(String(quantity ?? "1"), 10) || 1);
      const totalStr   = `KES ${totalKes.toLocaleString("en-KE")}`;
      const paidAtStr  = paid_at
        ? new Date(paid_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

      const sharedParams = {
        order_number:   orderRef,
        order_ref:      orderRef,
        order_reference: orderRef,
        customer_name:  custName,
        product_name:   prodName,
        quantity:       qty,
        total_amount:   totalStr,
        payment_method: paymentMethodLabel,
        payment_reference: reference,
        paystack_reference: reference,
        paid_at:        paidAtStr,
        customer_phone: customer_phone ?? "—",
        delivery_address: delivery_address ?? "—",
        county:         county ?? "—",
        brand_logo_url: "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url: "https://afams.co.ke/assets/images/afams_favicon_512.png",
      };

      // #1 Order Received — confirm the order is in our queue
      const tplOrderReceived = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_RECEIVED") ?? String(BREVO_TEMPLATES.order_received), 10,
      );
      await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, tplOrderReceived, custEmail, custName, sharedParams)
        .catch((e) => console.error("[Webhook] order_received email failed:", e));

      // #2 Payment Success — confirm payment was received
      const tplPaymentSuccess = parseInt(
        Deno.env.get("BREVO_TEMPLATE_PAYMENT_SUCCESS") ?? String(BREVO_TEMPLATES.payment_success), 10,
      );
      await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, tplPaymentSuccess, custEmail, custName, sharedParams)
        .catch((e) => console.error("[Webhook] payment_success email failed:", e));

      // #4 Admin New Order — notify admin of new paid order
      const tplAdminOrder = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ADMIN_NEW_ORDER") ?? String(BREVO_TEMPLATES.admin_new_order), 10,
      );
      await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, tplAdminOrder, adminEmail, "Afams Admin", {
        ...sharedParams,
        customer_email: custEmail,
      }).catch((e) => console.error("[Webhook] admin_new_order email failed:", e));

      console.log(`[Webhook] Brevo emails dispatched for order ${orderRef}`);
    } else if (!brevoApiKey) {
      console.warn("[Webhook] BREVO_API_KEY not set — skipping emails");
    }
  }

  // Acknowledge all other events
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
