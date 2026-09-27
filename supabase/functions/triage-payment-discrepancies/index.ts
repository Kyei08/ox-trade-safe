import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TriageCase {
  ref: string;
  issueType: string;
  discrepancy: string;
  details?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

    const body = await req.json();
    const cases: TriageCase[] = Array.isArray(body?.cases) ? body.cases : [];

    if (cases.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one case is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (cases.length > 50) {
      return new Response(
        JSON.stringify({ error: "Maximum 50 cases per triage run" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    for (const c of cases) {
      if (
        typeof c?.ref !== "string" ||
        typeof c?.discrepancy !== "string" ||
        c.discrepancy.trim().length === 0
      ) {
        return new Response(
          JSON.stringify({
            error: "Each case needs a ref and a discrepancy description",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (c.discrepancy.length > 2000 || (c.details ?? "").length > 4000) {
        return new Response(
          JSON.stringify({ error: "Case text is too long" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const caseList = cases
      .map(
        (c, i) =>
          `CASE ${i + 1} [ref: ${c.ref}] (${c.issueType || "issue"})\nDiscrepancy: ${c.discrepancy.trim()}${
            c.details?.trim() ? `\nDetails: ${c.details.trim()}` : ""
          }`
      )
      .join("\n\n---\n\n");

    const prompt = `You are a payments operations specialist for OX, a South African peer-to-peer marketplace that takes card payments via PayFast (amounts in ZAR, e.g. R1,250.00).

An admin has unresolved PayFast reconciliation discrepancies. Rank ALL cases by urgency and tell the admin which evidence to review first for each.

Cases:
${caseList}

Rules:
- Rank every case. Urgency considers: money at risk, whether a buyer or seller is currently affected, how long it may have been unresolved, and risk of the issue recurring or growing.
- Never invent transaction data, amounts, or dates. If a case lacks enough information, say so and rank it based on potential impact.
- Use the exact case refs provided so the admin can match results back.

Respond in EXACTLY this markdown structure, one block per case, most urgent first:

## Rank 1 — [ref] — URGENCY: HIGH|MEDIUM|LOW
**Why this rank:** one or two sentences.
**Review first:** the single most important piece of evidence to check, and why.
**Then check:** up to 2 further evidence items, comma-separated.

Finish with a final line:
## Overall
One sentence on what to tackle first across the whole queue.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          input: prompt,
          reasoning: { effort: "low" },
          stream: true,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `AI request failed (${aiResponse.status})` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Consume the SSE stream and assemble the final text.
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let analysis = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (
            evt.type === "response.output_text.delta" &&
            typeof evt.delta === "string"
          ) {
            analysis += evt.delta;
          } else if (
            evt.type === "response.completed" &&
            !analysis &&
            Array.isArray(evt.response?.output)
          ) {
            for (const item of evt.response.output) {
              if (item.type === "message" && Array.isArray(item.content)) {
                for (const part of item.content) {
                  if (part.type === "output_text" && part.text) {
                    analysis += part.text;
                  }
                }
              }
            }
          }
        } catch {
          // ignore unparseable SSE lines
        }
      }
    }

    if (!analysis.trim()) {
      return new Response(
        JSON.stringify({ error: "The model returned an empty response" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("triage-payment-discrepancies error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
