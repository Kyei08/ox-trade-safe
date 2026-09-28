import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const PAYFAST_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate";

export type ItnResult = {
  result: "processed" | "ignored" | "failed";
  reason: string | null;
  httpStatus: number;
  body: string;
};

function pfEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

async function md5(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("MD5", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const fail = (reason: string, httpStatus = 400): ItnResult => ({ result: "failed", reason, httpStatus, body: reason });

/** Verifies and applies a raw PayFast ITN body. Shared by the webhook and admin retries. */
// deno-lint-ignore no-explicit-any
export async function processItn(raw: string, admin: any): Promise<ItnResult> {
  const params = new URLSearchParams(raw);
  const entries = [...params.entries()];
  const received = params.get("signature") ?? "";
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";

  let base = entries.filter(([k]) => k !== "signature").map(([k, v]) => `${k}=${pfEncode(v)}`).join("&");
  if (passphrase) base += `&passphrase=${pfEncode(passphrase)}`;
  if ((await md5(base)) !== received) return fail("Signature mismatch");

  if (params.get("merchant_id") !== (Deno.env.get("PAYFAST_MERCHANT_ID") ?? "")) return fail("Merchant ID mismatch");

  let validation = "";
  try {
    validation = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: raw,
    }).then((r) => r.text());
  } catch (e) {
    return fail(`PayFast validation unreachable: ${String(e)}`, 502);
  }
  if (!validation.trim().startsWith("VALID")) return fail(`PayFast rejected validation: ${validation.trim().slice(0, 200)}`);

  const mPaymentId = params.get("m_payment_id");
  const paymentStatus = params.get("payment_status");
  const grossAmount = Number(params.get("amount_gross") ?? "0");
  if (!mPaymentId) return fail("Missing m_payment_id");

  const { error: ledgerError } = await admin.from("payfast_transactions").upsert(
    {
      m_payment_id: mPaymentId,
      pf_payment_id: params.get("pf_payment_id"),
      payment_status: paymentStatus,
      amount_gross: grossAmount,
      payload: Object.fromEntries(entries),
    },
    { onConflict: "pf_payment_id,payment_status,amount_gross" },
  );
  if (ledgerError) console.error("payfast ledger write failed:", ledgerError);

  const { data: order, error: orderError } = await admin
    .from("orders").select("id, amount, status, listing_id").eq("m_payment_id", mPaymentId).maybeSingle();
  if (orderError) return fail(`Order lookup failed: ${orderError.message}`, 500);
  if (!order) return fail(`No order found for ${mPaymentId}`, 200);

  if (Math.abs(Number(order.amount) - grossAmount) > 0.01) {
    return fail(`Amount mismatch: order R${Number(order.amount).toFixed(2)} vs PayFast R${grossAmount.toFixed(2)}`);
  }

  if (paymentStatus === "COMPLETE" && order.status === "pending") {
    const { error } = await admin.from("orders")
      .update({ status: "paid", payfast_payment_id: params.get("pf_payment_id") }).eq("id", order.id);
    if (error) return fail(`Order update failed: ${error.message}`, 500);
    await admin.from("listings").update({ status: "sold" }).eq("id", order.listing_id);
    return { result: "processed", reason: null, httpStatus: 200, body: "OK" };
  }
  if (paymentStatus === "CANCELLED" && order.status === "pending") {
    const { error } = await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    if (error) return fail(`Order update failed: ${error.message}`, 500);
    return { result: "processed", reason: null, httpStatus: 200, body: "OK" };
  }
  return { result: "ignored", reason: `No change: status ${paymentStatus}, order already ${order.status}`, httpStatus: 200, body: "OK" };
}
