import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  ArrowLeft,
  Network,
  Lock,
  Radio,
  Globe2,
  Zap,
  Eye,
  EyeOff,
  Sparkles,
  TrendingUp,
  Server,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { categoryLabels } from "@/lib/utils";
import { LatamMap } from "@/components/LatamMap";

/**
 * Hermes — federated, privacy-preserving signal network.
 *
 * For the hackathon we *simulate* federated signals: anonymized risk events
 * streaming in from many "child devices" across LATAM. No raw content ever
 * leaves a device — only category + risk score + coarse geo + platform.
 *
 * This proves the architecture without requiring real federated learning.
 */

type Source = "argus" | "echo" | "helios" | "mnemosyne";
type Platform =
  | "whatsapp"
  | "instagram_dm"
  | "tiktok_dm"
  | "roblox_chat"
  | "discord"
  | "fortnite_voice"
  | "snapchat"
  | "free_fire";

type Signal = {
  id: string;
  device_id: string; // anonymous hash
  source: Source;
  platform: Platform;
  category: string;
  risk_score: number;
  region: string; // city/state
  lat: number;
  lng: number;
  ts: number;
};

const SOURCES: Record<Source, { label: string; color: string }> = {
  argus: { label: "Argus · chat", color: "hsl(var(--primary))" },
  echo: { label: "Echo · voice", color: "hsl(var(--accent))" },
  helios: { label: "Helios · screen", color: "hsl(var(--severity-medium))" },
  mnemosyne: {
    label: "Mnemosyne · image",
    color: "hsl(var(--severity-critical))",
  },
};

const PLATFORM_LABEL: Record<Platform, string> = {
  whatsapp: "WhatsApp",
  instagram_dm: "Instagram DM",
  tiktok_dm: "TikTok DM",
  roblox_chat: "Roblox chat",
  discord: "Discord",
  fortnite_voice: "Fortnite voice",
  snapchat: "Snapchat",
  free_fire: "Free Fire",
};

// LATAM hot-spot cities with approx. lat/lng (mapped into a stylized SVG grid)
const REGIONS: { name: string; lat: number; lng: number }[] = [
  { name: "CDMX", lat: 19.43, lng: -99.13 },
  { name: "Guadalajara", lat: 20.67, lng: -103.35 },
  { name: "Monterrey", lat: 25.69, lng: -100.32 },
  { name: "Tijuana", lat: 32.51, lng: -117.04 },
  { name: "Puebla", lat: 19.04, lng: -98.2 },
  { name: "Mérida", lat: 20.97, lng: -89.62 },
  { name: "Cancún", lat: 21.16, lng: -86.85 },
  { name: "Ciudad Juárez", lat: 31.69, lng: -106.42 },
  { name: "Bogotá, CO", lat: 4.71, lng: -74.07 },
  { name: "Lima, PE", lat: -12.04, lng: -77.04 },
  { name: "Buenos Aires, AR", lat: -34.6, lng: -58.38 },
  { name: "Santiago, CL", lat: -33.45, lng: -70.66 },
  { name: "São Paulo, BR", lat: -23.55, lng: -46.63 },
];

const RISK_CATEGORIES = [
  "grooming",
  "sextortion",
  "narco_recruitment",
  "financial_fraud",
  "personal_info_extraction",
  "unsafe_meetup",
  "drugs_alcohol",
  "explicit_imagery",
  "cyberbullying",
] as const;

const PLATFORMS: Platform[] = [
  "whatsapp",
  "instagram_dm",
  "tiktok_dm",
  "roblox_chat",
  "discord",
  "fortnite_voice",
  "snapchat",
  "free_fire",
];

// Weighted picker — some risks are more common per source
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDeviceId() {
  return "dev_" + Math.random().toString(36).slice(2, 10);
}

function generateSignal(): Signal {
  const source = pick(["argus", "echo", "helios", "mnemosyne"] as Source[]);
  const region = pick(REGIONS);
  // Source-specific category weighting
  let category: string;
  if (source === "echo") {
    category = pick(["grooming", "narco_recruitment", "unsafe_meetup"]);
  } else if (source === "mnemosyne") {
    category = pick(["sextortion", "explicit_imagery"]);
  } else if (source === "helios") {
    category = pick([
      "drugs_alcohol",
      "cyberbullying",
      "financial_fraud",
      "grooming",
    ]);
  } else {
    category = pick(RISK_CATEGORIES);
  }
  const risk = 0.45 + Math.random() * 0.55;
  return {
    id: crypto.randomUUID(),
    device_id: randomDeviceId(),
    source,
    platform: pick(PLATFORMS),
    category,
    risk_score: Number(risk.toFixed(2)),
    region: region.name,
    lat: region.lat,
    lng: region.lng,
    ts: Date.now(),
  };
}

// Project lat/lng to SVG viewBox (covering LATAM roughly)
const MAP_BOX = { w: 600, h: 480 };
const LAT_RANGE: [number, number] = [-40, 35]; // S to N
const LNG_RANGE: [number, number] = [-120, -40]; // W to E

