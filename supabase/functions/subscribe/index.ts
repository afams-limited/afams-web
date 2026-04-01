// ============================================================
// Afams Ltd — Growers Club Subscribe Handler
// Path: supabase/functions/subscribe/index.ts
// Runtime: Supabase Edge Functions (Deno)
// Deploy:  supabase functions deploy subscribe
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let body: { email?: string; first_name?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "A valid email address is required" }), {
      status: 422,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Use service-role client to bypass RLS for upsert (handles duplicates gracefully)
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await sb
    .from("subscribers")
    .upsert(
      {
        email,
        first_name: (body.first_name || "").trim() || null,
        source:     (body.source || "website").trim(),
        status:     "active",
      },
      { onConflict: "email", ignoreDuplicates: false },
    );

  if (error) {
    console.error("[Subscribe] Supabase upsert error:", error);
    return new Response(JSON.stringify({ error: "Subscription failed. Please try again." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  console.log(`[Subscribe] Subscribed: ${email}`);
  return new Response(JSON.stringify({ success: true, email }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
