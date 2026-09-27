import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/responses'
const MODEL = 'openai/gpt-6-astra'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admins only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const discrepancy = typeof body?.discrepancy === 'string' ? body.discrepancy.trim() : ''
    const details = typeof body?.details === 'string' ? body.details.trim() : ''
    if (!discrepancy || discrepancy.length > 4000) {
      return new Response(JSON.stringify({ error: 'A discrepancy description (max 4000 chars) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (details.length > 8000) {
      return new Response(JSON.stringify({ error: 'Transaction details too long (max 8000 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI is not configured for this project' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = [
      'You are a payments operations specialist for a South African marketplace that uses PayFast.',
      'An admin reports a payment discrepancy. Diagnose it based only on the information given.',
      '',
      'Respond in markdown with exactly these sections:',
      '## Likely cause',
      'One or two sentences naming the single most likely cause.',
      '## Evidence',
      'Up to 4 bullets pointing to the specific facts in the discrepancy and transaction details that support the diagnosis.',
      '## Recommendation',
      'One of: **Refund**, **Retry**, or **Investigate** — followed by one sentence justifying the choice.',
      '## Next steps',
      'Up to 4 numbered, concrete actions for the admin.',
      '',
      'Rules: Do not invent transaction data, amounts, or dates. If the evidence is insufficient, say so under Evidence and recommend Investigate. Amounts are in ZAR (R).',
      '',
      `Discrepancy:\n${discrepancy}`,
      details ? `\nRelated transaction details:\n${details}` : '',
    ].join('\n')

    const aiRes = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        input: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok || !aiRes.body) {
      const errText = await aiRes.text().catch(() => '')
      return new Response(JSON.stringify({ error: `AI request failed (${aiRes.status})`, detail: errText.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reader = aiRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let analysis = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const evt = JSON.parse(data)
          if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
            analysis += evt.delta
          }
        } catch { /* ignore non-JSON keepalives */ }
      }
    }

    if (!analysis.trim()) {
      return new Response(JSON.stringify({ error: 'The AI returned an empty diagnosis. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ analysis }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
