import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  ArrowLeft,
  Activity,
  Siren,
  Loader2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryLabels, type Severity } from "@/lib/utils";
import { SeverityBadge } from "@/components/SeverityBadge";
import { TrustLayerButton } from "@/components/TrustLayer";

type RiskRow = {
  id: string;
  session_id: string;
  risk_score: number;
  severity: Severity;
  category: string;
  explanation: string | null;
  recommended_action: string | null;
  created_at: string;
};

const SEVERITY_FILL: Record<Severity, string> = {
  critical: "hsl(var(--severity-critical))",
  medium: "hsl(var(--severity-medium))",
  low: "hsl(var(--severity-low))",
};

export default function Dashboard() {
  const [events, setEvents] = useState<RiskRow[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firingTest, setFiringTest] = useState(false);

  async function fireTestAlert() {
    if (firingTest) return;
    setFiringTest(true);
    const t = toast.loading("Dispatching critical alert (SMS + email)...");
    try {
      const { data, error } = await supabase.functions.invoke(
        "dispatch-critical-alert",
        { body: { test: true } },
      );
      if (error) throw error;
      const sms = data?.sms;
      const email = data?.email;
      const parts: string[] = [];
      if (sms?.status === "sent") parts.push(`SMS sent → ${sms.recipient}`);
      else if (sms?.status === "failed") parts.push(`SMS failed: ${sms.error?.slice(0, 80) ?? "unknown"}`);
      else if (sms?.status === "duplicate") parts.push("SMS skipped (already sent for this event)");
      if (email?.status === "sent") parts.push(`Email sent → ${email.recipient}`);
      else if (email?.status === "skipped") parts.push("Email skipped (sender domain not yet verified)");
      else if (email?.status === "duplicate") parts.push("Email skipped (already sent)");
      toast.success("Critical alert dispatched", {
        id: t,
        description: parts.join(" · ") || "Check parent inbox / phone.",
      });
    } catch (e) {
      toast.error("Could not dispatch alert", {
        id: t,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setFiringTest(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ev }, { count }] = await Promise.all([
        supabase
          .from("risk_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      setEvents((ev as RiskRow[]) ?? []);
      setMessageCount(count ?? 0);
      setLoading(false);
    })();

    const channel = supabase
      .channel("dash-risk-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "risk_events" },
        (payload) => {
          setEvents((prev) => [payload.new as RiskRow, ...prev].slice(0, 500));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const critical = events.filter((e) => e.severity === "critical").length;
    const medium = events.filter((e) => e.severity === "medium").length;
    const low = events.filter((e) => e.severity === "low").length;
    const score = Math.max(0, 100 - critical * 12 - medium * 5);

    const byCategory = new Map<string, { count: number; critical: number }>();
    for (const e of events) {
      const cur = byCategory.get(e.category) ?? { count: 0, critical: 0 };
      cur.count += 1;
      if (e.severity === "critical") cur.critical += 1;
      byCategory.set(e.category, cur);
    }
    const categoryData = Array.from(byCategory.entries())
      .filter(([cat]) => cat !== "benign")
      .map(([cat, v]) => ({
        name: categoryLabels[cat] ?? cat,
        count: v.count,
        critical: v.critical,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Timeline: bucket by hour for last 24h, fall back to per-event
    const now = Date.now();
    const buckets = new Map<string, number>();
    for (const e of events) {
      const t = new Date(e.created_at);
      const ageH = (now - t.getTime()) / 36e5;
      if (ageH > 24) continue;
      const key = `${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:00`;
      buckets.set(key, (buckets.get(key) ?? 0) + Number(e.risk_score));
    }
    const timeline = Array.from(buckets.entries())
      .map(([time, score]) => ({ time, score: Number(score.toFixed(2)) }))
      .reverse();

    return {
      critical,
      medium,
      low,
      score,
      categoryData,
      timeline,
      total: events.length,
    };
  }, [events]);

  const recentCritical = events.filter((e) => e.severity === "critical").slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-shield text-primary-foreground shadow-elevated">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none">
                Aegis
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Parent dashboard
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={fireTestAlert}
              disabled={firingTest}
              className="flex items-center gap-1.5 rounded-full bg-severity-critical px-3 py-1.5 text-xs font-bold text-severity-critical-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              title="Send a real SMS + email to the parent on file using a synthetic critical event"
            >
              {firingTest ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Siren className="h-3 w-3" />
              )}
              {firingTest ? "Dispatching..." : "Fire test alert"}
            </button>
            <TrustLayerButton />
            <Link
              to="/demo"
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to live demo
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        {/* Hero KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            label="Safety score"
            value={stats.score}
            unit="/100"
            tone={
              stats.score < 60
                ? "critical"
                : stats.score < 85
                  ? "medium"
                  : "low"
            }
            icon={stats.score < 70 ? TrendingDown : TrendingUp}
            hint="Lower means more recent risk."
          />
          <KpiCard
            label="Critical alerts"
            value={stats.critical}
            tone="critical"
            icon={AlertTriangle}
            hint="Immediate parental attention."
          />
          <KpiCard
            label="Caution events"
            value={stats.medium}
            tone="medium"
            icon={Activity}
            hint="Worth a calm conversation."
          />
          <KpiCard
            label="Messages analyzed"
            value={messageCount}
            tone="neutral"
            icon={MessageSquare}
            hint={`${stats.total} risk events processed.`}
          />
        </div>

        {/* Charts row */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ChartCard
            title="Risk pressure (last 24h)"
            subtitle="Sum of risk scores per hour"
          >
            {stats.timeline.length === 0 ? (
              <EmptyChart text="No events in the last 24 hours." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.timeline}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--primary))", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Top risk categories"
            subtitle="What's threatening this child the most"
          >
            {stats.categoryData.length === 0 ? (
              <EmptyChart text="No risk categories yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.categoryData} layout="vertical">
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {stats.categoryData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.critical > 0
                            ? SEVERITY_FILL.critical
                            : SEVERITY_FILL.medium
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Recent critical */}
        <section className="mt-6 rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-gradient-hero px-5 py-4 text-primary-foreground">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                Needs your attention
              </p>
              <p className="font-display text-lg font-semibold">
                Recent critical events
              </p>
            </div>
            <span className="rounded-full bg-severity-critical px-2.5 py-1 text-[11px] font-bold text-severity-critical-foreground">
              {recentCritical.length}
            </span>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading...</p>
          ) : recentCritical.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No critical events. Your child's chats look safe.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentCritical.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={e.severity} />
                      <span className="text-sm font-semibold">
                        {categoryLabels[e.category] ?? e.category}
                      </span>
                    </div>
                    {e.explanation && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {e.explanation}
                      </p>
                    )}
                    {e.recommended_action && (
                      <p className="mt-1 text-xs text-primary">
                        → {e.recommended_action}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Privacy-first: analytics are computed from risk metadata, not raw chat content.
        </p>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone: "critical" | "medium" | "low" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  const toneClasses = {
    critical: "text-severity-critical bg-severity-critical/10",
    medium: "text-severity-medium bg-severity-medium/10",
    low: "text-severity-low bg-severity-low/10",
    neutral: "text-muted-foreground bg-muted",
  }[tone];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4">
        <p className="font-display text-base font-semibold">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
