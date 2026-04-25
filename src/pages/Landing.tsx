import { Link } from "react-router-dom";
import { Shield, MessageSquare, Mic, Eye, Network, Image as ImageIcon, ArrowRight, Smartphone } from "lucide-react";

const initiatives = [
  { icon: MessageSquare, title: "Argus", desc: "Live chat risk detection across DMs and game chats.", status: "Live", href: "/demo" },
  { icon: Eye, title: "Helios", desc: "Screen & OCR analysis for closed apps and screenshots.", status: "Beta", href: "/helios" },
  { icon: Mic, title: "Echo", desc: "Voice grooming detection — transcribes calls and flags adult-to-minor patterns.", status: "Beta", href: "/echo" },
  { icon: ImageIcon, title: "Mnemosyne", desc: "Image protection & perceptual hashing to block sextortion content.", status: "Beta", href: "/mnemosyne" },
  { icon: Network, title: "Hermes", desc: "Federated, privacy-preserving signal network across devices.", status: "Beta", href: "/hermes" },
  { icon: Smartphone, title: "Companion", desc: "Mobile capture architecture — Android AccessibilityService + iOS FamilyControls.", status: "Concept", href: "/companion" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-shield text-primary-foreground shadow-elevated">
              <Shield className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold">Aegis</span>
          </div>
          <Link
            to="/demo"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            Try the live demo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,hsl(168_76%_50%/0.4),transparent_50%),radial-gradient(circle_at_80%_60%,hsl(222_90%_55%/0.5),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Hackathon 404 · U.S. Embassy in Mexico
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
              Real-time protection for the conversations parents can't see.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80 sm:text-xl">
              Aegis detects grooming, sextortion, narco recruitment and fraud
              the moment a message lands — across chats, games, screens and voice.
              Built privacy-first so parents see <strong>why</strong>, not the raw
              content.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/demo"
                className="group inline-flex items-center gap-2 rounded-full bg-primary-foreground px-6 py-3 text-base font-semibold text-primary shadow-elevated transition-transform hover:scale-105"
              >
                Launch the live demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/helios"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
              >
                Try Helios (screen analysis)
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-6 max-w-xl">
              {[
                { k: "10+", v: "Risk categories" },
                { k: "<1s", v: "Detection latency" },
                { k: "0", v: "Raw content shared" },
              ].map((s) => (
                <div key={s.v}>
                  <p className="font-display text-3xl font-bold">{s.k}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-primary-foreground/70">
                    {s.v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Initiatives */}
      <section id="initiatives" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            The roadmap
          </p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            One protective stack. Six points of contact.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything routes through the same risk classifier — chats today,
            voice and screens next.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.map((i) => {
            const Card = (
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-shield text-primary-foreground">
                    <i.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest " +
                      (i.status === "Live"
                        ? "bg-severity-low/15 text-severity-low"
                        : i.status === "Beta"
                          ? "bg-accent/15 text-accent"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {i.status}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold">{i.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{i.desc}</p>
                {i.href && (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Open <ArrowRight className="h-3 w-3" />
                  </p>
                )}
              </div>
            );
            return i.href ? (
              <Link key={i.title} to={i.href} className="block">
                {Card}
              </Link>
            ) : (
              <div key={i.title}>{Card}</div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Aegis — built for Hackathon 404. Privacy-by-design parental safety.
      </footer>
    </div>
  );
}
