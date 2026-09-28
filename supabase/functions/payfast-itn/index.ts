import { createClient } from "npm:@supabase/supabase-js@2";
import { processItn } from "../_shared/payfastItn.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const raw = await req.text();
  const params = new URLSearchParams(raw);

  let outcome;
  try {
    outcome = await processItn(raw, admin);
  } catch (error) {
    outcome = { result: "failed" as const, reason: `Unexpected error: ${String(error)}`, httpStatus: 500, body: "Error" };
  }

  // Callback log: every ITN is recorded with its outcome (raw body kept for secure retries).
  const { error: logError } = await admin.from("payfast_itn_events").insert({
    m_payment_id: params.get("m_payment_id"),
    pf_payment_id: params.get("pf_payment_id"),
    payment_status: params.get("payment_status"),
    amount_gross: params.get("amount_gross") ? Number(params.get("amount_gross")) : null,
    raw_body: raw,
    result: outcome.result,
    failure_reason: outcome.reason,
    http_status: outcome.httpStatus,
    source_ip: req.headers.get("x-forwarded-for"),
  });
  if (logError) console.error("payfast-itn: log write failed:", logError);

  return new Response(outcome.body, { status: outcome.httpStatus });
});
