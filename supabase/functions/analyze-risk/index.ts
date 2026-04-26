// Risk detection: hybrid (regex red-flags in Spanish/English + Lovable AI classifier)
// Returns structured analysis for a single chat message.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Approx Lovable AI gateway pricing (USD per 1k tokens)
const PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash": { in: 0.000075, out: 0.0003 },
  "google/gemini-2.5-flash-lite": { in: 0.0000375, out: 0.00015 },
  "google/gemini-2.5-pro": { in: 0.00125, out: 0.005 },
  "google/gemini-3-flash-preview": { in: 0.000075, out: 0.0003 },
  "openai/gpt-5-mini": { in: 0.00025, out: 0.002 },
  "openai/gpt-5": { in: 0.00125, out: 0.01 },
};

async function logAiUsage(opts: {
  function_name: string;
  model: string;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
}) {
  try {
    const u = opts.usage ?? {};
    const p = Number(u.prompt_tokens ?? 0);
    const c = Number(u.completion_tokens ?? 0);
    const t = Number(u.total_tokens ?? p + c);
    const price = PRICING[opts.model] ?? { in: 0.0001, out: 0.0003 };
    const cost = (p / 1000) * price.in + (c / 1000) * price.out;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("ai_usage").insert({
      function_name: opts.function_name,
      model: opts.model,
      prompt_tokens: p,
      completion_tokens: c,
      total_tokens: t,
      cost_usd: cost,
    });
  } catch (e) {
    console.error("ai_usage log failed (non-fatal):", e);
  }
}

type RedFlagCategory =
  | "secrecy"
  | "image_request"
  | "location_extraction"
  | "in_person_meetup"
  | "financial_fraud"
  | "narco_recruitment"
  | "sextortion"
  | "personal_info"
  | "drugs_alcohol";

const RED_FLAGS: Record<RedFlagCategory, string[]> = {
  secrecy: [
    "no le digas a tus papás",
    "no le digas a nadie",
    "que nadie se entere",
    "borra el chat",
    "este es nuestro secreto",
    "don't tell your parents",
    "keep this between us",
    "delete the chat",
  ],
  image_request: [
    "manda foto",
    "mándame una foto",
    "foto íntima",
    "sin ropa",
    "en ropa interior",
    "send a pic",
    "send me a photo",
    "nudes",
    "without clothes",
  ],
  location_extraction: [
    "dónde vives",
    "donde vives",
    "pásame tu dirección",
    "cuál es tu dirección",
    "estás sola",
    "estas sola",
    "a qué escuela vas",
    "where do you live",
    "what's your address",
    "are you alone",
    "what school",
  ],
  in_person_meetup: [
    "nos vemos",
    "te recojo",
    "ven sola",
    "nos juntamos",
    "vamos a vernos",
    "let's meet",
    "i'll pick you up",
    "come alone",
  ],
  financial_fraud: [
    "tarjeta",
    "cuenta bancaria",
    "nip",
    "clave",
    "cvv",
    "transferencia",
    "credit card",
    "bank account",
    "wire transfer",
    "gift card",
  ],
  narco_recruitment: [
    "jale",
    "dinero fácil",
    "dinero facil",
    "paquete",
    "halcón",
    "halcon",
    "trabajito",
    "easy money",
    "drop a package",
  ],
  sextortion: [
    "si no me mandas",
    "voy a publicar",
    "tengo tus fotos",
    "tu familia va a ver",
    "i'll post",
    "i have your photos",
    "your family will see",
  ],
  personal_info: [
    "tu teléfono",
    "tu telefono",
    "tu número",
    "tu numero",
    "tu correo",
    "your phone number",
    "your email",
  ],
  drugs_alcohol: [
    "te invito una chela",
    "te invito un trago",
    "quieres probar",
    "want to try",
    "i'll get you a drink",
  ],
};

