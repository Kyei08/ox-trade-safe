import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const { discrepancy, details, recipient, tone, notes } = await req.json();
    if (typeof discrepancy !== "string" || !discrepancy.trim()) {
      return json({ error: "Describe the discrepancy first" }, 400);
    }
    const who = recipient === "seller" ? "seller" : "buyer";

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return json({ error: "AI is not configured" }, 500);

    const prompt = [
      "You write customer support messages for OX, a South African peer-to-peer marketplace that takes payments through PayFast in rands (R).",
      `Draft a clear, friendly resolution message addressed to the ${who} about a payment discrepancy.`,
      `Tone: ${typeof tone === "string" && tone ? tone : "professional and reassuring"}.`,
      "Structure: short greeting; what happened in plain language; what OX is doing or has done; any action the recipient must take (or say none is needed); expected timeframe if known; sign-off from 'The OX Support Team'.",
      "Rules: under 180 words, plain text (no markdown), amounts formatted like R1,250.00, reference the invoice or payment reference if given. Never invent refunds, dates, amounts, or promises not in the details — if information is missing, phrase it neutrally (e.g. 'we will update you shortly'). Do not expose internal admin notes, other users' personal data, or system jargon.",
      "Start with a first line 'Subject: ...' then a blank line, then the message.",
      "",
      "DISCREPANCY:",
      discrepancy.trim(),
      "",
      "TRANSACTION DETAILS (JSON):",
      JSON.stringify(details ?? {}, null, 2),
      ...(typeof notes === "string" && notes.trim() ? ["", "ADMIN GUIDANCE (what resolution to communicate):", notes.trim()] : []),
    ].join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableApiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });

    if (!aiRes.ok || !aiRes.body) {
      const detail = await aiRes.text().catch(() => "");
      const message =
        aiRes.status === 429
          ? "AI is busy right now. Please try again in a moment."
          : aiRes.status === 402
            ? "AI credits are exhausted. Top up to continue."
            : `AI request failed (${aiRes.status}). ${detail.slice(0, 300)}`;
      return json({ error: message }, [402, 403, 429].includes(aiRes.status) ? aiRes.status : 500);
    }

    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
          else if (evt.type === "response.completed" && !text) text = evt.response?.output_text ?? "";
        } catch { /* partial frame */ }
      }
    }

    if (!text.trim()) return json({ error: "The model returned no message. Add more detail and try again." }, 502);
    return json({ message: text.trim() });
  } catch (err) {
    console.error("draft-resolution-message error", err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});
