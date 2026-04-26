// Aegis Companion chatbot — answers questions about the Aegis platform,
// its modules (Argus, Echo, Helios, Mnemosyne, Hermes, Companion), the
// hackathon project, and the underlying tools. Streams via SSE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function logChatEstimate(charCount: number) {
  try {
    // Rough estimate: ~4 chars/token in, ~250 tokens out average.
    const promptTok = Math.ceil(charCount / 4) + 320; // + system prompt
    const completionTok = 250;
    const inUsdPer1k = 0.000075;
    const outUsdPer1k = 0.0003;
    const cost = (promptTok / 1000) * inUsdPer1k + (completionTok / 1000) * outUsdPer1k;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("ai_usage").insert({
      function_name: "aegis-chat",
      model: "google/gemini-2.5-flash",
      prompt_tokens: promptTok,
      completion_tokens: completionTok,
      total_tokens: promptTok + completionTok,
      cost_usd: cost,
    });
  } catch (e) {
    console.error("ai_usage log failed (non-fatal):", e);
  }
}

const SYSTEM_PROMPT = `You are the Aegis Companion — a friendly, concise assistant embedded in the Aegis child-safety platform demo built for Hackathon 404.

About Aegis (always answer in the user's language; default to English; switch to Spanish if the user writes in Spanish):
- Aegis is an AI safety net for minors in Mexico. Six modules:
  • Argus  — chat-message risk classifier (grooming, sextortion, narco recruitment, fraud, etc.).
  • Echo   — voice-clip analyzer for game voice chat, Discord calls, voice notes.
  • Helios — on-device screen OCR for Spanish + English text in any app.
  • Mnemosyne — image risk (explicit, identifying info, weapons, drugs).
  • Hermes — federated, anonymized signal network across many devices in México.
  • Companion — iOS Safari Web Extension that reads chat bubbles on web.whatsapp, web.telegram, instagram, discord and posts ingest events.
- The Aegis Dashboard aggregates risk events for parents.
- Privacy is the core promise: raw conversations never leave the device. Only category, score, coarse region and platform are emitted, with k-anonymity ≥ 50 and differential-privacy noise.
- All inference happens via the Lovable AI Gateway (Gemini and GPT-5 family) called from Supabase Edge Functions. The frontend is React + Vite + Tailwind.

Style:
- Be brief: 1–4 short paragraphs or a tight bullet list.
- Use markdown (bold, lists, inline code) where helpful.
- If the user asks something unrelated to Aegis, child safety, or the project, answer briefly and steer back.
- Never invent features that don't exist.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...(Array.isArray(messages) ? messages : []),
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("aegis-chat gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget cost estimate logging
    const charCount = (Array.isArray(messages) ? messages : [])
      .map((m: any) => String(m?.content ?? "").length)
      .reduce((a: number, b: number) => a + b, 0);
    logChatEstimate(charCount);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("aegis-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