const SEVERITY_WEIGHTS: Record<RedFlagCategory, number> = {
  secrecy: 0.35,
  image_request: 0.4,
  location_extraction: 0.3,
  in_person_meetup: 0.4,
  financial_fraud: 0.35,
  narco_recruitment: 0.45,
  sextortion: 0.6,
  personal_info: 0.2,
  drugs_alcohol: 0.25,
};

function ruleScan(message: string) {
  const text = message.toLowerCase();
  const matched: { category: RedFlagCategory; phrase: string }[] = [];
  let score = 0;
  for (const [cat, phrases] of Object.entries(RED_FLAGS) as [
    RedFlagCategory,
    string[],
  ][]) {
    for (const p of phrases) {
      if (text.includes(p)) {
        matched.push({ category: cat, phrase: p });
        score += SEVERITY_WEIGHTS[cat];
        break; // only count category once
      }
    }
  }
  return { score: Math.min(score, 1), matched };
}

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

async function aiClassify(message: string, history: string[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const systemPrompt = `You are a child-safety classifier for a parental protection system in Mexico.
You analyze a single chat message (in Spanish or English) sent to or by a minor (ages 6-17).
Classify the risk to the minor. Be strict — false negatives are dangerous.
Categories: ${CATEGORIES.join(", ")}.
Severity scale: low | medium | critical.
Always respond by calling the function "classify_risk".`;

  const userPrompt = `Recent conversation context (oldest first):
${history.slice(-6).map((m, i) => `${i + 1}. ${m}`).join("\n") || "(no prior messages)"}

NEW message to classify:
"""${message}"""`;

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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_risk",
              description: "Return structured risk classification.",
              parameters: {
                type: "object",
                properties: {
                  risk_score: {
                    type: "number",
                    description: "0 = safe, 1 = critical",
                  },
                  category: { type: "string", enum: [...CATEGORIES] },
                  severity: {
                    type: "string",
                    enum: ["low", "medium", "critical"],
                  },
                  explanation: {
                    type: "string",
                    description:
                      "One short sentence (<=160 chars) explaining WHY this is risky. Do not quote the sensitive content verbatim.",
                  },
                  recommended_action: {
                    type: "string",
                    description:
                      "One short imperative sentence for the parent (<=160 chars).",
                  },
                },
                required: [
                  "risk_score",
                  "category",
                  "severity",
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
          function: { name: "classify_risk" },
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body}`);
  }
  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call in AI response");
  // Fire-and-forget cost logging
  logAiUsage({ function_name: "analyze-risk", model: "google/gemini-2.5-flash", usage: data.usage });
  return JSON.parse(call.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rule = ruleScan(message);
    let ai;
    try {
      ai = await aiClassify(message, Array.isArray(history) ? history : []);
    } catch (e) {
      console.error("AI classify failed, falling back to rules:", e);
      const sev =
        rule.score >= 0.7 ? "critical" : rule.score >= 0.4 ? "medium" : "low";
      ai = {
        risk_score: rule.score,
        category: rule.matched[0]?.category ?? "benign",
        severity: sev,
        explanation:
          rule.matched.length > 0
            ? `Matched red-flag patterns: ${rule.matched.map((m) => m.category).join(", ")}.`
            : "No risk patterns detected.",
        recommended_action:
          rule.score >= 0.4
            ? "Review this conversation with the minor and consider blocking the contact."
            : "Continue monitoring.",
      };
    }

    // Combine: AI score floored by rule score
    const finalScore = Math.max(
      Number(ai.risk_score) || 0,
      rule.score,
    );
    const severity =
      finalScore >= 0.7 ? "critical" : finalScore >= 0.4 ? "medium" : "low";

    const result = {
      risk_score: Number(finalScore.toFixed(2)),
      category: ai.category,
      severity,
      matched_patterns: rule.matched,
      explanation: ai.explanation,
      recommended_action: ai.recommended_action,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-risk error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
