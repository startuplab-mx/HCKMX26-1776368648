import { categoryLabels, type Severity } from "@/lib/utils";
import { SeverityBadge } from "./SeverityBadge";
import { AlertTriangle, ShieldCheck, Activity, Check, Send, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RiskEvent = {
  id: string;
  message_preview: string;
  sender: "minor" | "stranger";
  risk_score: number;
  severity: Severity;
  category: string;
  explanation: string | null;
  recommended_action: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
};

export function AlertCard({
  event,
  acknowledged = false,
  contacts = [],
  onAck,
  onForward,
}: {
  event: RiskEvent;
  acknowledged?: boolean;
  contacts?: Contact[];
  onAck?: (eventId: string) => void;
  onForward?: (eventId: string, contact: Contact) => void;
}) {
  const Icon =
    event.severity === "critical"
      ? AlertTriangle
      : event.severity === "medium"
        ? Activity
        : ShieldCheck;

  return (
    <div
      className={
        "animate-slide-in rounded-xl border bg-card p-4 shadow-card transition-opacity " +
        (acknowledged ? "opacity-60 " : "") +
        (event.severity === "critical"
          ? "border-severity-critical/40 shadow-alert"
          : event.severity === "medium"
            ? "border-severity-medium/40"
            : "border-border")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={
              "flex h-8 w-8 items-center justify-center rounded-lg " +
              (event.severity === "critical"
                ? "bg-severity-critical/15 text-severity-critical"
                : event.severity === "medium"
                  ? "bg-severity-medium/15 text-severity-medium"
                  : "bg-severity-low/15 text-severity-low")
            }
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              {categoryLabels[event.category] ?? event.category}
            </p>
            <p className="text-[11px] text-muted-foreground">
              from {event.sender}
            </p>
          </div>
        </div>
        <SeverityBadge severity={event.severity} />
      </div>

      <p className="mt-3 line-clamp-2 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
        “{event.message_preview}”
      </p>

      {event.explanation && (
        <p className="mt-3 text-sm text-foreground">{event.explanation}</p>
      )}

      {event.recommended_action && event.severity !== "low" && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Recommended action
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {event.recommended_action}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Risk score</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={
                "h-full transition-all " +
                (event.severity === "critical"
                  ? "bg-severity-critical"
                  : event.severity === "medium"
                    ? "bg-severity-medium"
                    : "bg-severity-low")
              }
              style={{ width: `${Math.round(event.risk_score * 100)}%` }}
            />
          </div>
          <span className="font-mono font-semibold text-foreground">
            {(event.risk_score * 100).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Console actions */}
      {(onAck || onForward) && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
          {onForward && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={contacts.length === 0}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                >
                  <Share2 className="h-3 w-3" />
                  Forward
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Forward redacted alert to…</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {contacts.length === 0 && (
                  <DropdownMenuItem disabled>
                    No trusted contacts configured
                  </DropdownMenuItem>
                )}
                {contacts.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      onForward(event.id, c);
                    }}
                    className="cursor-pointer"
                  >
                    <Send className="mr-2 h-3.5 w-3.5 text-primary" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.email ?? c.phone ?? "no contact info"}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onAck && !acknowledged && (
            <button
              onClick={() => onAck(event.id)}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Check className="h-3 w-3" />
              Acknowledge
            </button>
          )}
          {acknowledged && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-severity-low">
              ● acknowledged
            </span>
          )}
        </div>
      )}
    </div>
  );
}
