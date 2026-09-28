import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { processItn } from "../_shared/payfastItn.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const parsed = z.object({ eventId: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid eventId" }, 400);

  const { data: event } = await admin.from("payfast_itn_events").select("*").eq("id", parsed.data.eventId).maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);
  if (event.result !== "failed") return json({ error: "Only failed notifications can be retried" }, 409);

  // Full re-verification (signature, merchant, PayFast validate) — the stored body is never trusted blindly.
  let outcome;
  try {
    outcome = await processItn(event.raw_body, admin);
  } catch (e) {
    outcome = { result: "failed" as const, reason: `Unexpected error: ${String(e)}`, httpStatus: 500, body: "Error" };
  }

  await admin.from("payfast_itn_events").update({
    result: outcome.result,
    failure_reason: outcome.reason,
    http_status: outcome.httpStatus,
    retry_count: (event.retry_count ?? 0) + 1,
    last_retry_at: new Date().toISOString(),
    last_retry_by: user.id,
  }).eq("id", event.id);

  return json({ result: outcome.result, reason: outcome.reason });
});
