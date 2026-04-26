// Helios — screen / OCR analysis.
// Accepts a base64 image (data URL or raw base64 + mime), runs a single
// vision-capable LLM call that performs OCR AND risk classification,
// returns structured JSON. Privacy-first: nothing is persisted.

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
  "explicit_imagery",
  "benign",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const { image, mime } = await req.json();
    if (typeof image !== "string" || !image) {
      return new Response(JSON.stringify({ error: "image required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept either a full data URL or raw base64 + mime
    const dataUrl = image.startsWith("data:")
      ? image
      : `data:${mime ?? "image/png"};base64,${image}`;

    const systemPrompt = `You are Helios, a child-safety screen analyzer for a parental protection system in Mexico.
You receive a SINGLE screenshot from a minor's device (chats, social feeds, game UIs, browser pages).
The screenshot may contain text in SPANISH, ENGLISH, or a mix of both (Spanglish). You MUST OCR both languages with equal accuracy — preserve original accents (á, é, í, ó, ú, ñ, ¿, ¡), diacritics, and punctuation exactly as they appear. Never translate the OCR output: return text verbatim in its original language.
Your job:
1. OCR all visible text (preserve sender names if visible). Detect Spanish AND English content. If the screenshot mixes both, return both — do not drop one language.
2. Identify which app/platform the screenshot is from, if visually obvious (Instagram, WhatsApp, TikTok, Roblox, Discord, Snapchat, generic browser, unknown).
3. Classify the OVERALL risk to the minor across these categories: ${CATEGORIES.join(", ")}.
4. Be strict — false negatives are dangerous. Sexual content directed at a minor, sextortion threats, narco recruitment slang ("jale", "halcón", "paquete", "dinero fácil", "trabajo bien pagado"), grooming patterns ("no le digas a tus papás", "don't tell your parents", "our little secret"), and image requests ("mándame una foto", "send me a pic") are ALWAYS critical — in either language.
5. Never quote sensitive content verbatim in the explanation — describe the pattern, not the words. Write the explanation and recommended_action in English (those fields are for the parent dashboard), even if the OCR text is in Spanish.
Respond ONLY by calling the function "analyze_screen".`;

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
                  text: "Analyze this screenshot from a minor's device.",
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_screen",
                description: "Return OCR + risk analysis for the screenshot.",
                parameters: {
                  type: "object",
                  properties: {
                    extracted_text: {
                      type: "string",
                      description:
                        "All readable text in the image, line by line. Empty string if none.",
                    },
                    detected_app: {
                      type: "string",
                      description:
                        "Best guess of the app/platform shown, or 'unknown'.",
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
                        "One short sentence (<=200 chars) explaining WHY this screen is risky. Do not quote sensitive content.",
                    },
                    recommended_action: {
                      type: "string",
                      description:
                        "One imperative sentence for the parent (<=200 chars).",
                    },
                    visible_red_flags: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Short labels of patterns observed (e.g. 'image_request', 'secrecy', 'narco_slang').",
                    },
                  },
                  required: [
                    "extracted_text",
                    "detected_app",
                    "risk_score",
                    "category",
                    "severity",
                    "explanation",
                    "recommended_action",
                    "visible_red_flags",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "analyze_screen" },
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

    // Normalize severity from score so the UI is consistent
    const score = Number(parsed.risk_score) || 0;
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
    console.error("analyze-screen error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
