import { createClient } from "npm:@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYFAST_PROCESS_URL = "https://www.payfast.co.za/eng/process";

// PayFast requires the values urlencoded with uppercase hex and spaces as "+".
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") ?? "";
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") ?? "";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
    if (!merchantId || !merchantKey) {
      throw new Error("PayFast is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "You need to sign in to buy this item" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Your session expired, please sign in again" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = body?.listingId;
    if (!listingId || typeof listingId !== "string") {
      return new Response(JSON.stringify({ error: "Listing ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Simple in-app rate limit: cap checkout initiations per buyer (the backend has
    // no standard rate-limiting primitive, so this uses recent order creations).
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentOrders } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", user.id)
      .gte("created_at", tenMinutesAgo);
    if ((recentOrders ?? 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Too many checkout attempts. Please wait a few minutes and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, title, status, seller_id, listing_type, fixed_price, current_bid")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) throw new Error("Listing not found");
    if (listing.seller_id === user.id) throw new Error("You cannot buy your own listing");

    // Auctions are payable only by the confirmed winner after the auction has
    // closed (listing finalized to "sold" with the winning bid marked). This
    // prevents anyone from paying the current bid to claim a live auction.
    if (listing.listing_type === "auction") {
      if (listing.status !== "sold") {
        throw new Error("This auction is still running — you can pay for it once it has ended");
      }
      const { data: winningBid } = await admin
        .from("bids")
        .select("id, bidder_id")
        .eq("listing_id", listing.id)
        .eq("is_winning", true)
        .maybeSingle();
      if (!winningBid || winningBid.bidder_id !== user.id) {
        throw new Error("Only the auction winner can pay for this item");
      }
    } else if (listing.status !== "active") {
      throw new Error("This listing is no longer available");
    }

    const price = listing.listing_type === "fixed_price" ? listing.fixed_price : listing.current_bid;
    if (!price || Number(price) <= 0) throw new Error("No valid price found for this listing");
    const amount = Number(price).toFixed(2);

    // Reuse an existing unpaid order for this buyer + listing so repeat clicks
    // never create duplicate payment attempts.
    const { data: existing } = await admin
      .from("orders")
      .select("id, m_payment_id, status")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let mPaymentId = existing?.m_payment_id ?? null;

    if (!existing) {
      mPaymentId = crypto.randomUUID();
      const { error: insertError } = await admin.from("orders").insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: Number(amount),
        status: "pending",
        payment_provider: "payfast",
        m_payment_id: mPaymentId,
      });
      if (insertError) throw new Error(insertError.message);
    } else if (!mPaymentId) {
      mPaymentId = crypto.randomUUID();
      await admin.from("orders").update({ m_payment_id: mPaymentId }).eq("id", existing.id);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const nameParts = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
    const origin = req.headers.get("origin") ?? body?.origin ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // Order matters: the signature is built from this exact sequence.
    const fields: Array<[string, string]> = [
      ["merchant_id", merchantId],
      ["merchant_key", merchantKey],
      ["return_url", `${origin}/payment-success?listing_id=${listingId}&m_payment_id=${mPaymentId}`],
      ["cancel_url", `${origin}/listings/${listingId}?payment=cancelled`],
      ["notify_url", `${supabaseUrl}/functions/v1/payfast-itn`],
    ];
    if (nameParts[0]) fields.push(["name_first", nameParts[0].slice(0, 100)]);
    if (nameParts.length > 1) fields.push(["name_last", nameParts.slice(1).join(" ").slice(0, 100)]);
    if (profile?.email ?? user.email) fields.push(["email_address", (profile?.email ?? user.email)!]);
    fields.push(["m_payment_id", mPaymentId!]);
    fields.push(["amount", amount]);
    fields.push(["item_name", String(listing.title).slice(0, 100)]);
    fields.push(["custom_str1", listingId]);
    fields.push(["custom_str2", user.id]);

    const filtered = fields.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
    let signatureBase = filtered.map(([k, v]) => `${k}=${pfEncode(String(v))}`).join("&");
    if (passphrase) signatureBase += `&passphrase=${pfEncode(passphrase)}`;
    const signature = await md5(signatureBase);

    const query = filtered
      .map(([k, v]) => `${k}=${pfEncode(String(v))}`)
      .concat(`signature=${signature}`)
      .join("&");

    return new Response(JSON.stringify({ url: `${PAYFAST_PROCESS_URL}?${query}`, mPaymentId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("payfast-checkout error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
