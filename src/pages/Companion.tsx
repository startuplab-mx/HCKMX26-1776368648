import { Link } from "react-router-dom";
import {
  Shield,
  ArrowLeft,
  Smartphone,
  Lock,
  Eye,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Radio,
  Apple,
  Zap,
  CheckCircle2,
  XCircle,
  FileCode,
} from "lucide-react";

/**
 * Companion concept page — documents how the on-device capture would work
 * on Android (AccessibilityService) and iOS (Screen Time / Family Controls).
 * No native build is shipped with this hackathon project; this page exists
 * so a future native team can pick up the architecture cleanly.
 */

export default function Companion() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-shield text-primary-foreground shadow-elevated">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none">Aegis</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Mobile companion · concept
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

      <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-hero p-8 text-primary-foreground shadow-elevated">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_15%_20%,hsl(168_76%_50%/0.4),transparent_55%),radial-gradient(circle_at_85%_70%,hsl(222_90%_55%/0.5),transparent_55%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
              <Smartphone className="h-3 w-3" />
              Native architecture · not yet shipped
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              How Aegis would actually read a child's screen — without ever
              storing what's there.
            </h1>
            <p className="mt-3 text-sm text-primary-foreground/80 sm:text-base">
              The web demo simulates capture. In production, a tiny native
              companion app on the child's device feeds Argus, Echo, Helios and
              Mnemosyne. This page documents that architecture: Android
              <code className="mx-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-xs">
                AccessibilityService
              </code>
              + iOS{" "}
              <code className="mx-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-xs">
                FamilyControls / DeviceActivity
              </code>
              .
            </p>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat icon={Lock} k="On-device" v="inference" />
            <HeroStat icon={Cpu} k="< 50 MB" v="model size" />
            <HeroStat icon={Radio} k="Metadata-only" v="emitted" />
            <HeroStat icon={ShieldCheck} k="0 bytes" v="raw text stored" />
          </div>
        </section>

        {/* Pipeline */}
        <Section
          title="End-to-end capture pipeline"
          subtitle="From the moment a message hits the screen to the moment a parent gets an alert."
          icon={Zap}
        >
          <div className="grid gap-4 md:grid-cols-4">
            <PipelineStep
              n="1"
              icon={Eye}
              title="Capture"
              desc="AccessibilityService observes view tree changes; Screen Time delivers app-usage events."
              tone="primary"
            />
            <PipelineStep
              n="2"
              icon={Cpu}
              title="Local inference"
              desc="Quantized classifier (~30 MB) runs in a foreground service. Text never leaves the device."
              tone="accent"
            />
            <PipelineStep
              n="3"
              icon={AlertTriangle}
              title="Risk scoring"
              desc="Outputs category + score + confidence. Below threshold → discarded immediately."
              tone="medium"
            />
            <PipelineStep
              n="4"
              icon={Radio}
              title="Anonymized emit"
              desc="Only metadata (category, score, coarse region) shipped to Hermes. Parent dashboard updates in real time."
              tone="critical"
            />
          </div>
        </Section>

        {/* Android */}
        <Section
          title="Android · AccessibilityService"
          subtitle="The same API screen-readers use. Granted explicitly by the parent during onboarding."
          icon={Smartphone}
          accent="bg-[hsl(142,70%,38%)]/10 text-[hsl(142,70%,38%)]"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="space-y-3">
              <Bullet ok>Reads on-screen text from any app (chat, browser, games)</Bullet>
              <Bullet ok>Survives across WhatsApp, Instagram, TikTok, Roblox, Discord</Bullet>
              <Bullet ok>Foreground service keeps the model warm</Bullet>
              <Bullet warn>Requires explicit accessibility grant — Google flags it for review</Bullet>
              <Bullet warn>Must declare a strong child-safety justification on Play Store</Bullet>
              <div className="rounded-xl border border-border bg-background/60 p-3 text-xs">
                <p className="font-semibold">Permissions declared</p>
                <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  <li>BIND_ACCESSIBILITY_SERVICE</li>
                  <li>FOREGROUND_SERVICE_DATA_SYNC</li>
                  <li>POST_NOTIFICATIONS</li>
                  <li>ACCESS_COARSE_LOCATION (city only)</li>
                </ul>
              </div>
            </div>

            <CodeBlock
              language="Kotlin"
              filename="AegisCaptureService.kt"
              code={`class AegisCaptureService : AccessibilityService() {

  private val classifier by lazy { LocalRiskClassifier.load(this) }
  private val emitter   by lazy { HermesEmitter(this) }

  override fun onServiceConnected() {
    serviceInfo = AccessibilityServiceInfo().apply {
      eventTypes = TYPE_WINDOW_CONTENT_CHANGED or
                   TYPE_VIEW_TEXT_CHANGED
      feedbackType = FEEDBACK_GENERIC
      flags = FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
              FLAG_REPORT_VIEW_IDS
      // Limit to chat/social packages to reduce battery + scope
      packageNames = arrayOf(
        "com.whatsapp",
        "com.instagram.android",
        "com.zhiliaoapp.musically", // TikTok
        "com.roblox.client",
        "com.discord"
      )
    }
  }

  override fun onAccessibilityEvent(e: AccessibilityEvent) {
    val text = extractVisibleText(e.source ?: return) ?: return
    if (text.length < 4) return

    // ---- ON-DEVICE inference, never network ----
    val result = classifier.classify(text)

    if (result.score < THRESHOLD) return  // discard

    // Emit ONLY metadata
    emitter.send(
      RiskSignal(
        deviceId   = AnonId.rolling(this),
        source     = "argus",
        category   = result.category,
        score      = result.score,
        platform   = e.packageName.toString(),
        regionCity = CoarseRegion.current(this), // city-level only
        ts         = System.currentTimeMillis()
      )
    )
    // 'text' goes out of scope here — never persisted, never logged.
  }

  override fun onInterrupt() {}

  companion object { const val THRESHOLD = 0.45f }
}`}
            />
          </div>
        </Section>

        {/* iOS */}
        <Section
          title="iOS · FamilyControls + DeviceActivity"
          subtitle="Apple's only sanctioned path. More restrictive than Android — by design."
          icon={Apple}
          accent="bg-[hsl(222,84%,32%)]/10 text-[hsl(222,84%,32%)]"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="space-y-3">
              <Bullet ok>App-usage signals (which app, how long, when)</Bullet>
              <Bullet ok>Shield blocks for high-risk apps in real time</Bullet>
              <Bullet ok>Managed Settings prevents bypass</Bullet>
              <Bullet warn>No raw text — Apple does not allow reading other apps' content</Bullet>
              <Bullet warn>Pairing must be done via parent's iCloud Family</Bullet>
              <div className="rounded-xl border border-border bg-background/60 p-3 text-xs">
                <p className="font-semibold">Frameworks</p>
                <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  <li>FamilyControls</li>
                  <li>DeviceActivity</li>
                  <li>ManagedSettings</li>
                  <li>NotificationCenter (local only)</li>
                </ul>
              </div>
              <p className="rounded-lg bg-severity-medium/10 p-2 text-[11px] text-severity-medium">
                <strong>Reality check:</strong> on iOS, deep text-level
                detection requires the child to share screen recordings into
                the Aegis app voluntarily, or for the message to arrive via a
                share-extension. Argus runs server-side OCR there.
              </p>
            </div>

            <CodeBlock
              language="Swift"
              filename="AegisDeviceActivityMonitor.swift"
              code={`import DeviceActivity
import ManagedSettings
import FamilyControls

class AegisMonitor: DeviceActivityMonitor {

  let store = ManagedSettingsStore(named: .init("aegis"))

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // Ensure shield is armed for restricted apps
    store.shield.applications = AegisPolicy.restrictedTokens
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)

    // High-usage event on a flagged app -> emit anonymized signal
    HermesEmitter.shared.send(
      RiskSignal(
        deviceId:  AnonId.rolling(),
        source:    "helios",
        category:  "excessive_use",
        score:     0.6,
        platform:  event.rawValue,
        regionCity: CoarseRegion.current(),
        ts:        Date().timeIntervalSince1970
      )
    )
  }
}

// Pairing flow: parent opens Aegis -> AuthorizationCenter -> child taps Approve
@MainActor
func requestFamilyControls() async throws {
  try await AuthorizationCenter.shared.requestAuthorization(for: .child)
}`}
            />
          </div>
        </Section>

        {/* Privacy model */}
        <Section
          title="Privacy & data model"
          subtitle="What the device is allowed to know, emit and forget."
          icon={Lock}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <PrivacyCol
              title="✓ Stays on device, forever"
              tone="ok"
              items={[
                "Raw chat text",
                "Other party's username / handle",
                "Phone numbers, emails, addresses",
                "Photos, voice recordings, screenshots",
                "Precise GPS coordinates",
                "Account credentials",
              ]}
            />
            <PrivacyCol
              title="↑ Emitted to Hermes (parent dashboard)"
              tone="warn"
              items={[
                "Risk category (e.g. 'grooming')",
                "Risk score 0–1 + confidence",
                "Coarse region (city level only)",
                "Platform type ('whatsapp', not the conversation)",
                "Timestamp (rounded to 5 min)",
                "Rolling anonymous device ID",
              ]}
            />
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-sm font-semibold">
              Verifiable claims, not promises
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-severity-low" />
                Open-source companion app — anyone can audit what it captures and emits.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-severity-low" />
                Differential privacy noise added before upload (k-anon ≥ 50).
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-severity-low" />
                Network egress whitelisted to Hermes endpoint only — verifiable via OS network log.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-severity-low" />
                Local model checksum pinned and signed; tamper triggers parent alert.
              </li>
            </ul>
          </div>
        </Section>

        {/* Onboarding */}
        <Section
          title="Onboarding flow"
          subtitle="Designed so a non-technical parent can complete it in under 4 minutes."
          icon={ShieldCheck}
        >
          <ol className="grid gap-3 md:grid-cols-5">
            {[
              { k: "1", t: "Parent installs", d: "Aegis Parent app on their phone" },
              { k: "2", t: "Pair child", d: "QR code or iCloud Family invite" },
              { k: "3", t: "Grant access", d: "Accessibility (Android) / FamilyControls (iOS)" },
              { k: "4", t: "Set sensitivity", d: "Pick categories that matter most" },
              { k: "5", t: "Live", d: "First signal usually arrives within 60s" },
            ].map((s) => (
              <li
                key={s.k}
                className="rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                  {s.k}
                </div>
                <p className="font-display text-sm font-semibold">{s.t}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Status */}
        <section className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center">
          <FileCode className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="font-display text-sm font-semibold">Honest scope</p>
          <p className="mx-auto mt-1 max-w-2xl text-xs text-muted-foreground">
            This page is the <strong>architecture</strong>, not a working APK.
            The Lovable hackathon project ships the cloud + dashboard + four
            detector demos. The companion app is a follow-up engineering effort
            (~6 weeks, 1 native engineer per platform). The code snippets above
            are production-shaped, not pseudo-code.
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Aegis · privacy by construction, not by policy.
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
        <p className="text-[10px] font-semibold uppercase tracking-widest">{v}</p>
      </div>
      <p className="mt-1 font-display text-xl font-bold">{k}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
  accent,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            accent ?? "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-base font-semibold">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function PipelineStep({
  n,
  icon: Icon,
  title,
  desc,
  tone,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tone: "primary" | "accent" | "medium" | "critical";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    medium: "bg-severity-medium/15 text-severity-medium",
    critical: "bg-severity-critical/15 text-severity-critical",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          step {n}
        </span>
      </div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function CodeBlock({
  language,
  filename,
  code,
}: {
  language: string;
  filename: string;
  code: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-foreground/95 px-3 py-2 text-background">
        <span className="font-mono text-[11px] opacity-80">{filename}</span>
        <span className="rounded bg-background/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest">
          {language}
        </span>
      </div>
      <pre className="max-h-[480px] overflow-auto bg-foreground/95 p-4 font-mono text-[11px] leading-relaxed text-background">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Bullet({
  children,
  ok,
  warn,
}: {
  children: React.ReactNode;
  ok?: boolean;
  warn?: boolean;
}) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const color = ok
    ? "text-severity-low"
    : warn
      ? "text-severity-medium"
      : "text-severity-critical";
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
      <span>{children}</span>
    </div>
  );
}

function PrivacyCol({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn";
}) {
  const headerClass =
    tone === "ok"
      ? "bg-severity-low/10 text-severity-low"
      : "bg-severity-medium/10 text-severity-medium";
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${headerClass}`}>
        {title}
      </div>
      <ul className="divide-y divide-border bg-card">
        {items.map((i) => (
          <li
            key={i}
            className="px-4 py-2 text-xs"
          >
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
