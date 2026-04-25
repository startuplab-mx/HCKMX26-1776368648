import { Severity, severityCopy } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const styles: Record<Severity, string> = {
    low: "bg-severity-low/15 text-severity-low border-severity-low/30",
    medium: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
    critical:
      "bg-severity-critical text-severity-critical-foreground border-severity-critical animate-pulse-alert",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
        styles[severity],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          severity === "critical"
            ? "bg-severity-critical-foreground"
            : severity === "medium"
              ? "bg-severity-medium"
              : "bg-severity-low",
        )}
      />
      {severityCopy[severity].label}
    </span>
  );
}
