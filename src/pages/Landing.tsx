import { Link } from "react-router-dom";
import {
  Shield,
  ShieldCheck,
  MessageSquare,
  Mic,
  Eye,
  Network,
  ArrowRight,
  Fingerprint,
  Zap,
  BarChart3,
  Lock,
  Sparkles,
} from "lucide-react";
import { AiCostMeter } from "@/components/AiCostMeter";

const PILLARS = [
  { icon: MessageSquare, name: "Argus", note: "Live chat", href: "/demo" },
  { icon: Mic, name: "Echo", note: "Voice", href: "/echo" },
  { icon: Eye, name: "Helios", note: "Screen OCR", href: "/helios" },
  { icon: Fingerprint, name: "Mnemosyne", note: "Image hash", href: "/mnemosyne" },
  { icon: Network, name: "Hermes", note: "Federated", href: "/hermes" },
  { icon: Sparkles, name: "Aletheia", note: "Teen feed truth", href: "/aletheia" },
];

const STATS = [
  { value: "10+", label: "Risk categories" },
  { value: "<1s", label: "Detection latency" },
  { value: "ES + EN", label: "Bilingual engine" },
  { value: "0", label: "Content stored" },
];

type NavItem = { label: string; href: string } | { divider: true };

const NAV: NavItem[] = [
  { label: "Mission", href: "#mission" },
  { label: "Argus", href: "/demo" },
  { label: "Echo", href: "/echo" },
  { label: "Helios", href: "/helios" },
  { label: "Mnemosyne", href: "/mnemosyne" },
  { label: "Hermes", href: "/hermes" },
  { label: "Aletheia", href: "/aletheia" },
  { divider: true },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Companion", href: "/companion" },
];

