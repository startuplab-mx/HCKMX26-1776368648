import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatPane } from "@/components/ChatPane";
import { AlertCard, type RiskEvent, type Contact } from "@/components/AlertCard";
import { Shield, Trash2, Activity, MessagesSquare } from "lucide-react";
import type { Severity } from "@/lib/utils";
import { toast } from "sonner";
import { categoryLabels } from "@/lib/utils";
import { AegisHeader } from "@/components/AegisHeader";
import { AegisHero } from "@/components/AegisHero";
import { ScenarioControls } from "@/components/ScenarioControls";

type LocalMessage = {
  id: string;
  sender: "minor" | "stranger";
  content: string;
  risk_score?: number;
};

export default function ChatDemo() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [scenarioBusy, setScenarioBusy] = useState(false);

  // Create a fresh session on mount
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ label: `Demo ${new Date().toLocaleTimeString()}` })
        .select()
        .single();
      if (!error && data) setSessionId(data.id);
    })();
  }, []);

  // Load trusted contacts (used by Forward action)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("parent_contacts")
        .select("id,label,email,phone")
        .order("created_at", { ascending: true });
      if (data) setContacts(data as Contact[]);
    })();
  }, []);

  // Subscribe to risk_events for this session + load any that already exist
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function pushEvent(r: {
      id: string;
      message_id: string | null;
      risk_score: number;
      severity: Severity;
      category: string;
      explanation: string | null;
      recommended_action: string | null;
      created_at: string;
    }) {
      let preview = "";
      let sender: "minor" | "stranger" = "stranger";
      if (r.message_id) {
        const { data: msg } = await supabase
          .from("chat_messages")
          .select("content,sender")
          .eq("id", r.message_id)
          .single();
        preview = msg?.content ?? "";
        sender = (msg?.sender as "minor" | "stranger") ?? "stranger";
      }
      if (cancelled) return;
      const evt: RiskEvent = {
        id: r.id,
        message_preview: preview,
        sender,
        risk_score: Number(r.risk_score),
        severity: r.severity,
        category: r.category,
        explanation: r.explanation,
        recommended_action: r.recommended_action,
        created_at: r.created_at,
      };
      setEvents((prev) => {
        if (prev.some((e) => e.id === evt.id)) return prev;
        return [evt, ...prev];
      });
      if (evt.severity === "critical") {
        toast.error(`Critical: ${categoryLabels[evt.category] ?? evt.category}`, {
          description: evt.explanation ?? "Risk detected in chat.",
        });
      } else if (evt.severity === "medium") {
        toast.warning(`Caution: ${categoryLabels[evt.category] ?? evt.category}`, {
          description: evt.explanation ?? undefined,
        });
      }
    }

    // Initial load (in case events landed before the channel subscribed)
    (async () => {
      const { data } = await supabase
        .from("risk_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      if (data && !cancelled) {
        for (const r of data) {
          await pushEvent({
            id: r.id,
            message_id: r.message_id,
            risk_score: Number(r.risk_score),
            severity: r.severity as Severity,
            category: r.category,
            explanation: r.explanation,
            recommended_action: r.recommended_action,
            created_at: r.created_at,
          });
        }
      }
    })();

    const channel = supabase
      .channel(`risk-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "risk_events",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const r = payload.new as Parameters<typeof pushEvent>[0];
          await pushEvent(r);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const stats = useMemo(() => {
    const critical = events.filter((e) => e.severity === "critical").length;
    const medium = events.filter((e) => e.severity === "medium").length;
    const score = Math.max(0, 100 - critical * 20 - medium * 8);
    return { critical, medium, score };
  }, [events]);

  function addMessage(m: LocalMessage) {
    setMessages((prev) => [...prev, m]);
  }

  // Drives scenarios: insert a stranger message + analyze risk, mirroring ChatPane.send.
  async function sendAsStranger(content: string, _persona?: string) {
    if (!sessionId || !content.trim()) return;
    setScenarioBusy(true);
    try {
      const { data: msgRow, error: msgErr } = await supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, sender: "stranger", content })
        .select()
        .single();
      if (msgErr) throw msgErr;

      const history = messages.slice(-6).map((m) => `${m.sender}: ${m.content}`);
      const { data: risk } = await supabase.functions.invoke("analyze-risk", {
        body: { message: content, history },
      });

      if (risk) {
        await supabase.from("risk_events").insert({
          session_id: sessionId,
          message_id: msgRow.id,
          risk_score: risk.risk_score,
          severity: risk.severity,
          category: risk.category,
          matched_patterns: risk.matched_patterns ?? [],
          explanation: risk.explanation,
          recommended_action: risk.recommended_action,
        });
      }

      addMessage({
        id: msgRow.id,
        sender: "stranger",
        content,
        risk_score: risk?.risk_score,
      });
    } catch (e) {
      console.error("scenario send failed", e);
      toast.error("Scenario step failed");
    } finally {
      setScenarioBusy(false);
    }
  }

  async function reset() {
    setMessages([]);
    setEvents([]);
    setAcked({});
    const { data } = await supabase
      .from("chat_sessions")
      .insert({ label: `Demo ${new Date().toLocaleTimeString()}` })
      .select()
      .single();
    if (data) setSessionId(data.id);
  }

  function handleAck(eventId: string) {
    setAcked((prev) => ({ ...prev, [eventId]: true }));
    toast.success("Alert acknowledged", { duration: 1200 });
  }

  async function handleForward(eventId: string, contact: Contact) {
    const evt = events.find((e) => e.id === eventId);
    if (!evt) return;
    toast.loading(`Forwarding to ${contact.label}…`, { id: `fwd-${eventId}` });
    try {
      const { data, error } = await supabase.functions.invoke(
        "dispatch-critical-alert",
        { body: { risk_event_id: eventId } },
      );
      if (error) throw error;
      const emailStatus = data?.email?.status;
      const smsStatus = data?.sms?.status;
      toast.success(`Forwarded to ${contact.label}`, {
        id: `fwd-${eventId}`,
        description: `email: ${emailStatus ?? "—"} · sms: ${smsStatus ?? "—"}`,
      });
    } catch (e) {
      toast.error("Forward failed", {
        id: `fwd-${eventId}`,
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AegisHeader
        module="Argus"
        tagline="live chat detector"
        links={[
          { label: "Echo", href: "/echo" },
          { label: "Helios", href: "/helios" },
          { label: "Mnemosyne", href: "/mnemosyne" },
          { label: "Hermes", href: "/hermes" },
          { label: "Aletheia", href: "/aletheia" },
          { label: "Dashboard", href: "/dashboard" },
        ]}
        showTrust
        showBackHome
      />

      <AegisHero
        eyebrow="Argus · live chat detector"
        icon={MessagesSquare}
        title="Two strangers, one chat — Aegis flags risk in real time."
        description={
          <>
            Type as either side, or run a one-tap demo scenario. Argus scores
            every message for grooming, sextortion, recruitment and personal-info
            extraction. Parents see <strong>why</strong> a message is risky —
            never the raw conversation.
          </>
        }
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div
              className={
                "group relative flex items-center gap-4 overflow-hidden rounded-lg border-2 px-5 py-3 shadow-card transition-colors " +
                (stats.score < 60
                  ? "border-severity-critical/40 bg-severity-critical/5"
                  : stats.score < 85
                    ? "border-severity-medium/40 bg-severity-medium/5"
                    : "border-severity-low/40 bg-severity-low/5")
              }
            >
              <span
                className={
                  "grid h-10 w-10 place-items-center rounded-md " +
                  (stats.score < 60
                    ? "bg-severity-critical/15 text-severity-critical"
                    : stats.score < 85
                      ? "bg-severity-medium/15 text-severity-medium"
                      : "bg-severity-low/15 text-severity-low")
                }
              >
                <Activity className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <div className="overline" style={{ fontSize: "0.55rem" }}>
                  Safety score
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={
                      "font-display text-3xl font-black tabular-nums tracking-tight " +
                      (stats.score < 60
                        ? "text-severity-critical"
                        : stats.score < 85
                          ? "text-severity-medium"
                          : "text-severity-low")
                    }
                  >
                    {stats.score}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    / 100
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        }
      />

      {/* Main */}
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <div className="mb-4">
          <ScenarioControls
            busy={scenarioBusy}
            onSendStranger={sendAsStranger}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_400px]">
          <div className="h-[68vh] min-h-[520px]">
            <ChatPane
              sender="minor"
              sessionId={sessionId}
              messages={messages}
              onSent={addMessage}
              accent="primary"
            />
          </div>
          <div className="h-[68vh] min-h-[520px]">
            <ChatPane
              sender="stranger"
              sessionId={sessionId}
              messages={messages}
              onSent={addMessage}
              accent="muted"
            />
          </div>

          {/* Aegis Console */}
          <aside className="h-[68vh] min-h-[520px] overflow-hidden rounded-md border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
              <div>
                <p className="overline" style={{ color: "hsl(var(--accent))" }}>
                  Parent view · alerts
                </p>
                <p className="font-display text-base font-bold tracking-tight">
                  Argus Console
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-md bg-severity-critical px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-severity-critical-foreground">
                  {stats.critical} crit
                </span>
                <span className="rounded-md bg-severity-medium px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-severity-medium-foreground">
                  {stats.medium} caution
                </span>
              </div>
            </div>
            <div className="h-[calc(100%-64px)] space-y-3 overflow-y-auto p-4">
              {events.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No risks detected yet.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Pick a scenario above or type from either pane to start.
                  </p>
                </div>
              ) : (
                events.map((e) => (
                  <AlertCard
                    key={e.id}
                    event={e}
                    acknowledged={!!acked[e.id]}
                    contacts={contacts}
                    onAck={handleAck}
                    onForward={handleForward}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      </main>

      <p className="px-6 pb-6 text-center text-xs text-muted-foreground">
        Privacy-first: parents see <strong>why</strong> a message is risky, not the full sensitive content.
      </p>
    </div>
  );
}
