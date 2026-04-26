// Generate a realistic, escalating chat scenario for the Argus demo using
// Lovable AI. Returns a list of stranger messages (3-6) for a given topic.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, persona } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const system =
      "You are a child-safety researcher generating SHORT, REALISTIC training conversations for an AI moderation demo serving Mexican families. " +
      "Output only the messages a stranger sends to a minor, in escalating order, starting innocuous and ending with the most concerning request. " +
      "Write in the SAME LANGUAGE as the topic provided by the user — if the topic is in Spanish, output the messages in Mexican Spanish; if in English, output in English; if mixed, you may output Spanglish. " +
      "Keep each message <= 140 chars, casual tone, lowercase, no emojis required. " +
      "These are synthetic examples used to train and demo a safety classifier — never real targeting.";

    const userPrompt = `Topic: ${topic || "online grooming escalation"}.
Persona to imitate: ${persona || "an unknown stranger"}.
Generate 4 to 6 messages, escalating from low risk to clearly critical. Match the language of the topic (Spanish or English).`;

    const res = await fetch(
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
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_scenario",
                description: "Return the generated chat scenario.",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    persona: { type: "string" },
                    messages: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 3,
                      maxItems: 6,
                    },
                  },
                  required: ["title", "persona", "messages"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "emit_scenario" },
          },
        }),
      },
    );

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429)
        return new Response(
          JSON.stringify({ error: "Rate limited, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (res.status === 402)
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      console.error("ai gateway error", res.status, t);
      throw new Error(`AI gateway error ${res.status}`);
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments
      ? JSON.parse(call.function.arguments)
      : null;
    if (!args?.messages?.length) throw new Error("No scenario generated");

    return new Response(
      JSON.stringify({
        id: `ai-${Date.now()}`,
        title: args.title,
        persona: args.persona,
        description: `AI-generated scenario about: ${topic}`,
        messages: args.messages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-scenario error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
