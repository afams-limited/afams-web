// ============================================================
// Afams Ltd — Paystack Webhook Handler
// Path: supabase/functions/paystack-webhook/index.ts
// Runtime: Supabase Edge Functions (Deno)
// Deploy:  supabase functions deploy paystack-webhook --no-verify-jwt
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    });

    if (error) {
      console.error("[Webhook] Supabase insert error:", error);
      return new Response(JSON.stringify({ error: "DB write failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[Webhook] Order created — ${customer?.email} KES ${totalKes}`);
  }

  // Acknowledge all other events
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