const MODULES = [
  {
    icon: MessageSquare,
    name: "Argus",
    tagline: "Real-time chat sentinel",
    description:
      "Streams DM and game chat through the bilingual risk classifier. Flags grooming, sextortion, narco recruitment and fraud in <1s.",
    href: "/demo",
    status: "Live",
  },
  {
    icon: Mic,
    name: "Echo",
    tagline: "Voice grooming detection",
    description:
      "Transcribes voice notes and live calls, scoring adult-to-minor patterns, coercion and predator scripts.",
    href: "/echo",
    status: "Live",
  },
  {
    icon: Eye,
    name: "Helios",
    tagline: "Screen & OCR analysis",
    description:
      "Captures closed-app frames and screenshots, extracts text + visual cues, routes them through the same risk classifier.",
    href: "/helios",
    status: "Live",
  },
  {
    icon: Fingerprint,
    name: "Mnemosyne",
    tagline: "Image protection & hashing",
    description:
      "Perceptual hashing (pHash) blocks re-uploaded sextortion media without ever sending raw images off-device.",
    href: "/mnemosyne",
    status: "Live",
  },
  {
    icon: Zap,
    name: "Hermes",
    tagline: "Federated signal network",
    description:
      "Privacy-preserving signal fan-out across devices, schools and tutors. Live MX map of severity heat.",
    href: "/hermes",
    status: "Live",
  },
  {
    icon: Sparkles,
    name: "Aletheia",
    tagline: "Algorithmic exposure for the teen",
    description:
      "The teen-facing truth dashboard. Shows what the algorithm has been feeding YOU across Reels, Shorts and Spotlight — and four steps to retrain it. Private to the teen.",
    href: "/aletheia",
    status: "Live",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============= STICKY HEADER ============= */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
          <Link to="/" className="group flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground transition-colors group-hover:opacity-90">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="font-display text-lg font-black tracking-tight">AEGIS</div>
              <div className="overline" style={{ fontSize: "0.55rem" }}>
                child-safety AI
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {NAV.map((n, i) => {
              if ("divider" in n) {
                return (
                  <span
                    key={`div-${i}`}
                    aria-hidden="true"
                    className="mx-1 h-5 w-[2px] rounded-full bg-foreground/40"
                  />
                );
              }
              return n.href.startsWith("/") ? (
                <Link
                  key={n.href}
                  to={n.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {n.label}
                </Link>
              ) : (
                <a
                  key={n.href}
                  href={n.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {n.label}
                </a>
              );
            })}
          </nav>

          <Link
            to="/demo"
            className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 sm:inline-flex"
          >
            Try the demo
          </Link>
        </div>
      </header>

      <main>
        {/* ============= HERO ============= */}
        <section
          id="mission"
          className="relative overflow-hidden border-b border-border"
        >
          <div className="aegis-grid-bg pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-20 lg:px-12 lg:pt-24 lg:pb-28">
            <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-8">
                <div className="mb-6 flex items-center gap-3">
                  <span className="overline">Hackathon 404 · U.S. Embassy MX</span>
                  <span className="h-px w-10 bg-border" />
                  <span className="overline" style={{ color: "hsl(var(--destructive))" }}>
                    child protection
                  </span>
                </div>

                <h1 className="font-display text-5xl font-black leading-none tracking-tight sm:text-6xl lg:text-[5.5rem]">
                  The shield for
                  <br />
                  the next generation
                  <span className="text-destructive">.</span>
                </h1>

                <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  <strong className="font-semibold text-foreground">Aegis</strong>{" "}
                  detects grooming, narco recruitment, fraud, sextortion and more
                  across the digital surfaces minors actually use — chats, games,
                  voice, and screen. Real-time. Privacy-first. Multilingual.
                </p>

                <div className="mt-10 flex flex-wrap gap-3">
                  <Link
                    to="/demo"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                  >
                    <Shield className="h-4 w-4" />
                    See live detection
                  </Link>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Open analytics →
                  </Link>
                </div>

                <div className="mt-14 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
                  {STATS.map((s) => (
                    <div key={s.label}>
                      <div className="font-display text-2xl font-bold tracking-tight text-primary">
                        {s.value}
                      </div>
                      <div className="overline mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="rounded-md border border-border bg-card p-6 shadow-card">
                  <div className="overline mb-4">The Aegis suite</div>
                  <ul className="space-y-1">
                    {PILLARS.map((p) => {
                      const Icon = p.icon;
                      return (
                        <li key={p.name}>
                          <Link
                            to={p.href}
                            className="flex items-center gap-3 border-b border-border py-3 last:border-b-0 hover:bg-secondary/50"
                          >
                            <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1">
                              <div className="font-display text-sm font-semibold tracking-tight">
                                {p.name}
                              </div>
                              <div className="text-xs text-muted-foreground">{p.note}</div>
                            </div>
                            <span className="overline" style={{ color: "hsl(var(--severity-low))" }}>
                              live
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============= MISSION STRIP ============= */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-3 lg:px-12">
            {[
              {
                icon: Lock,
                title: "Privacy by design",
                body: "Parents see redacted summaries — never raw conversations. Federated-ready architecture, on-device hashing, zero-content storage.",
              },
              {
                icon: BarChart3,
                title: "One classifier, six surfaces",
                body: "Argus, Echo, Helios, Mnemosyne, Hermes and Aletheia all stream through the same bilingual risk engine.",
              },
              {
                icon: ShieldCheck,
                title: "ZeroTrust enforcement",
                body: "Every alert is signed, every recipient verified, every action auditable. Built for parents, schools and embassies.",
              },
            ].map((b) => (
              <div key={b.title}>
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold tracking-tight">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============= MODULES GALLERY (DARK) ============= */}
        <section
          id="modules"
          className="relative overflow-hidden bg-primary text-primary-foreground"
        >
          <div className="aegis-grid-bg-light pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-24">
            <div className="mb-12 grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="overline" style={{ color: "hsl(var(--accent))" }}>
                  the full aegis suite
                </div>
                <h2 className="mt-3 font-display text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  One shield. Six surfaces.
                </h2>
                <p className="mt-4 max-w-2xl leading-relaxed text-primary-foreground/70">
                  Argus, Echo, Mnemosyne, Helios, Hermes and Aletheia ship today.
                  Greek-myth naming. Defense-grade ethos. Privacy-by-design.
                </p>
              </div>
              <div className="flex items-end justify-end lg:col-span-5">
                <div className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/15 px-4 py-2">
                  <Shield className="h-4 w-4 text-accent" />
                  <span className="text-sm">All six modules active</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.name}
                    to={m.href}
                    className="group relative rounded-md border border-accent/30 bg-primary-foreground/5 p-6 transition-colors hover:bg-primary-foreground/10"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-md bg-accent text-primary">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span
                        className="overline"
                        style={{
                          color:
                            m.status === "Live"
                              ? "hsl(var(--severity-low))"
                              : m.status === "Beta"
                                ? "hsl(var(--accent))"
                                : "hsl(var(--muted-foreground))",
                        }}
                      >
                        ● {m.status}
                      </span>
                    </div>
                    <div className="font-display text-2xl font-black tracking-tight">
                      {m.name}
                    </div>
                    <div className="overline mt-1" style={{ color: "hsl(var(--accent))" }}>
                      {m.tagline}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-primary-foreground/70">
                      {m.description}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      Open <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ============= FOOTER ============= */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-black tracking-tight">AEGIS</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              A modular AI shield protecting minors across chats, voice, screens and
              feeds. Built for Hackathon 404.
            </p>
          </div>
          <div>
            <div className="overline mb-3">Mission</div>
            <p className="text-sm text-muted-foreground">
              Detect early. Alert calmly. Never store sensitive content.
            </p>
          </div>
          <div>
            <div className="overline mb-3">Privacy by design</div>
            <p className="text-sm text-muted-foreground">
              Parents see redacted summaries — never raw conversations. Federated-ready
              architecture.
            </p>
          </div>
          <AiCostMeter />
        </div>
        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          © 2026 Aegis · Hackathon 404 — Embajada de EE.UU. en México
        </div>
      </footer>
    </div>
  );
}
