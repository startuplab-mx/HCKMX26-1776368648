import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatBubble } from "./ChatBubble";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrust } from "./TrustLayer";

type Sender = "minor" | "stranger";

type LocalMessage = {
  id: string;
  sender: Sender;
  content: string;
  risk_score?: number;
};

const PRESETS: Record<Sender, string[]> = {
  stranger: [
    "Hi! How old are you? :)",
    "Don't tell your parents about us, ok?",
    "Send me a pic, just for me",
    "Where do you live? Are you alone right now?",
    "I can pay you, easy money — just deliver a small package",
  ],
  minor: [
    "Hi, I'm 11",
    "Ok... I won't tell",
    "I'm at home alone after school",
  ],
};

export function ChatPane({
  sender,
  sessionId,
  messages,
  onSent,
  accent,
}: {
  sender: Sender;
  sessionId: string | null;
  messages: LocalMessage[];
  onSent: (msg: LocalMessage) => void;
  accent: "primary" | "muted";
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trust = useTrust();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function send(content: string) {
    if (!content.trim() || !sessionId || busy) return;
    setBusy(true);
    setText("");

    // ZeroTrust silent pre-check — no UI alerts, only behavior.
    const decision = trust?.verify();
    if (decision?.delayMs) {
      await new Promise((r) => setTimeout(r, decision.delayMs));
    }
    const shadowBanned = decision?.shadowBan === true;

    try {
      // Insert message — when shadow-banned, we still record locally only.
      let msgRow: { id: string } | null = null;
      if (!shadowBanned) {
        const { data, error: msgErr } = await supabase
          .from("chat_messages")
          .insert({ session_id: sessionId, sender, content })
          .select()
          .single();
        if (msgErr) throw msgErr;
        msgRow = data;
      } else {
        // Local-only echo so the sender thinks it went through (shadow ban).
        msgRow = { id: `shadow-${Date.now()}` };
      }

      // Build short history for the AI
      const history = messages.slice(-6).map((m) => `${m.sender}: ${m.content}`);

      // Analyze (skipped when shadow-banned to avoid noise)
      const risk = shadowBanned
        ? { risk_score: 0, severity: "low", category: "benign", matched_patterns: [], explanation: null, recommended_action: null }
        : (await supabase.functions.invoke("analyze-risk", { body: { message: content, history } })).data;

      // Persist risk event (skip when shadow-banned)
      if (!shadowBanned) {
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

      onSent({
        id: msgRow.id,
        sender,
        content,
        risk_score: risk.risk_score,
      });
    } catch (e) {
      console.error("send failed", e);
    } finally {
      setBusy(false);
    }
  }

  const senderMessages = messages.filter(() => true); // show full convo

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-card shadow-card overflow-hidden",
        accent === "primary"
          ? "border-primary/30"
          : "border-border",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          accent === "primary"
            ? "bg-primary/5 border-primary/20"
            : "bg-muted/40 border-border",
        )}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sending as
          </p>
          <p className="font-display text-lg font-semibold capitalize">
            {sender}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
            accent === "primary"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {sender === "minor" ? "Protected user" : "Unknown contact"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {senderMessages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No messages yet.</p>
            <p className="text-xs">Try one of the suggestions below.</p>
          </div>
        )}
        {senderMessages.map((m) => (
          <ChatBubble
            key={m.id}
            sender={m.sender}
            content={m.content}
            riskScore={m.risk_score}
          />
        ))}
      </div>

      <div className="border-t bg-background/50 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS[sender].map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={busy}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Type as ${sender}...`}
            disabled={busy}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
