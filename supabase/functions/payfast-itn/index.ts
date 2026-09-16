import { createClient } from "npm:@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

const PAYFAST_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate";

function pfEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

async function md5(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("MD5", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const entries = [...params.entries()];

    const received = params.get("signature") ?? "";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";

    let base = entries
      .filter(([k]) => k !== "signature")
      .map(([k, v]) => `${k}=${pfEncode(v)}`)
      .join("&");
    if (passphrase) base += `&passphrase=${pfEncode(passphrase)}`;
    const expected = await md5(base);

    if (expected !== received) {
      console.error("payfast-itn: signature mismatch");
      return new Response("Invalid signature", { status: 400 });
    }

    if (params.get("merchant_id") !== (Deno.env.get("PAYFAST_MERCHANT_ID") ?? "")) {
      console.error("payfast-itn: merchant id mismatch");
      return new Response("Invalid merchant", { status: 400 });
    }

    // Server-to-server confirmation with PayFast.
    const validation = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: raw,
    }).then((r) => r.text());

    if (!validation.trim().startsWith("VALID")) {
      console.error("payfast-itn: PayFast rejected validation:", validation);
      return new Response("Invalid data", { status: 400 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const mPaymentId = params.get("m_payment_id");
    const paymentStatus = params.get("payment_status");
    const grossAmount = Number(params.get("amount_gross") ?? "0");

    if (!mPaymentId) return new Response("Missing reference", { status: 400 });

    const { data: order } = await admin
      .from("orders")
      .select("id, amount, status, listing_id")
      .eq("m_payment_id", mPaymentId)
      .maybeSingle();

    if (!order) {
      console.error("payfast-itn: no order for", mPaymentId);
      return new Response("OK", { status: 200 });
    }

    if (Math.abs(Number(order.amount) - grossAmount) > 0.01) {
      console.error("payfast-itn: amount mismatch", order.amount, grossAmount);
      return new Response("Amount mismatch", { status: 400 });
    }

    if (paymentStatus === "COMPLETE" && order.status === "pending") {
      await admin
        .from("orders")
        .update({ status: "paid", payfast_payment_id: params.get("pf_payment_id") })
        .eq("id", order.id);

      await admin.from("listings").update({ status: "sold" }).eq("id", order.listing_id);
    } else if (paymentStatus === "CANCELLED" && order.status === "pending") {
      await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("payfast-itn error:", error);
    return new Response("Error", { status: 500 });
  }
});
