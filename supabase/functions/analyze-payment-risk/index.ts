import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order, issue } = await req.json();
    if (!order || typeof issue !== "string" || !issue.trim()) {
      return new Response(JSON.stringify({ error: "Order record and issue description are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = [
      "You are a payments risk analyst for a South African peer-to-peer marketplace that uses PayFast (ZAR).",
      "Review the order record and the reported payment issue, then answer in markdown with exactly these sections:",
      "## Risk summary (2-3 sentences)",
      "## Risk level (one of: Low, Medium, High, with a one-line reason)",
      "## Potential risks (max 5 bullets)",
      "## Recommended next actions (max 5 numbered, concrete steps for the admin)",
      "Be concise (under 300 words). Do not invent facts that are not in the record; call out missing information instead.",
      "",
      "ORDER RECORD (JSON):",
      JSON.stringify(order, null, 2),
      "",
      "REPORTED PAYMENT ISSUE:",
      issue.trim(),
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
      return new Response(JSON.stringify({ error: message }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read the SSE stream and accumulate the answer text.
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
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt.type === "response.completed" && !text) {
            text = evt.response?.output_text ?? "";
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "The model returned no analysis. Try adding more detail to the issue description." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ analysis: text.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-payment-risk error", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
