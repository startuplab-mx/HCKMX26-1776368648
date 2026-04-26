import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, RefreshCw, Lightbulb, Eye } from "lucide-react";
import { AegisHeader } from "@/components/AegisHeader";
import {
  buildExposureReport,
  type AletheiaDimension,
  type AletheiaReport,
} from "@/lib/aletheia";

function DimensionCard({ d }: { d: AletheiaDimension }) {
  const trend =
    d.delta_vs_last_week > 0 ? "up" : d.delta_vs_last_week < 0 ? "down" : "flat";
  const trendColor =
    trend === "up" ? "#E11D48" : trend === "down" ? "#10B981" : "#6B7280";
  return (
    <div className="bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-colors rounded-md p-5">
      <div className="flex items-center justify-between mb-3">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: d.color }}
        />
        <span
          className="font-mono text-xs"
          style={{ color: trendColor }}
          title="vs last week"
        >
          {d.delta_vs_last_week > 0 ? "▲" : d.delta_vs_last_week < 0 ? "▼" : "·"}{" "}
          {Math.abs(d.delta_vs_last_week)}%
        </span>
      </div>
      <div className="font-display font-bold text-base tracking-tight text-white">
        {d.label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div
          className="font-display font-black text-3xl tracking-tight"
          style={{ color: d.color }}
        >
          {d.exposure_pct}%
        </div>
        <div className="text-xs text-slate-400 pb-1">
          · {d.minutes_this_week}m
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, d.exposure_pct * 3)}%`,
            background: d.color,
          }}
        />
      </div>
      <p className="mt-3 text-xs text-slate-300 leading-relaxed">
        {d.description}
      </p>
      {d.tips?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {d.tips.map((t, i) => (
            <li
              key={i}
              className="text-[12px] text-slate-200 leading-snug pl-3 relative"
            >
              <span className="absolute left-0 top-1.5 h-1 w-1 rounded-full bg-yellow-400" />
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Aletheia() {
  const [seed, setSeed] = useState(0);
  const [report, setReport] = useState<AletheiaReport | null>(null);

  useEffect(() => {
    setReport(buildExposureReport(`-${seed}`));
  }, [seed]);

  const timelineData = useMemo(
    () => (report?.timeline ?? []).map((row) => ({ ...row })),
    [report],
  );

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      <AegisHeader
        module="Aletheia"
        tagline="algorithmic exposure"
        links={[
          { label: "Argus", href: "/demo" },
          { label: "Echo", href: "/echo" },
          { label: "Helios", href: "/helios" },
          { label: "Mnemosyne", href: "/mnemosyne" },
          { label: "Hermes", href: "/hermes" },
          { label: "Dashboard", href: "/dashboard" },
        ]}
        showTrust
        showBackHome
      />

      <section
        id="aletheia"
        className="bg-[#0A0B0D] text-white border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 mb-10">
            <div className="lg:col-span-8">
              <div className="overline mb-2" style={{ color: "#FACC15" }}>
                aletheia · the truth · for the teen
              </div>
              <h1 className="font-display font-black tracking-tight text-3xl sm:text-4xl lg:text-5xl leading-none">
                This dashboard
                <br />
                is yours
                <span className="text-yellow-400">.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-slate-300 leading-relaxed">
                Your feed isn&apos;t random — it&apos;s trained. Aletheia shows
                you what your algorithm has been showing YOU. Not your parents.
                You decide what to do.
              </p>
              {report?.headline && (
                <div className="mt-6 inline-flex items-start gap-2 rounded-md border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 max-w-xl">
                  <Sparkles
                    size={20}
                    className="text-yellow-400 flex-shrink-0 mt-0.5"
                  />
                  <div className="text-sm">{report.headline}</div>
                </div>
              )}
            </div>
            <div className="lg:col-span-4 flex items-end justify-end gap-2">
              <button
                onClick={() => setSeed((n) => n + 1)}
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw size={16} />
                Re-sample week
              </button>
            </div>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {(report?.dimensions ?? []).map((d) => (
              <DimensionCard key={d.key} d={d} />
            ))}
          </div>

          {/* Timeline + platforms */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white/[0.04] border border-white/10 rounded-md p-6 min-h-[340px]">
              <div className="overline" style={{ color: "#FACC15" }}>
                your week, day by day
              </div>
              <div className="font-display font-bold text-lg tracking-tight">
                Risk-flagged exposure (% of feed)
              </div>
              {timelineData.length === 0 ? (
                <div className="grid place-items-center h-[260px] text-slate-500">
                  Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="day" stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "#0F172A",
                        border: "1px solid #1F2937",
                        borderRadius: 6,
                        color: "#fff",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {(report?.dimensions ?? []).map((d) => (
                      <Line
                        key={d.key}
                        type="monotone"
                        dataKey={d.key}
                        stroke={d.color}
                        strokeWidth={2}
                        dot={false}
                        name={d.label}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white/[0.04] border border-white/10 rounded-md p-6 min-h-[340px]">
              <div className="overline" style={{ color: "#FACC15" }}>
                by platform
              </div>
              <div className="font-display font-bold text-lg tracking-tight mb-4">
                Where the feed comes from
              </div>
              {(report?.platform_split ?? []).length === 0 ? (
                <div className="grid place-items-center h-[200px] text-slate-500">
                  —
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={report?.platform_split ?? []}
                    layout="vertical"
                    margin={{ left: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1F2937"
                      horizontal={false}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="platform"
                      stroke="#E5E7EB"
                      fontSize={12}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0F172A",
                        border: "1px solid #1F2937",
                        borderRadius: 6,
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="share_pct" radius={[0, 4, 4, 0]}>
                      {(report?.platform_split ?? []).map((_, i) => (
                        <Cell
                          key={i}
                          fill={["#FACC15", "#3B82F6", "#10B981"][i % 3]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                  <div className="overline">total risk minutes</div>
                  <div className="font-display font-bold text-xl">
                    {report?.total_risk_minutes ?? "—"}
                  </div>
                </div>
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 flex items-center gap-2">
                  <Eye size={20} className="text-yellow-400" />
                  <div className="text-xs text-slate-300">
                    Private to you. Not shared with parents.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reset algorithm steps */}
          <div className="bg-yellow-400 text-[#091E42] rounded-md p-6">
            <div className="flex items-start gap-3">
              <Lightbulb size={26} className="flex-shrink-0 mt-1 fill-current" />
              <div className="flex-1">
                <div className="overline" style={{ color: "#091E42" }}>
                  reset your algorithm · 4 steps
                </div>
                <div className="font-display font-black text-2xl tracking-tight mt-1">
                  Take back the feed.
                </div>
                <ol className="mt-4 space-y-2 list-decimal list-inside text-sm leading-relaxed">
                  {(report?.reset_steps ?? []).map((s, i) => {
                    // render **bold** segments
                    const parts = s.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <li key={i}>
                        {parts.map((p, j) =>
                          p.startsWith("**") && p.endsWith("**") ? (
                            <strong key={j} className="font-bold">
                              {p.slice(2, -2)}
                            </strong>
                          ) : (
                            <span key={j}>{p}</span>
                          ),
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
