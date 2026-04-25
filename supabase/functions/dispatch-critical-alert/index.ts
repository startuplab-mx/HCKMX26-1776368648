// Dispatches an email + SMS to the parent for a critical risk event.
// Triggered by a database trigger on insert into risk_events (severity = 'critical').
// Idempotent: skips if an alert was already sent for the given risk_event_id + channel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? ""; // optional override

const CATEGORY_LABELS: Record<string, string> = {
  grooming: "Grooming",
  sexual_harassment: "Sexual harassment",
  pedophilia_risk: "Pedophilia risk",
  narco_recruitment: "Narco recruitment",
  financial_fraud: "Financial fraud",
  personal_info_extraction: "Personal info extraction",
  sextortion: "Sextortion",
  cyberbullying: "Cyberbullying",
  unsafe_meetup: "Unsafe meetup",
  drugs_alcohol: "Drugs & alcohol",
  explicit_imagery: "Explicit imagery",
  minor_explicit_risk: "Minor in explicit context",
  identifying_info_visible: "Identifying info visible",
};

function categoryLabel(c: string) {
  return CATEGORY_LABELS[c] ?? c;
}

async function sendSms(to: string, body: string) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const twilioKey = Deno.env.get("TWILIO_API_KEY");
  if (!lovableKey || !twilioKey) {
    throw new Error("Twilio credentials not configured (LOVABLE_API_KEY / TWILIO_API_KEY).");
  }
  // Twilio requires a 'From' number. We try TWILIO_FROM_NUMBER first, then
  // fall back to fetching the first available IncomingPhoneNumber on the account.
  let from = TWILIO_FROM;
  if (!from) {
    const listRes = await fetch(`${TWILIO_GATEWAY}/IncomingPhoneNumbers.json?PageSize=1`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
      },
    });
    const listData = await listRes.json();
    if (!listRes.ok) {
      throw new Error(`Twilio list numbers failed [${listRes.status}]: ${JSON.stringify(listData)}`);
    }
    from = listData.incoming_phone_numbers?.[0]?.phone_number ?? "";
    if (!from) {
      throw new Error("No Twilio phone number available on the account. Buy one in Twilio console or set TWILIO_FROM_NUMBER.");
    }
  }
  const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Twilio send failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return { sid: data.sid, from };
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  // Try Lovable's transactional email function. If it isn't deployed yet
  // (user hasn't finished email domain setup), this will return an error
  // and we record it as 'skipped' rather than 'failed'.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateName: "critical-alert",
      recipientEmail: to,
      idempotencyKey: `critical-${subject}-${to}-${Date.now()}`,
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
    const { risk_event_id, test } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Test mode: send to whatever parent is on file with a synthetic event.
    let event: any;
    if (test) {
      const { data: anyEvent } = await supabase
        .from("risk_events")
        .select("*")
        .eq("severity", "critical")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      event = anyEvent ?? {
        id: "00000000-0000-0000-0000-000000000000",
        category: "grooming",
        severity: "critical",
        risk_score: 0.92,
        explanation:
          "TEST ALERT — this is a synthetic critical event triggered from the dashboard.",
        recommended_action:
          "Review the conversation with your child and consider blocking the contact.",
        created_at: new Date().toISOString(),
      };
    } else {
      if (!risk_event_id) {
        return new Response(JSON.stringify({ error: "risk_event_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("risk_events")
        .select("*")
        .eq("id", risk_event_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      event = data;
    }

    if (event.severity !== "critical") {
      return new Response(JSON.stringify({ skipped: "not critical" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch parent contact
    const { data: parents } = await supabase
      .from("parent_contacts")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1);
    const parent = parents?.[0];
    if (!parent) {
      return new Response(JSON.stringify({ error: "no parent_contacts row" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // De-dup: skip if already alerted on this event for this channel
    const { data: existing } = await supabase
      .from("alert_dispatches")
      .select("channel,status")
      .eq("risk_event_id", event.id);
    const sentChannels = new Set(
      (existing ?? []).filter((d) => d.status === "sent").map((d) => d.channel),
    );

    const cat = categoryLabel(event.category);
    const score = Math.round(Number(event.risk_score) * 100);
    const subject = `[Aegis · CRITICAL] ${cat} detected (${score}/100)`;
    const text = `Aegis has detected a CRITICAL risk event.

Category: ${cat}
Risk score: ${score}/100
Detected at: ${new Date(event.created_at).toLocaleString()}

Why it's flagged:
${event.explanation ?? "—"}

Recommended action:
${event.recommended_action ?? "Review the conversation with your child immediately."}

Open the Aegis dashboard for full context.`;

    const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f4f6f9; padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0a1f5c,#0d3b80,#1a8a7a);padding:24px;color:#fff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Aegis · Critical alert</div>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;">${cat} detected</h1>
      <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Risk score ${score}/100 — immediate parental attention recommended.</p>
    </div>
    <div style="padding:24px;color:#1a1f36;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;"><strong>Why it's flagged</strong><br/>${event.explanation ?? "—"}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;"><strong>Recommended action</strong><br/>${event.recommended_action ?? "Review the conversation with your child immediately."}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Detected ${new Date(event.created_at).toLocaleString()} · Aegis routes raw content nowhere — only the metadata above leaves the device.</p>
    </div>
  </div>
</body></html>`;

    const sms = `🚨 Aegis: ${cat} detected for your child (${score}/100). ${event.recommended_action ?? "Review the chat now."} Open the dashboard for context.`;

    const results: any = { event_id: event.id, email: null, sms: null };

    // Email
    if (parent.email_critical && parent.email && !sentChannels.has("email")) {
      try {
        const r = await sendEmail(parent.email, subject, html, text);
        results.email = { status: "sent", recipient: parent.email, response: r };
        await supabase.from("alert_dispatches").insert({
          risk_event_id: event.id,
          channel: "email",
          recipient: parent.email,
          status: "sent",
          payload: { subject },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.email = { status: "skipped", recipient: parent.email, error: msg };
        await supabase.from("alert_dispatches").insert({
          risk_event_id: event.id,
          channel: "email",
          recipient: parent.email,
          status: "skipped",
          error: msg,
          payload: { subject },
        });
      }
    } else if (sentChannels.has("email")) {
      results.email = { status: "duplicate" };
    }

    // SMS
    if (parent.sms_critical && parent.phone && !sentChannels.has("sms")) {
      try {
        const r = await sendSms(parent.phone, sms);
        results.sms = { status: "sent", recipient: parent.phone, sid: r.sid, from: r.from };
        await supabase.from("alert_dispatches").insert({
          risk_event_id: event.id,
          channel: "sms",
          recipient: parent.phone,
          status: "sent",
          payload: { sid: r.sid },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.sms = { status: "failed", recipient: parent.phone, error: msg };
        await supabase.from("alert_dispatches").insert({
          risk_event_id: event.id,
          channel: "sms",
          recipient: parent.phone,
          status: "failed",
          error: msg,
          payload: {},
        });
      }
    } else if (sentChannels.has("sms")) {
      results.sms = { status: "duplicate" };
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dispatch-critical-alert error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
