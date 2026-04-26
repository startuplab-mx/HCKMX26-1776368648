// AI-generated parental executive summary from recent risk metadata.
// Input: { period?: "daily" | "weekly" }
// Output: { summary: string, period, stats }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_LABELS: Record<string, string> = {
  grooming: "Grooming",
  sextortion: "Sextortion",
  narco_recruitment: "Narco recruitment",
  financial_fraud: "Financial fraud",
  personal_info_extraction: "Personal info extraction",
  unsafe_meetup: "Unsafe meetup",
  drugs_alcohol: "Drugs & alcohol",
  explicit_imagery: "Explicit imagery",
  cyberbullying: "Cyberbullying",
  pedophilia_risk: "Pedophilia risk",
  sexual_harassment: "Sexual harassment",
  benign: "Safe",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const period = (body.period ?? "weekly") as "daily" | "weekly";
    const sinceMs = (period === "weekly" ? 7 : 1) * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - sinceMs).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: events } = await supabase
      .from("risk_events")
      .select("category,severity,risk_score,created_at,explanation,recommended_action")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(400);

    const list = events ?? [];
    const critical = list.filter((e) => e.severity === "critical");
    const medium = list.filter((e) => e.severity === "medium");
    const low = list.filter((e) => e.severity === "low");

    const byCat = new Map<string, number>();
    for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    const topCats = Array.from(byCat.entries())
      .filter(([k]) => k !== "benign")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${CATEGORY_LABELS[c] ?? c} (${n})`);

    const safetyScore = Math.max(0, 100 - critical.length * 12 - medium.length * 5);

    // --- Build chart-ready datasets so the client can render visuals
    // alongside the AI text without re-querying. ---

    // Daily severity counts (timeline)
    const days = period === "weekly" ? 7 : 1;
    const buckets: Record<string, { date: string; critical: number; medium: number; low: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, critical: 0, medium: 0, low: 0 };
    }
    for (const e of list) {
      const key = String(e.created_at).slice(0, 10);
      if (!buckets[key]) continue;
      if (e.severity === "critical") buckets[key].critical++;
      else if (e.severity === "medium") buckets[key].medium++;
      else buckets[key].low++;
    }
    const timeline = Object.values(buckets);

    // Category breakdown for bar chart
    const categoryBreakdown = Array.from(byCat.entries())
      .filter(([k]) => k !== "benign")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        count,
      }));

    // Severity mix for donut/bar
    const severityMix = [
      { severity: "critical", count: critical.length },
      { severity: "medium", count: medium.length },
      { severity: "low", count: low.length },
    ];

    const stats = {
      period,
      total: list.length,
      critical: critical.length,
      medium: medium.length,
      low: low.length,
      safetyScore,
      topCategories: topCats,
      timeline,
      categoryBreakdown,
      severityMix,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          summary:
            "AI summary unavailable (LOVABLE_API_KEY not configured). Stats are included below.",
          period,
          stats,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sample = critical
      .slice(0, 8)
      .map((e) => `- [${e.severity}] ${CATEGORY_LABELS[e.category] ?? e.category}: ${e.explanation ?? "(no detail)"}`)
      .join("\n") || "(none)";

    const userPrompt = `Write a thorough (≤450 words) executive briefing for a parent reviewing their child's online safety over the last ${period === "weekly" ? "7 days" : "24 hours"}.

Stats:
- Safety score: ${safetyScore}/100
- Total risk events: ${list.length} (critical=${critical.length}, caution=${medium.length}, low=${low.length})
- Top categories: ${topCats.join(", ") || "none"}

Sample critical events:
${sample}

Use this exact markdown structure with bolded section headers (each on its own line):

**Headline**
One bold sentence summarizing overall posture and trend.

**Key signals**
3-4 bullets covering the most important categories, severity trend across the week, and any concerning concentration (e.g. one platform, one contact).

**Behavioral context**
2-3 bullets interpreting what these signals likely mean about the child's online environment — calm, non-alarmist, evidence-based.

**Recommended next steps**
3-4 concrete, actionable steps for the parent, ordered by priority. Each step should be one sentence.

**Conversation starters**
2 short example sentences the parent could use to open a calm dialogue with the child.

Match the language of the events (Spanish if events are in Spanish, otherwise English). Never quote raw chat content. Do not invent data not present in the brief.`;

    const model = "google/gemini-2.5-flash";
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Aegis, a privacy-first child-safety analyst. Be precise, calm, and actionable. Never invent data not present in the brief.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please retry shortly.", stats }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted.", stats }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      throw new Error(`AI gateway ${aiResp.status}: ${t.slice(0, 200)}`);
    }

    const aiJson = await aiResp.json();
    const summary: string =
      aiJson?.choices?.[0]?.message?.content?.trim() ??
      "Summary could not be generated.";

    // Log AI usage for the cost meter
    try {
      const usage = aiJson?.usage ?? {};
      const promptTok = Number(usage.prompt_tokens ?? 0);
      const completionTok = Number(usage.completion_tokens ?? 0);
      const totalTok = Number(usage.total_tokens ?? promptTok + completionTok);
      // Lovable AI gateway pricing for gemini-2.5-flash (approx, USD per 1k tokens)
      const inUsdPer1k = 0.000075;
      const outUsdPer1k = 0.0003;
      const cost = (promptTok / 1000) * inUsdPer1k + (completionTok / 1000) * outUsdPer1k;
      await supabase.from("ai_usage").insert({
        function_name: "executive-summary",
        model,
        prompt_tokens: promptTok,
        completion_tokens: completionTok,
        total_tokens: totalTok,
        cost_usd: cost,
      });
    } catch (logErr) {
      console.error("ai_usage log failed (non-fatal):", logErr);
    }

    return new Response(
      JSON.stringify({ summary, period, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("executive-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
