// Sends a daily or weekly Aegis digest email summarizing risk activity.
// Triggered by pg_cron. ?period=daily or ?period=weekly

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
  benign: "Benign",
};

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateName: "aegis-digest",
      recipientEmail: to,
      idempotencyKey: `digest-${subject}-${to}-${Date.now()}`,
      templateData: { subject, html, text },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email function failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = (url.searchParams.get("period") ?? "daily") as
      | "daily"
      | "weekly";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(
      Date.now() - (period === "weekly" ? 7 : 1) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: events } = await supabase
      .from("risk_events")
      .select("category,severity,risk_score,created_at,explanation")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    const list = events ?? [];
    const critical = list.filter((e) => e.severity === "critical");
    const medium = list.filter((e) => e.severity === "medium");
    const byCat = new Map<string, number>();
    for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    const topCats = Array.from(byCat.entries())
      .filter(([k]) => k !== "benign")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const { data: msgCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    // Fetch parent
    const { data: parents } = await supabase
      .from("parent_contacts")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1);
    const parent = parents?.[0];
    if (!parent) {
      return new Response(JSON.stringify({ error: "no parent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const wantsThis =
      period === "daily" ? parent.email_daily_digest : parent.email_weekly_digest;
    if (!wantsThis || !parent.email) {
      return new Response(JSON.stringify({ skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const periodLabel = period === "weekly" ? "weekly" : "daily";
    const subject = `[Aegis] Your ${periodLabel} safety digest — ${critical.length} critical, ${medium.length} caution`;
    const safetyScore = Math.max(
      0,
      100 - critical.length * 12 - medium.length * 5,
    );

    const text = `Aegis ${periodLabel} digest

Safety score: ${safetyScore}/100
Critical events: ${critical.length}
Caution events: ${medium.length}
Messages analyzed: ${msgCount ?? 0}

Top risk categories:
${topCats.map(([c, n]) => `  • ${CATEGORY_LABELS[c] ?? c} — ${n}`).join("\n") || "  (none)"}

Open the dashboard for full context.`;

    const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0a1f5c,#0d3b80,#1a8a7a);padding:24px;color:#fff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Aegis · ${periodLabel} digest</div>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;">Safety score ${safetyScore}/100</h1>
      <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">${critical.length} critical, ${medium.length} caution events in the last ${period === "weekly" ? "7 days" : "24 hours"}.</p>
    </div>
    <div style="padding:24px;color:#1a1f36;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:12px;background:#fef2f2;border-radius:8px;">
            <div style="font-size:11px;color:#991b1b;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Critical</div>
            <div style="font-size:24px;font-weight:700;color:#991b1b;margin-top:4px;">${critical.length}</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#fffbeb;border-radius:8px;">
            <div style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Caution</div>
            <div style="font-size:24px;font-weight:700;color:#92400e;margin-top:4px;">${medium.length}</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f0fdf4;border-radius:8px;">
            <div style="font-size:11px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Messages</div>
            <div style="font-size:24px;font-weight:700;color:#166534;margin-top:4px;">${msgCount ?? 0}</div>
          </td>
        </tr>
      </table>
      <h3 style="margin:16px 0 8px;font-size:14px;">Top risk categories</h3>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#374151;">
        ${topCats.map(([c, n]) => `<li><strong>${CATEGORY_LABELS[c] ?? c}</strong> — ${n} event${n > 1 ? "s" : ""}</li>`).join("") || "<li style=\"list-style:none;color:#9ca3af;\">No risk categories detected.</li>"}
      </ul>
      ${
        critical.length > 0
          ? `<div style="margin-top:16px;padding:12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;font-size:13px;color:#991b1b;"><strong>Action recommended.</strong> Review the critical events on your dashboard.</div>`
          : `<div style="margin-top:16px;padding:12px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:13px;color:#166534;"><strong>Good news.</strong> No critical events in this period.</div>`
      }
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">Aegis · privacy-first child safety. Raw chat content is never included in this email.</p>
    </div>
  </div>
</body></html>`;

    try {
      await sendEmail(parent.email, subject, html, text);
      return new Response(
        JSON.stringify({ sent: true, period, recipient: parent.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(
        JSON.stringify({
          sent: false,
          period,
          error: msg,
          hint: "Set up the Lovable email domain to enable digests.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    console.error("send-digest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
