import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatPane } from "@/components/ChatPane";
import { AlertCard, type RiskEvent } from "@/components/AlertCard";
import { Shield, Trash2, Activity, BarChart3 } from "lucide-react";
import type { Severity } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { categoryLabels } from "@/lib/utils";
import { TrustLayerButton } from "@/components/TrustLayer";

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

  async function reset() {
    setMessages([]);
    setEvents([]);
    const { data } = await supabase
      .from("chat_sessions")
      .insert({ label: `Demo ${new Date().toLocaleTimeString()}` })
      .select()
      .single();
    if (data) setSessionId(data.id);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-shield text-primary-foreground shadow-elevated">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none">
                Aegis
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Argus · Live chat detector
              </p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 rounded-full border border-border bg-card px-4 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3 w-3" />
                Safety score
              </span>
              <span
                className={
                  "font-mono text-base font-bold " +
                  (stats.score < 60
                    ? "text-severity-critical"
                    : stats.score < 85
                      ? "text-severity-medium"
                      : "text-severity-low")
                }
              >
                {stats.score}
              </span>
            </div>
            <Link
              to="/dashboard"
              className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:flex"
            >
              <BarChart3 className="h-3 w-3" />
              Dashboard
            </Link>
            <TrustLayerButton />
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-6 lg:grid-cols-[1fr_1fr_400px] lg:px-6">
        <div className="h-[72vh] min-h-[560px]">
          <ChatPane
            sender="minor"
            sessionId={sessionId}
            messages={messages}
            onSent={addMessage}
            accent="primary"
          />
        </div>
        <div className="h-[72vh] min-h-[560px]">
          <ChatPane
            sender="stranger"
            sessionId={sessionId}
            messages={messages}
            onSent={addMessage}
            accent="muted"
          />
        </div>

        {/* Alerts panel */}
        <aside className="h-[72vh] min-h-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-gradient-hero px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                Parent dashboard
              </p>
              <p className="font-display text-base font-semibold">
                Live alerts
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-severity-critical px-2 py-0.5 text-[10px] font-bold text-severity-critical-foreground">
                {stats.critical} critical
              </span>
              <span className="rounded-full bg-severity-medium px-2 py-0.5 text-[10px] font-bold text-severity-medium-foreground">
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
                  Send a message from either pane to see live analysis.
                </p>
              </div>
            ) : (
              events.map((e) => <AlertCard key={e.id} event={e} />)
            )}
          </div>
        </aside>
      </main>

      <p className="px-6 pb-6 text-center text-xs text-muted-foreground">
        Privacy-first: parents see <strong>why</strong> a message is risky, not the full sensitive content.
      </p>
    </div>
  );
}
