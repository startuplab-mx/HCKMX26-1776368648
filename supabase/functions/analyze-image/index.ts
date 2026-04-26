// Mnemosyne — image risk classification for sextortion / explicit / identifying content.
// Privacy-first: the raw image is sent to the vision model in-memory and never
// persisted. The client also computes a perceptual hash locally so the image
// itself never has to leave the device for hash-based blocklists.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "explicit_imagery",
  "minor_explicit_risk",
  "self_generated_intimate",
  "identifying_info_visible",
  "violence_weapons",
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

    const { image, mime } = await req.json();
    if (typeof image !== "string" || !image) {
      return new Response(JSON.stringify({ error: "image required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = image.startsWith("data:")
      ? image
      : `data:${mime ?? "image/png"};base64,${image}`;

    const systemPrompt = `You are Mnemosyne, the image-protection layer of Aegis — a child-safety system in Mexico.
You receive a SINGLE image from a minor's device or camera roll. Your job is to assess whether this image, IF SHARED, would put the minor at risk.

Detection priorities (false negatives are dangerous):
1. Any nudity, partial nudity, lingerie, swimwear in suggestive context, or intimate self-generated content.
2. Visible identifying info: school uniform with logo, home address, license plate, ID card, geo-tagged landmarks, full face + location combo. Text on signs, IDs or uniforms may appear in SPANISH or ENGLISH — read both.
3. Weapons, drugs, alcohol use by minors.
4. Signs the subject is under 18 (treat any such case as critical).

Rules:
- NEVER describe the body or quote sensitive info verbatim. Describe the pattern only ("intimate self-portrait", "school uniform visible").
- The "explanation" and "recommended_action" fields MUST be in English (those go to the parent dashboard) even when the image text is Spanish.
- Output ONLY by calling the function "analyze_image".`;

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
                  text: "Assess this image for child-safety risk if it were shared.",
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_image",
                description: "Return risk analysis for the image.",
                parameters: {
                  type: "object",
                  properties: {
                    risk_score: {
                      type: "number",
                      description: "0 = safe to share, 1 = critical / never share.",
                    },
                    category: { type: "string", enum: [...CATEGORIES] },
                    severity: {
                      type: "string",
                      enum: ["low", "medium", "critical"],
                    },
                    subject_appears_minor: {
                      type: "boolean",
                      description:
                        "True if any visible person plausibly appears under 18.",
                    },
                    contains_nudity: { type: "boolean" },
                    identifying_info: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Short labels of identifying elements visible (e.g. 'school_uniform', 'license_plate', 'home_address').",
                    },
                    explanation: {
                      type: "string",
                      description:
                        "One short sentence (<=200 chars) describing the pattern. NEVER quote bodies or PII.",
                    },
                    recommended_action: {
                      type: "string",
                      description:
                        "One imperative sentence for the parent (<=200 chars).",
                    },
                  },
                  required: [
                    "risk_score",
                    "category",
                    "severity",
                    "subject_appears_minor",
                    "contains_nudity",
                    "identifying_info",
                    "explanation",
                    "recommended_action",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "analyze_image" },
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
    // Hard escalation: minor + nudity is ALWAYS critical.
    if (parsed.subject_appears_minor && parsed.contains_nudity) score = 1;
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
    console.error("analyze-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
