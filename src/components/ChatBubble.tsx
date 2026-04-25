import { cn } from "@/lib/utils";

export function ChatBubble({
  sender,
  content,
  riskScore,
}: {
  sender: "minor" | "stranger";
  content: string;
  riskScore?: number;
}) {
  const isMinor = sender === "minor";
  const danger = (riskScore ?? 0) >= 0.4;
  const critical = (riskScore ?? 0) >= 0.7;
  return (
    <div
      className={cn(
        "flex w-full animate-fade-in-up",
        isMinor ? "justify-end" : "justify-start",
      )}
    >
      <div className={cn("flex max-w-[78%] flex-col gap-1", isMinor && "items-end")}>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {isMinor ? "Minor" : "Stranger"}
        </span>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-card border",
            isMinor
              ? "bg-minor-bubble text-minor-bubble-foreground border-primary/10 rounded-br-sm"
              : "bg-stranger-bubble text-stranger-bubble-foreground border-border rounded-bl-sm",
            critical && "ring-2 ring-severity-critical/60",
            danger && !critical && "ring-2 ring-severity-medium/60",
          )}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
