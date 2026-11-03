// Temporary diagnostic: reports ONLY the lengths of PayFast-related env vars.
// Never returns the values themselves.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const len = (name: string) => (Deno.env.get(name) ?? "").length;
  const raw = (name: string) => {
    const v = Deno.env.get(name) ?? "";
    return { length: v.length, hasWhitespace: v !== v.trim() };
  };
  return new Response(
    JSON.stringify({
      PAYFAST_MERCHANT_ID: raw("PAYFAST_MERCHANT_ID"),
      PAYFAST_MERCHANT_KEY: raw("PAYFAST_MERCHANT_KEY"),
      PAYFAST_PASSPHRASE: { length: len("PAYFAST_PASSPHRASE") },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
