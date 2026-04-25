// Echo — voice grooming detection.
// Accepts a base64-encoded audio clip (webm/ogg/mp3/wav) from the browser,
// sends it to a multimodal Gemini model that BOTH transcribes AND classifies
// risk in a single call. Privacy-first: nothing is persisted server-side.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "grooming",
  "sexual_harassment",
  "pedophilia_risk",
  "narco_recruitment",
  "financial_fraud",
  "personal_info_extraction",
  "sextortion",
  "cyberbullying",
  "unsafe_meetup",
  "drugs_alcohol",
  "benign",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const { audio, mime } = await req.json();
    if (typeof audio !== "string" || !audio) {
      return new Response(JSON.stringify({ error: "audio required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = audio.startsWith("data:")
      ? audio
      : `data:${mime ?? "audio/webm"};base64,${audio}`;

    const systemPrompt = `You are Echo, the voice-analysis layer of Aegis — a child-safety system in Mexico.
You receive a SINGLE short audio clip from a minor's device (game voice chat, Discord call, voice note in WhatsApp, in-person recording). It may be Spanish (MX) or English.

Your job:
1. Transcribe the speech accurately. If multiple speakers, label them "speaker_a", "speaker_b". Mark "[unclear]" for unintelligible parts.
2. Detect tone/emotion of EACH speaker (calm, distressed, threatening, flirtatious, persuasive, neutral).
3. Classify OVERALL risk to the minor across these categories: ${CATEGORIES.join(", ")}.
4. Be strict — false negatives are dangerous. Treat as ALWAYS critical:
   - Adult voice making sexual remarks to a child voice.
   - Narco recruitment slang ("jale", "halcón", "paquete", "dinero fácil", "sicario").
   - Requests for the minor to keep secrets, send images, meet alone, or share location.
   - Coercion, threats ("si no haces X voy a…"), sextortion patterns.
5. NEVER quote sensitive content verbatim in the explanation. Describe the pattern only.

Respond ONLY by calling the function "analyze_audio".`;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcribe and analyze this audio clip from a minor's device.",
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_audio",
                description:
                  "Return transcript + voice risk analysis for the audio clip.",
                parameters: {
                  type: "object",
                  properties: {
                    transcript: {
                      type: "string",
                      description:
                        "Full transcript with speaker labels if multiple speakers.",
                    },
                    detected_language: {
                      type: "string",
                      description: "'es', 'en', 'mixed', or 'unknown'.",
                    },
                    speaker_count: { type: "integer" },
                    likely_adult_speaker: {
                      type: "boolean",
                      description:
                        "True if at least one voice plausibly belongs to an adult speaking to a minor.",
                    },
                    dominant_tone: {
                      type: "string",
                      description:
                        "Overall tone (calm, distressed, threatening, flirtatious, persuasive, neutral).",
                    },
                    risk_score: {
                      type: "number",
                      description: "0 = safe, 1 = critical.",
                    },
                    category: { type: "string", enum: [...CATEGORIES] },
                    severity: {
                      type: "string",
                      enum: ["low", "medium", "critical"],
                    },
                    explanation: {
                      type: "string",
                      description:
                        "One short sentence (<=200 chars) describing WHY this audio is risky. Do not quote sensitive content.",
                    },
                    recommended_action: {
                      type: "string",
                      description:
                        "One imperative sentence for the parent (<=200 chars).",
                    },
                    audio_red_flags: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Short labels of patterns (e.g. 'adult_to_minor', 'secrecy_request', 'narco_slang', 'image_request').",
                    },
                  },
                  required: [
                    "transcript",
                    "detected_language",
                    "speaker_count",
                    "likely_adult_speaker",
                    "dominant_tone",
                    "risk_score",
                    "category",
                    "severity",
                    "explanation",
                    "recommended_action",
                    "audio_red_flags",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "analyze_audio" },
          },
        }),
      },
    );

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please try again shortly." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (res.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body}`);
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No tool call in AI response");
    const parsed = JSON.parse(call.function.arguments);

    let score = Number(parsed.risk_score) || 0;
    // Hard escalation: adult speaker + grooming/sexual = critical.
    if (
      parsed.likely_adult_speaker &&
      ["grooming", "sexual_harassment", "pedophilia_risk", "sextortion"].includes(
        parsed.category,
      )
    ) {
      score = Math.max(score, 0.9);
    }
    const severity =
      score >= 0.7 ? "critical" : score >= 0.4 ? "medium" : "low";

    return new Response(
      JSON.stringify({
        ...parsed,
        risk_score: Number(score.toFixed(2)),
        severity,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