function projectXY(lat: number, lng: number) {
  const x =
    ((lng - LNG_RANGE[0]) / (LNG_RANGE[1] - LNG_RANGE[0])) * MAP_BOX.w;
  const y =
    MAP_BOX.h -
    ((lat - LAT_RANGE[0]) / (LAT_RANGE[1] - LAT_RANGE[0])) * MAP_BOX.h;
  return { x, y };
}

export default function Hermes() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [paused, setPaused] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [selected, setSelected] = useState<Signal | null>(null);
  const seedRef = useRef(false);

  // Seed with some initial signals so the map isn't empty
  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    const seed: Signal[] = [];
    for (let i = 0; i < 14; i++) seed.push(generateSignal());
    setSignals(seed);
  }, []);

  // Stream new signals
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setSignals((prev) => [generateSignal(), ...prev].slice(0, 80));
    }, 1400);
    return () => clearInterval(t);
  }, [paused]);

  const stats = useMemo(() => {
    const total = signals.length;
    const critical = signals.filter((s) => s.risk_score >= 0.7).length;
    const bySource = new Map<Source, number>();
    const byCategory = new Map<string, number>();
    const byPlatform = new Map<Platform, number>();
    const byRegion = new Map<string, number>();
    for (const s of signals) {
      bySource.set(s.source, (bySource.get(s.source) ?? 0) + 1);
      byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
      byPlatform.set(s.platform, (byPlatform.get(s.platform) ?? 0) + 1);
      byRegion.set(s.region, (byRegion.get(s.region) ?? 0) + 1);
    }
    const topCategory = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topPlatform = Array.from(byPlatform.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const topRegion = Array.from(byRegion.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return {
      total,
      critical,
      bySource,
      topCategory,
      topPlatform,
      topRegion,
    };
  }, [signals]);

  // Aggregate per-region intensity for map heat
  const regionHeat = useMemo(() => {
    const m = new Map<string, { count: number; lat: number; lng: number }>();
    for (const s of signals) {
      const cur = m.get(s.region) ?? { count: 0, lat: s.lat, lng: s.lng };
      cur.count += 1;
      m.set(s.region, cur);
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }));
  }, [signals]);

  const recent = signals.slice(0, 12);

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
                Hermes · federated signals
              </p>
            </div>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        {/* Hero strip */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elevated">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_15%_20%,hsl(168_76%_50%/0.4),transparent_55%),radial-gradient(circle_at_85%_70%,hsl(222_90%_55%/0.5),transparent_55%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                Live federated stream
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
                Every device makes the network smarter.
              </h1>
              <p className="mt-3 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
                Hermes aggregates anonymized risk signals from Argus, Echo,
                Helios and Mnemosyne running on each child's device. Raw
                conversations never leave the phone — only{" "}
                <strong>category, score and coarse region</strong>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPaused((p) => !p)}
                className="flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-xs font-semibold backdrop-blur transition hover:bg-primary-foreground/25"
              >
                <Radio className={`h-3.5 w-3.5 ${paused ? "" : "animate-pulse"}`} />
                {paused ? "Resume stream" : "Pause stream"}
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat
              icon={Globe2}
              k={signals.length.toString()}
              v="signals on map"
            />
            <HeroStat
              icon={Zap}
              k={stats.critical.toString()}
              v="high-risk pings"
            />
            <HeroStat
              icon={Lock}
              k="0 KB"
              v="raw content shared"
            />
            <HeroStat
              icon={ShieldCheck}
              k={regionHeat.length.toString()}
              v="active regions"
            />
          </div>
        </section>

        {/* Map + Live feed */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Panel
            title="Anonymized signal map · LATAM"
            subtitle="Real OpenStreetMap tiles. Each ping is a flagged event from a child's device. No identities, no content."
            icon={Globe2}
          >
            <LatamMap signals={signals} heat={regionHeat} onSelect={(s) => setSelected(s as Signal)} />
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3">
              {(Object.entries(SOURCES) as [Source, typeof SOURCES.argus][]).map(
                ([key, v]) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: v.color }}
                    />
                    {v.label}
                    <span className="font-mono text-[10px] opacity-60">
                      ({stats.bySource.get(key) ?? 0})
                    </span>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <Panel
            title="Live signal feed"
            subtitle="Streaming in real time from simulated devices."
            icon={Radio}
            headerRight={
              <span className="rounded-full bg-severity-low/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-severity-low">
                {paused ? "Paused" : "Live"}
              </span>
            }
          >
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {recent.map((s) => (
                <li
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background/60 p-2.5 transition hover:border-primary/40 hover:bg-card"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SOURCES[s.source].color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold">
                        {categoryLabels[s.category] ?? s.category}
                      </span>
                      <span className="rounded-sm bg-muted px-1 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
                        {PLATFORM_LABEL[s.platform]}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {s.region} · {s.device_id}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums " +
                      (s.risk_score >= 0.7
                        ? "bg-severity-critical/15 text-severity-critical"
                        : "bg-severity-medium/15 text-severity-medium")
                    }
                  >
                    {s.risk_score.toFixed(2)}
                  </span>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  Waiting for signals...
                </li>
              )}
            </ul>
          </Panel>
        </div>

        {/* Privacy proof + Aggregates */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Panel
            title="What leaves the device?"
            subtitle="The exact JSON payload — privacy is verifiable, not just promised."
            icon={Lock}
            headerRight={
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {showRaw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showRaw ? "Hide" : "Show"} payload
              </button>
            }
          >
            <pre className="max-h-[280px] overflow-auto rounded-xl bg-foreground/95 p-4 font-mono text-[11px] leading-relaxed text-background">
{showRaw && selected
  ? JSON.stringify(
      {
        device_id: selected.device_id,
        source: selected.source,
        platform: selected.platform,
        category: selected.category,
        risk_score: selected.risk_score,
        region_coarse: selected.region,
        ts: new Date(selected.ts).toISOString(),
        content_stored: false,
        message_text: null,
        sender_handle: null,
      },
      null,
      2,
    )
  : `{
  "device_id": "dev_a8f3b2c1",     // anonymous, rotating
  "source": "argus",                // which detector
  "platform": "instagram_dm",       // app type, not account
  "category": "grooming",
  "risk_score": 0.87,
  "region_coarse": "CDMX",          // city, never GPS
  "ts": "2026-04-25T14:21:09Z",
  "content_stored": false,          // ✅ never
  "message_text": null,             // ✅ never
  "sender_handle": null             // ✅ never
}`}
            </pre>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { icon: Lock, label: "On-device inference" },
                { icon: ShieldCheck, label: "k-anon ≥ 50" },
                { icon: Sparkles, label: "Diff. privacy noise" },
              ].map((g) => (
                <div
                  key={g.label}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background/60 p-2 text-center"
                >
                  <g.icon className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-semibold leading-tight">
                    {g.label}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Aggregate threat intelligence"
            subtitle="What the network is learning right now."
            icon={TrendingUp}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <AggregateList
                title="Top categories"
                items={stats.topCategory.map(([k, v]) => ({
                  label: categoryLabels[k] ?? k,
                  value: v,
                }))}
                tone="critical"
              />
              <AggregateList
                title="Top platforms"
                items={stats.topPlatform.map(([k, v]) => ({
                  label: PLATFORM_LABEL[k],
                  value: v,
                }))}
                tone="medium"
              />
              <AggregateList
                title="Hottest regions"
                items={stats.topRegion.map(([k, v]) => ({
                  label: k,
                  value: v,
                }))}
                tone="low"
              />
            </div>
          </Panel>
        </div>

        {/* Architecture / future */}
        <Panel
          className="mt-6"
          title="Roadmap → true federated learning"
          subtitle="Hackathon: simulated signals. Production: on-device model updates with secure aggregation."
          icon={Network}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <ArchStep
              icon={Smartphone}
              step="1"
              title="On-device classifiers"
              desc="Argus, Echo, Helios and Mnemosyne run lightweight models locally. Raw conversations never leave the phone."
              status="Today"
            />
            <ArchStep
              icon={Radio}
              step="2"
              title="Anonymized signal upload"
              desc="Only category + score + coarse region + platform are emitted, batched and noised before transit."
              status="Today (simulated)"
            />
            <ArchStep
              icon={Server}
              step="3"
              title="Secure aggregation"
              desc="Federated averaging combines gradients across thousands of devices to retrain without ever seeing one child's data."
              status="Future"
            />
          </div>
        </Panel>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Hermes is the network effect. Every flagged grooming attempt in Cancún
          makes the model in Monterrey safer — without anyone reading a single
          message.
        </p>
      </main>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  k,
  v,
}: {
  icon: React.ComponentType<{ className?: string }>;
  k: string;
  v: string;
}) {
  return (
    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 backdrop-blur">
      <div className="flex items-center gap-2 text-primary-foreground/70">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-semibold uppercase tracking-widest">
          {v}
        </p>
      </div>
      <p className="mt-1 font-display text-2xl font-bold">{k}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  headerRight,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-base font-semibold">{title}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function AggregateList({
  title,
  items,
  tone,
}: {
  title: string;
  items: { label: string; value: number }[];
  tone: "critical" | "medium" | "low";
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const barClass = {
    critical: "bg-severity-critical/70",
    medium: "bg-severity-medium/70",
    low: "bg-severity-low/70",
  }[tone];
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">No data yet.</li>
        )}
        {items.map((i) => (
          <li key={i.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">{i.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {i.value}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barClass} transition-all`}
                style={{ width: `${(i.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchStep({
  icon: Icon,
  step,
  title,
  desc,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  step: string;
  title: string;
  desc: string;
  status: string;
}) {
  const isFuture = status === "Future";
  return (
    <div className="relative rounded-xl border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-shield text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest " +
            (isFuture
              ? "bg-muted text-muted-foreground"
              : "bg-severity-low/15 text-severity-low")
          }
        >
          {status}
        </span>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">Step {step}</p>
      <p className="mt-0.5 font-display text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}
