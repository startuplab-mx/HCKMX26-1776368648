# Aegis

> Real-time, privacy-first protection for the conversations parents can't see.

Built for **Hackathon 404 · U.S. Embassy in Mexico** — a multi-modal child-safety platform that detects grooming, sextortion, narco recruitment, and fraud the moment a message, image, screen, or voice signal arrives — across chats, games, screens, and audio — without ever exposing raw content to parents.

---

## Table of Contents

1. [Project Name](#1-project-name)
2. [Executive Summary](#2-executive-summary)
3. [Vision](#3-vision)
4. [Objectives](#4-objectives)
5. [Users](#5-users)
6. [Scope](#6-scope)
7. [High-Level Architecture](#7-high-level-architecture)
8. [Modules / Features Breakdown](#8-modules--features-breakdown)
   - [Argus — Chat Risk Detection](#argus--chat-risk-detection)
   - [Helios — Screen & OCR Analysis](#helios--screen--ocr-analysis)
   - [Echo — Voice Grooming Detection](#echo--voice-grooming-detection)
   - [Mnemosyne — Image Protection](#mnemosyne--image-protection)
   - [Hermes — Federated Signal Network](#hermes--federated-signal-network)
   - [Companion — Mobile Capture Architecture](#companion--mobile-capture-architecture)
   - [ZeroTrust Control Layer](#zerotrust-control-layer)
   - [Alerting & Digests](#alerting--digests)
9. [Tech Stack](#9-tech-stack)
10. [End-to-End Flow](#10-end-to-end-flow)
11. [Installation & Setup](#11-installation--setup)
12. [Usage](#12-usage)
13. [Roadmap](#13-roadmap)
14. [Risks & Limitations](#14-risks--limitations)
15. [Contributing](#15-contributing)
16. [License](#16-license)

---

## 1. Project Name

**Aegis** — *"The shield that watches the conversation, not the child."*

A multi-modal, AI-powered child-safety platform built privacy-first for the Mexican and broader Latin American context.

---

## 2. Executive Summary

**What it does.** Aegis listens, in real time, to the digital surfaces a minor uses — DMs, in-game chat, screens, voice calls, image galleries — and classifies risk along ten categories (grooming, sextortion, narco recruitment, financial fraud, cyberbullying, unsafe meetups, drugs/alcohol, personal-info extraction, and more). When something dangerous appears, it tells a parent **why** the situation is risky and **what to do**, *without* showing the raw conversation.

**Problem.** Parents can't read every message their child sends, and shouldn't. But the threats children face online — adult predators, cartel recruiters, sextortion rings, scam operators — are sophisticated, multilingual, and fast. Existing parental-control tools either over-collect (surveillance) or under-detect (keyword lists).

**Value proposition.**
- **Detection that matters** — hybrid rules + LLM classifier covering Spanish, English, and regional slang.
- **Privacy by design** — parents see structured risk explanations, never raw content.
- **Multi-modal** — text, image, screen OCR, and audio in a single coherent system.
- **Action-ready** — critical events trigger SMS + email in under one second.

---

## 3. Vision

A future where every minor in Latin America browses, plays, and chats under an invisible safety mesh that intervenes only when intervention is warranted — preserving autonomy, trust, and dignity, while making predators, recruiters, and scammers structurally unable to operate at scale.

**Expected impact.**
- Reduce time-to-intervention on grooming and sextortion cases from days/weeks to seconds.
- Give Mexican families a Spanish-native, regionally-aware tool (most existing solutions are English-first and miss local threat patterns like *halconeo* or *jale*).
- Build a federated signal layer where one detected predator instantly raises risk scores across every protected device.

---

## 4. Objectives

| Goal | KPI |
|---|---|
| Sub-second risk classification | p95 < 1.0s for chat messages |
| High recall on critical categories | False-negative rate < 5% on grooming/sextortion |
| Zero raw-content exposure to parents | 100% of alerts use abstracted explanations |
| Real-time critical alerting | SMS + email dispatched within 5s of trigger |
| Multilingual coverage | Spanish, English, regional Mexican slang |
| Federated learning effect | Each new signal improves Hermes risk map |

---

## 5. Users

| User type | Needs | Primary use cases |
|---|---|---|
| **Parents / Guardians** | Awareness without surveillance, clear actions | Receive critical SMS, review daily/weekly digests, override decisions |
| **Minors (6–17)** | Frictionless protection, no shame, no constant interruption | Use chat, social, games normally; system intervenes silently |
| **NGOs / Schools** | Aggregate threat intelligence | Hermes regional risk dashboards |
| **Law enforcement (future)** | Verified, hashed evidence trail | Audit log of dispatches, zero-knowledge case files |

---

## 6. Scope

### Included
- Real-time text classification (chat / DM / game chat).
- Image risk analysis with on-device perceptual hashing and auto-blur.
- Screen OCR + multimodal classification of any visible app.
- Voice transcription + grooming-pattern detection.
- Federated regional signal network (Hermes) with map visualization.
- Critical-event alerting (SMS via Twilio, email via Lovable Email).
- Daily and weekly safety digests for parents.
- ZeroTrust identity layer with mocked credential issuance and ephemeral tokens.
- Mobile capture architecture (Android `AccessibilityService` + iOS `FamilyControls`) — design + reference snippets.

### Explicitly NOT included
- A native mobile build (Companion is a *concept page* with reference architecture; no Capacitor/native shell shipped).
- Real government identity integration (RENAPO/INE references are mocked for the ZeroTrust layer).
- Storing raw chat content longer than the active session (privacy invariant).
- Production-grade biometric verification.
- End-user account system / multi-tenancy (single-family demo scope).

---

## 7. High-Level Architecture

```
                       ┌────────────────────────────────┐
                       │        Capture Surfaces        │
                       │  Chat · Screen · Image · Audio │
                       │  (web demo + mobile concept)   │
                       └───────────────┬────────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   ZeroTrust Layer       │
                          │  (token + enforcement)  │
                          └────────────┬────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼─────────┐  ┌───────────▼──────────┐  ┌──────────▼──────────┐
   │   Edge Functions   │  │   Lovable AI Gateway │  │  Local heuristics   │
   │  analyze-risk      │──▶  Gemini 2.5 Flash    │  │  Regex red-flags    │
   │  analyze-image     │  │  (vision + tools)    │  │  Perceptual hashes  │
   │  analyze-screen    │  └──────────────────────┘  └─────────────────────┘
   │  analyze-audio     │
   └──────────┬─────────┘
              │
   ┌──────────▼──────────┐       ┌─────────────────────────┐
   │   Postgres (RLS)    │──────▶│  Trigger on critical    │
   │  risk_events        │       │  → dispatch-critical-   │
   │  chat_messages      │       │     alert               │
   │  alert_dispatches   │       └─────────────┬───────────┘
   │  parent_contacts    │                     │
   └──────────┬──────────┘         ┌───────────▼───────────┐
              │                    │  Twilio SMS + Email   │
   ┌──────────▼──────────┐         └───────────────────────┘
   │  pg_cron schedules  │
   │  → send-digest      │
   └─────────────────────┘
```

**Data flow.** Capture → ZeroTrust gate → hybrid classifier (rules + LLM) → persisted `risk_event` → if `severity = critical`, DB trigger fires the dispatch function → Twilio/email out. Periodic `pg_cron` jobs aggregate events into safety digests.

---

## 8. Modules / Features Breakdown

### Argus — Chat Risk Detection

**Functional.** Watches every chat message in real time and flags risky ones with a severity badge (`low` / `medium` / `critical`), a category, a short explanation, and a recommended action for the parent.

**Technical.** Edge Function `analyze-risk` runs a two-stage hybrid pipeline:
1. **Rule scan** — regex-based red-flag matcher across nine categories in Spanish + English (secrecy, image requests, location extraction, in-person meetups, financial fraud, narco recruitment, sextortion, personal info, drugs/alcohol). Each match contributes a weighted score.
2. **LLM classifier** — sends the message + last 6 messages of context to Gemini 2.5 Flash via the Lovable AI Gateway, using OpenAI-style **tool calling** to force a structured response.

The final risk score is `max(rule_score, ai_score)` — rules act as a floor so a known red-flag phrase can never be downgraded by the model.

**I/O.** In: `{ message, history }`. Out: `{ risk_score, category, severity, matched_patterns, explanation, recommended_action }`.

**Dependencies.** Lovable AI Gateway, Postgres (`chat_messages`, `risk_events`), Supabase Realtime.

**AI / LLM Focus.**
- **Model:** `google/gemini-2.5-flash` — chosen for low latency, multimodal capability, and strong Spanish performance.
- **Prompting:** strict system prompt framing the model as a child-safety classifier in Mexico, instructed that *false negatives are dangerous*. Tool-call schema enforces enum categories and severity.
- **Memory:** rolling window of the last 6 messages per session — enough for grooming pattern recognition without unbounded context drift.
- **Limitations:** model is stateless across sessions; sarcasm and code-switching can lower confidence; rules-as-floor mitigates obvious misses.

---

### Helios — Screen & OCR Analysis

**Functional.** Reads any screen the child is viewing — closed-app DMs, screenshots, web pages — and classifies what's visible.

**Technical.** Edge Function `analyze-screen` accepts a base64 image, sends it to Gemini 2.5 Flash with a multimodal prompt that performs OCR + risk classification in a single pass.

**I/O.** In: `{ image }`. Out: `{ extracted_text, risk_score, category, severity, explanation }`.

**AI / LLM Focus.** Single-shot vision call. No persistent memory. Limitation: heavy text overlays and stylized fonts reduce OCR accuracy.

---

### Echo — Voice Grooming Detection

**Functional.** Transcribes voice clips/calls and flags adult-to-minor grooming patterns.

**Technical.** Edge Function `analyze-audio` pipes audio to Gemini 2.5 Flash (audio-capable), which produces a transcript and a risk classification using the same tool-call schema as Argus.

**Limitations.** Currently single-clip; no real-time streaming. Speaker diarization is heuristic.

---

### Mnemosyne — Image Protection

**Functional.** Before any image leaves the device, Mnemosyne assesses the risk and **auto-blurs + blocks** sharing if the score crosses a threshold.

**Technical.**
- **Local perceptual hash (`src/lib/phash.ts`)** — 8×8 average hash computed in the browser; matched against a known-harmful blocklist *without uploading the image*.
- **Edge Function `analyze-image`** — sends image to Gemini vision with strict instructions to never describe bodies or quote PII; classifies for explicit imagery, identifying info, weapons, drugs, and minor presence.
- **Hard escalation:** `subject_appears_minor && contains_nudity ⇒ score = 1.0` (always critical).
- **UI thresholds:** `BLUR_THRESHOLD = 0.4`, `AUTOBLOCK_THRESHOLD = 0.7`. Parents can reveal via explicit override.

**AI / LLM Focus.** Same model family. Prompting emphasizes *pattern* over *content* ("intimate self-portrait", "school uniform visible") to keep explanations shareable with parents without re-victimizing the child.

---

### Hermes — Federated Signal Network

**Functional.** A live LATAM map showing aggregated risk signals across protected devices — country-level density, category breakdown, recent events.

**Technical.** `react-leaflet` + OpenStreetMap (Carto Light tiles). `CircleMarker` per signal, sized by risk score, colored by category. Hover tooltips and popups expose the abstracted event metadata only.

**Why Leaflet over Mapbox.** Free, no token, no rate limits — appropriate for a hackathon and for an NGO-friendly production path.

---

### Companion — Mobile Capture Architecture

**Functional.** A concept page documenting how Aegis would integrate with real mobile devices.

**Technical reference (no native build shipped).**
- **Android:** `AccessibilityService` reading `TYPE_VIEW_TEXT_CHANGED` events from chat apps; on-device pre-filter; only suspicious payloads leave the device.
- **iOS:** `FamilyControls` + `DeviceActivityMonitor` + `ManagedSettings` for parental scope; `Screen Time API` for app-level visibility.
- Includes Kotlin and Swift snippets, permission model, and the privacy invariant: **raw content stays on device unless risk threshold is crossed.**

---

### ZeroTrust Control Layer

**Functional.** A non-intrusive, system-level extension surfaced as a single "Trust Layer" pill button (with a subtle blue indicator). Opens a panel showing **Identity Credential** (mocked RENAPO/INE), **Active Proof** (age + risk scope, ephemeral token), and the **Decision Engine** (Credential → Token → Verification → Decision).

**Technical (`src/lib/trustLayer.ts`).**
- Mocked signed credentials and JWT-style ephemeral tokens (5-min expiry).
- `decideEnforcement(token)` → `{ allow, delayMs, shadowBan }`.
- **Silent enforcement** in `ChatPane`: high-risk actions are *shadow-banned* — echoed locally to the user but never persisted, never classified, never alerted on. No popups, no UI changes. The system feels like infrastructure.

**Privacy invariant.** Panel never exposes raw JSON, keys, or PII — only `Verified` / `Signed` / `Active`.

---

### Alerting & Digests

- **Critical alerts** — Postgres trigger `trg_notify_critical_risk` fires on `severity = 'critical'` inserts → calls `dispatch-critical-alert` → Twilio SMS + Lovable Email.
- **Daily digest** — `pg_cron` 08:00 UTC → HTML report with safety score, risk counts, top categories.
- **Weekly digest** — `pg_cron` Mon 09:00 UTC.
- **Test button** — Dashboard "Fire test alert" invokes the dispatcher with `{ test: true }`.

---

## 9. Tech Stack

**Frontend**
- React 18, TypeScript 5, Vite 5
- Tailwind CSS v3 + shadcn/ui (Radix primitives)
- React Router v6, TanStack Query
- `react-leaflet` + Leaflet (OSM Carto tiles)
- Framer Motion (selective)

**Backend (Lovable Cloud)**
- Supabase Postgres with Row-Level Security
- Supabase Edge Functions (Deno) — `analyze-risk`, `analyze-image`, `analyze-screen`, `analyze-audio`, `dispatch-critical-alert`, `send-digest`
- Supabase Realtime (chat + risk-event streams)
- `pg_cron` for scheduled digests
- DB triggers for critical-event dispatch

**AI / ML**
- **Lovable AI Gateway** with `google/gemini-2.5-flash` (text + vision + audio + tool calling)
- Browser-side **average-hash (aHash)** perceptual fingerprinting
- Hybrid rule-based red-flag matcher (Spanish + English)

**Infrastructure & Integrations**
- Twilio (SMS to parent phone)
- Lovable Email (transactional)
- Lovable Cloud-managed Postgres + auth + storage

**Databases (key tables)**
- `chat_sessions`, `chat_messages`
- `risk_events` (category, severity, score, explanation, matched patterns)
- `parent_contacts` (channel preferences)
- `alert_dispatches` (audit trail)

---

## 10. End-to-End Flow

1. **Capture** — minor sends a chat message in `/demo` (or screen/image/audio is captured).
2. **ZeroTrust gate** — current ephemeral token is checked; if risk-state is `high`, the message is shadow-banned (locally echoed, never sent).
3. **Persist message** — written to `chat_messages` (Realtime push).
4. **Classify** — `analyze-risk` runs rules + Gemini tool-call → returns structured risk.
5. **Persist event** — `risk_events` row written with severity.
6. **Trigger** — if `critical`, `trg_notify_critical_risk` fires `dispatch-critical-alert`.
7. **Notify** — Twilio SMS to parent + email via Lovable Email; row added to `alert_dispatches`.
8. **Dashboard** — parent sees a new `AlertCard` in `/dashboard` with explanation + recommended action — never the raw message.
9. **Digest** — daily/weekly cron aggregates the day's events into an HTML safety report.

---

## 11. Installation & Setup

### Requirements
- Node 18+ and `bun` (or npm)
- A Lovable project with **Lovable Cloud** enabled (provisions Postgres + Edge Functions automatically)
- Twilio account (for SMS) — connected via Lovable Standard Connectors
- Lovable Email enabled (sender domain verified)

### Setup
```bash
bun install
bun dev
```

### Environment variables (auto-provisioned by Lovable Cloud)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

### Edge Function secrets (set in Lovable Cloud)
```
LOVABLE_API_KEY            # AI Gateway
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
RESEND_API_KEY             # if using direct email instead of Lovable Email
```

---

## 12. Usage

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/demo` | Live Argus chat — type messages, see real-time risk classification |
| `/dashboard` | Parent view — alerts, digests, **Fire test alert** button |
| `/helios` | Upload a screenshot for OCR + risk analysis |
| `/echo` | Upload audio for voice grooming detection |
| `/mnemosyne` | Upload an image — see auto-blur and block in action |
| `/hermes` | LATAM signal map |
| `/companion` | Mobile architecture concept (Android + iOS reference) |

**Typical workflow.** Open `/demo` in one tab and `/dashboard` in another. Send the message *"no le digas a tus papás, mándame una foto"* — watch the dashboard receive a critical alert and (if Twilio is configured) the parent phone receive an SMS within seconds.

---

## 13. Roadmap

- **Native Companion shell** — ship Android `AccessibilityService` + iOS `FamilyControls` apps.
- **Federated learning** — train a per-region embedding of threat patterns without centralizing raw text.
- **Real identity layer** — replace mocked RENAPO/INE with verifiable credentials (W3C VC).
- **Predator graph** — link signals across devices to surface the same threat actor across multiple children.
- **NGO/school dashboards** — multi-tenant Hermes with role-based access.
- **Real-time voice streaming** — replace clip-based Echo with live pipeline.
- **Photo blocklist via PhotoDNA / pdqhash** — server-side known-CSAM matching.

---

## 14. Risks & Limitations

**Technical**
- LLM rate limits & cost at scale — mitigated by rules-as-floor and small model choice.
- OCR / audio quality variance.
- Browser perceptual hashing is weak vs. adversarial transforms (acceptable for the demo; production should use pdqhash server-side).

**Business**
- Parental trust is the primary adoption barrier — mitigated by zero-raw-content invariant.
- Regulatory landscape varies country-by-country (Mexico's federal data-protection regime applies).

**AI-specific**
- **Hallucination** — model could fabricate an explanation. Mitigated by tool-call schema and rules-as-floor.
- **Bias** — Spanish dialects and indigenous languages are under-represented. Roadmap includes regional fine-tuning.
- **False negatives on critical categories** — most dangerous failure mode. Mitigated by aggressive recall-over-precision tuning, rules-as-floor, and parent override.
- **False positives** — fatigue parents. Mitigated by severity tiers; only `critical` triggers SMS.

---

## 15. Contributing

1. Fork the repo / open in Lovable.
2. Branch from `main`.
3. Keep changes scoped — UI changes should not touch Edge Functions and vice versa.
4. Run `bun run lint` and `bunx vitest run` before opening a PR.
5. Never commit secrets; use Lovable Cloud secret management.
6. Preserve the privacy invariants: **no raw chat content in alerts, no PII in the ZeroTrust panel, no unbounded retention.**

---

## 16. License

MIT — see `LICENSE`. Built for educational and humanitarian use during Hackathon 404 (U.S. Embassy in Mexico). Production deployment requires legal review under local data-protection law.
