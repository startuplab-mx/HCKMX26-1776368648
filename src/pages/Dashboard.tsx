import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  Activity,
  Siren,
  Loader2,
  Send,
  Sparkles,
  Download,
  Mail,
  ShieldCheck,
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
import { AegisHeader } from "@/components/AegisHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

type Contact = {
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
};

const SEVERITY_FILL: Record<Severity, string> = {
  critical: "hsl(var(--severity-critical))",
  medium: "hsl(var(--severity-medium))",
  low: "hsl(var(--severity-low))",
};

// Distinct palette for category mix bars
const CATEGORY_PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--severity-critical))",
  "hsl(var(--severity-medium))",
  "#3B82F6",
  "hsl(var(--severity-low))",
  "#7C3AED",
  "#0EA5E9",
  "#9333EA",
  "#F43F5E",
];

export default function Dashboard() {
  const [events, setEvents] = useState<RiskRow[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firingTest, setFiringTest] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [summaryStats, setSummaryStats] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);

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

  async function sendWeeklyDigest() {
    if (sendingDigest) return;
    setSendingDigest(true);
    const t = toast.loading("Sending weekly digest...");
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-digest?period=weekly",
        { body: {} },
      );
      if (error) throw error;
      if (data?.sent) {
        toast.success("Weekly digest sent", {
          id: t,
          description: `to ${data.recipient}`,
        });
      } else if (data?.skipped) {
        toast.info("Digest skipped", {
          id: t,
          description: "Weekly digest is disabled in parent contact settings.",
        });
      } else if (data?.error) {
        toast.warning("Digest could not be delivered", {
          id: t,
          description: data.hint ?? data.error,
        });
      } else {
        toast.success("Digest dispatched", { id: t });
      }
    } catch (e) {
      toast.error("Digest failed", {
        id: t,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSendingDigest(false);
    }
  }

  async function generateSummary() {
    if (summaryLoading) return;
    setSummaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("executive-summary", {
        body: { period: "weekly" },
      });
      if (error) throw error;
      setSummary(data?.summary ?? "No summary returned.");
      setSummaryStats(data?.stats ?? null);
      setSummaryGeneratedAt(new Date());
    } catch (e) {
      toast.error("Could not generate summary", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSummaryLoading(false);
    }
  }

  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const margin = 48;
      let y = margin;

      // Header bar
      doc.setFillColor(9, 30, 66);
      doc.rect(0, 0, W, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("AEGIS — Executive Summary", margin, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(new Date().toLocaleString(), W - margin, 42, { align: "right" });
      y = 100;

      // KPI strip
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Safety score: ${stats.score}/100`, margin, y);
      doc.text(`Critical: ${stats.critical}`, margin + 180, y);
      doc.text(`Caution: ${stats.medium}`, margin + 290, y);
      doc.text(`Messages: ${messageCount}`, margin + 400, y);
      y += 24;

      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, W - margin, y);
      y += 18;

      // Summary body
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("AI-generated executive summary", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      const cleaned = (summary || "(Summary not yet generated.)").replace(/\*\*(.*?)\*\*/g, "$1");
      const lines = doc.splitTextToSize(cleaned, W - margin * 2);
      for (const ln of lines) {
        if (y > 780) {
          doc.addPage();
          y = margin;
        }
        doc.text(ln, margin, y);
        y += 15;
      }

      // --- Embed rendered charts (Recharts SVG → PNG via html2canvas) ---
      if (chartsRef.current) {
        try {
          const html2canvas = (await import("html2canvas")).default;
          // Wait one tick so Recharts SVG is fully painted
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          const canvas = await html2canvas(chartsRef.current, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            logging: false,
          });
          const imgData = canvas.toDataURL("image/png");
          const maxW = W - margin * 2;
          const ratio = canvas.height / canvas.width;
          const imgH = maxW * ratio;
          if (y + imgH + 40 > 800) { doc.addPage(); y = margin; }
          y += 8;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.text("Risk visualizations", margin, y);
          y += 12;
          doc.addImage(imgData, "PNG", margin, y, maxW, imgH);
          y += imgH + 18;
        } catch (err) {
          console.warn("Chart capture failed:", err);
        }
      }

      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      if (y > 740) { doc.addPage(); y = margin; }
      doc.text("Recent critical events", margin, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const top = recentCritical.slice(0, 6);
      if (top.length === 0) {
        doc.text("None in the selected window.", margin, y);
        y += 14;
      } else {
        for (const e of top) {
          if (y > 770) { doc.addPage(); y = margin; }
          const cat = categoryLabels[e.category] ?? e.category;
          const expl = (e.explanation ?? "").replace(/\s+/g, " ");
          const ln = doc.splitTextToSize(
            `• [${(e.risk_score * 100).toFixed(0)}%] ${cat} — ${expl}`,
            W - margin * 2,
          );
          for (const l of ln) {
            doc.text(l, margin, y);
            y += 13;
          }
          y += 4;
        }
      }

      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text(
        "Privacy-first: this report is built from risk metadata, not raw chat content.",
        margin,
        820,
      );

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      doc.save(`aegis-executive-summary-${stamp}.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExporting(false);
    }
  }

  async function forwardEvent(eventId: string, contact: Contact) {
    setForwarding(eventId);
    const t = toast.loading(`Forwarding to ${contact.label}…`);
    try {
      const { error } = await supabase.functions.invoke("dispatch-critical-alert", {
        body: { risk_event_id: eventId, override_recipient: contact.id },
      });
      if (error) throw error;
      toast.success("Alert forwarded", {
        id: t,
        description: contact.email ?? contact.phone ?? contact.label,
      });
    } catch (e) {
      toast.error("Forward failed", {
        id: t,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setForwarding(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ev }, { count }, { data: cts }] = await Promise.all([
        supabase
          .from("risk_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("parent_contacts")
          .select("id,label,email,phone")
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setEvents((ev as RiskRow[]) ?? []);
      setMessageCount(count ?? 0);
      setContacts((cts as Contact[]) ?? []);
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

    // Per-message timeline: latest 40 events oldest→newest, score in %
    const timeline = events
      .slice(0, 40)
      .slice()
      .reverse()
      .map((e, i) => ({
        idx: i + 1,
        risk: Math.round(Number(e.risk_score) * 100),
        severity: e.severity as Severity,
        category: categoryLabels[e.category] ?? e.category,
        time: new Date(e.created_at).toLocaleTimeString(),
      }));

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

  // Severity-based accents for KPI values
  const scoreTone: "critical" | "medium" | "low" =
    stats.score < 60 ? "critical" : stats.score < 85 ? "medium" : "low";

  return (
    <div className="min-h-screen bg-background">
      <AegisHeader
        module="Dashboard"
        tagline="parent control center"
        links={[
          { label: "Argus", href: "/demo" },
          { label: "Echo", href: "/echo" },
          { label: "Helios", href: "/helios" },
          { label: "Mnemosyne", href: "/mnemosyne" },
          { label: "Hermes", href: "/hermes" },
          { label: "Aletheia", href: "/aletheia" },
        ]}
        showTrust
        showBackHome
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={sendWeeklyDigest}
              disabled={sendingDigest}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              title="Send the weekly digest to the parent on file"
            >
              {sendingDigest ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              {sendingDigest ? "Sending…" : "Weekly digest"}
            </button>
            <button
              onClick={fireTestAlert}
              disabled={firingTest}
              className="inline-flex items-center gap-1.5 rounded-md bg-severity-critical px-3 py-1.5 text-xs font-bold text-severity-critical-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              title="Send a real SMS + email to the parent on file using a synthetic critical event"
            >
              {firingTest ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Siren className="h-3 w-3" />
              )}
              {firingTest ? "Dispatching..." : "Fire test alert"}
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        {/* Hero KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            label="Safety score"
            value={stats.score}
            unit="/100"
            tone={scoreTone}
            valueTone={scoreTone}
            icon={stats.score < 70 ? TrendingDown : TrendingUp}
            hint="Lower means more recent risk."
          />
          <KpiCard
            label="Critical alerts"
            value={stats.critical}
            tone="critical"
            valueTone={stats.critical > 0 ? "critical" : "neutral"}
            icon={AlertTriangle}
            hint="Immediate parental attention."
          />
          <KpiCard
            label="Caution events"
            value={stats.medium}
            tone="medium"
            valueTone={stats.medium > 0 ? "medium" : "neutral"}
            icon={Activity}
            hint="Worth a calm conversation."
          />
          <KpiCard
            label="Messages analyzed"
            value={messageCount}
            tone="neutral"
            valueTone="neutral"
            icon={MessageSquare}
            hint={`${stats.total} risk events processed.`}
          />
        </div>

        {/* Charts row */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ChartCard
            title="Risk timeline"
            subtitle="Severity-weighted, message by message"
          >
            {stats.timeline.length === 0 ? (
              <EmptyChart text="No events yet — run a scenario in the demo." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.timeline}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="idx"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, p: any) => [
                      `${v}% · ${p?.payload?.severity ?? ""}`,
                      p?.payload?.category ?? "risk",
                    ]}
                    labelFormatter={(idx) => `event #${idx}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    dot={(props: any) => {
                      const sev: Severity = props.payload?.severity ?? "low";
                      return (
                        <circle
                          key={`pt-${props.index}`}
                          cx={props.cx}
                          cy={props.cy}
                          r={4.5}
                          fill={SEVERITY_FILL[sev]}
                          stroke="hsl(var(--card))"
                          strokeWidth={1.5}
                        />
                      );
                    }}
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
                    {stats.categoryData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}
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
          <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
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
              {recentCritical.map((e) => {
                const pct = Math.round(e.risk_score * 100);
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-severity-critical">
                          {pct}%
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={forwarding === e.id || contacts.length === 0}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                            >
                              {forwarding === e.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              Forward
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>
                              Forward redacted alert to…
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {contacts.length === 0 && (
                              <DropdownMenuItem disabled>
                                No trusted contacts configured
                              </DropdownMenuItem>
                            )}
                            {contacts.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onSelect={(ev) => {
                                  ev.preventDefault();
                                  forwardEvent(e.id, c);
                                }}
                                className="cursor-pointer"
                              >
                                <Send className="mr-2 h-3.5 w-3.5 text-primary" />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold">
                                    {c.label}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {c.email ?? c.phone ?? "no contact info"}
                                  </div>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Executive Summary */}
        <section
          ref={summaryRef}
          className="mt-6 rounded-2xl border border-border bg-card shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  AI-generated · weekly
                </p>
                <p className="font-display text-lg font-semibold">
                  Executive summary
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generateSummary}
                disabled={summaryLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
              >
                {summaryLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {summary ? "Regenerate" : "Generate summary"}
              </button>
              <button
                onClick={exportPdf}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Export PDF
              </button>
            </div>
          </div>

          <div className="p-5">
            {summaryLoading && !summary ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Crafting your summary…
              </div>
            ) : summary ? (
              <>
                <div className="prose prose-sm max-w-none text-foreground">
                  {renderInlineMarkdown(summary)}
                </div>

                {summaryStats && (
                  <div ref={chartsRef} className="mt-6 grid gap-4 lg:grid-cols-2 bg-background p-2 rounded-xl">
                    {/* Severity timeline */}
                    <div className="rounded-xl border border-border bg-background/50 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Severity timeline
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {summaryStats.period === "weekly" ? "Last 7 days" : "Last 24h"}
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={summaryStats.timeline ?? []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={10}
                            tickFormatter={(v) => String(v).slice(5)}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              fontSize: 12,
                            }}
                          />
                          <Line type="monotone" dataKey="critical" stroke="hsl(var(--severity-critical))" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="medium" stroke="hsl(var(--severity-medium))" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="low" stroke="hsl(var(--severity-low))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Category breakdown */}
                    <div className="rounded-xl border border-border bg-background/50 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Top risk categories
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(summaryStats.categoryBreakdown ?? []).length} categories
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={summaryStats.categoryBreakdown ?? []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="label"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={10}
                            width={120}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {(summaryStats.categoryBreakdown ?? []).map((_: any, i: number) => (
                              <Cell key={i} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {summaryGeneratedAt && (
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Generated {summaryGeneratedAt.toLocaleString()} · privacy-first (no raw chat content used).
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <ShieldCheck className="h-9 w-9 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Click <strong>Generate summary</strong> to get an AI-written executive
                  briefing of the past week.
                </p>
              </div>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Privacy-first: analytics are computed from risk metadata, not raw chat content.
        </p>
      </main>
    </div>
  );
}

// Tiny markdown renderer: paragraphs, **bold**, and bullet lines starting with "- " or "•"
function renderInlineMarkdown(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);
    const isList = lines.every((l) => /^\s*([-•*])\s+/.test(l));
    if (isList && lines.length > 0) {
      return (
        <ul key={bi} className="my-2 list-disc space-y-1 pl-5">
          {lines.map((l, i) => (
            <li key={i}>{renderBold(l.replace(/^\s*[-•*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={bi} className="my-2 leading-relaxed">
        {lines.map((l, i) => (
          <span key={i}>
            {renderBold(l)}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

function renderBold(s: string) {
  const parts = s.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function KpiCard({
  label,
  value,
  unit,
  tone,
  valueTone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone: "critical" | "medium" | "low" | "neutral";
  valueTone: "critical" | "medium" | "low" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  const iconClasses = {
    critical: "text-severity-critical bg-severity-critical/10",
    medium: "text-severity-medium bg-severity-medium/10",
    low: "text-severity-low bg-severity-low/10",
    neutral: "text-muted-foreground bg-muted",
  }[tone];

  const valueClass = {
    critical: "text-severity-critical",
    medium: "text-severity-medium",
    low: "text-severity-low",
    neutral: "text-foreground",
  }[valueTone];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClasses}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-3 font-display text-3xl font-bold ${valueClass}`}>
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
