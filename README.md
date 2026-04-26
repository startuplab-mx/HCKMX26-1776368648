# Aegis

> Real-time, privacy-first protection for the conversations parents can't see.

Built for **Hackathon 404 · U.S. Embassy in Mexico** — a multi-modal child-safety platform that detects grooming, sextortion, narco recruitment, fraud, and synthetic-media manipulation the moment a message, image, voice clip, or screen-grab is produced, **without ever exposing raw content to parents**.

🔗 **Live deployment:** https://aegis-hack404.lovable.app

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Objectives](#2-vision--objectives)
3. [Users](#3-users)
4. [Architecture](#4-architecture)
5. [Modules](#5-modules)
   - [Argus — Chat Risk Detection](#argus--chat-risk-detection)
   - [Echo — Voice Grooming Detection](#echo--voice-grooming-detection)
   - [Mnemosyne — Image Protection](#mnemosyne--image-protection)
   - [Hermes — Federated Signal Network](#hermes--federated-signal-network)
   - [Aletheia — Deepfake & Manipulation Detector](#aletheia--deepfake--manipulation-detector)
   - [Dashboard — Parental Command Center](#dashboard--parental-command-center)
   - [Companion — On-Device Capture (planned)](#companion--on-device-capture-planned)
6. [Tech Stack](#6-tech-stack)
7. [End-to-End Flow](#7-end-to-end-flow)
8. [Installation & Setup](#8-installation--setup)
9. [Usage](#9-usage)
10. [Costs](#10-costs)
11. [Roadmap](#11-roadmap)
12. [Risks & Limitations](#12-risks--limitations)
13. [License](#13-license)

---

## 1. Executive Summary

**Aegis** is a child-safety AI suite that classifies risk across five surfaces — text, voice, images, federated network signals, and synthetic-media — and surfaces only **metadata** (category, severity, score, coarse region, platform) to a parent dashboard. Raw conversations never leave the device or the inference pipeline.

The current build is a working demo: every module is wired to a Supabase Edge Function powered by a Gemini / GPT-5 model, all events flow into a shared `risk_events` table, and the parent dashboard renders live timelines, an AI-written executive briefing, and a PDF export.

## 2. Vision & Objectives

- **Detect early.** Catch the *escalation* in a conversation, not the aftermath.
- **Respect privacy.** No raw chat content is ever sent to parents or stored long-term.
- **Be parent-actionable.** Every alert ships with a recommended action and a calm conversation starter.
- **Work at scale.** Federated, anonymized signal sharing across many devices (Hermes) so risk patterns surface without per-user surveillance.

## 3. Users

- **Parents / guardians** — the primary dashboard audience. Receive only high-signal, low-noise alerts.
- **Minors (10–17)** — the protected party. Their conversations are inspected on-device or in a sealed inference path; no raw content is ever forwarded.
- **Schools / NGOs (future)** — aggregate-only views via Hermes for policy and outreach.

## 4. Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Capture layer  │ →  │ Edge Functions  │ →  │  risk_events DB │
│ (chat / voice / │    │ (Lovable AI:    │    │  (severity,     │
│  image / OCR /  │    │  Gemini / GPT5) │    │   category,     │
│  manipulation)  │    │                 │    │   score)        │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                        │
                                              ┌─────────▼─────────┐
                                              │ Parent Dashboard  │
                                              │  + Resend email   │
                                              │  + Twilio SMS     │
                                              │  + AI exec brief  │
                                              │  + PDF export     │
                                              └───────────────────┘
```

Inference happens in **Supabase Edge Functions**. The frontend is a single React + Vite + Tailwind SPA. Email/SMS dispatch uses Resend and Twilio. AI cost is tallied live into the `ai_usage` table and shown on the home page.

## 5. Modules

### Argus — Chat Risk Detection
- Live message-by-message classifier (`analyze-risk`).
- Categories: grooming, sextortion, narco recruitment, financial fraud, personal-info extraction, unsafe meetup, drugs/alcohol, explicit imagery, cyberbullying, sexual harassment.
- Returns severity (`low | medium | critical`), score, recommended action, and a one-sentence explanation.
- A second function (`generate-scenario`) produces escalating synthetic conversations on any topic for live demoing.

### Echo — Voice Grooming Detection
- `analyze-audio` accepts a short audio clip (Gemini 2.5 Flash multimodal) and returns the same risk schema as Argus.
- Tuned for game voice chat, Discord calls, and voice notes.

### Mnemosyne — Image Protection
- `analyze-image` flags explicit content, identifying info (uniforms, plates, addresses), weapons, drugs.
- Includes a perceptual-hash check (`phash.ts`) to detect repeats of known-bad images on-device before any upload.

### Hermes — Federated Signal Network
- Demo of a privacy-preserving signal mesh: only `(category, region, platform, score)` tuples cross the wire.
- k-anonymity ≥ 50 and differential-privacy noise are documented in the trust layer.

### Aletheia — Deepfake & Manipulation Detector
- Inspects suspicious media (image / link) for synthetic generation, face-swap, or scam-template reuse.
- Designed to flag the kinds of manipulation used in sextortion campaigns ("not interested" / fake-profile pressure flows).

### Dashboard — Parental Command Center
- Real-time timeline of all `risk_events` (message-by-message line chart, dots colored by severity).
- Top-risk-categories bar chart with a multi-color palette.
- KPI cards (Safety score / Critical / Caution / Messages) that recolor on threshold.
- **Recent critical events** with per-event risk-percentage and a *Forward* dropdown that hands the event to a saved `parent_contact` (email or SMS).
- **Fire test alert** button — exercises the full Resend + Twilio dispatch path (`dispatch-critical-alert`).
- **Weekly digest** — `send-digest` builds a Resend HTML email recap.
- **Executive Summary** — `executive-summary` returns a structured ~450-word AI briefing (Headline / Key Signals / Behavioral Context / Steps / Conversation Starters) plus chart-ready datasets. Exportable to a branded **PDF** that embeds the rendered Recharts panels via html2canvas.

### Companion — On-Device Capture (planned)
- iOS Safari Web Extension that reads chat bubbles on `web.whatsapp`, `web.telegram`, Instagram, and Discord and forwards only structured ingest events to Argus.
- Currently scaffolded as a demo route; not yet shipped to TestFlight (cost projection in §10).

## 6. Tech Stack

| Layer        | Tech |
|--------------|------|
| Frontend     | React 18, Vite 5, Tailwind v3, TypeScript, shadcn/ui, framer-motion, recharts |
| PDF export   | jspdf + html2canvas |
| Backend      | Supabase (Postgres + Edge Functions, Deno runtime) |
| AI inference | Gemini 2.5 Flash, Gemini 2.5 Pro, GPT-5 family — all called via the in-house AI gateway from edge functions |
| Email        | Resend |
| SMS          | Twilio |
| Hosting      | Lovable (preview + custom subdomain) |

## 7. End-to-End Flow

1. A capture surface (chat bubble, screen OCR, voice clip, image, manipulated media) produces an event.
2. The corresponding edge function (`analyze-risk`, `analyze-audio`, `analyze-image`, etc.) calls a Gemini / GPT-5 model, parses a strict JSON tool-call response, and writes a row to `risk_events`.
3. Every AI call also writes a row to `ai_usage` (model, tokens in/out, USD cost).
4. If `severity === "critical"`, `dispatch-critical-alert` fans out to all opted-in `parent_contacts` via Resend (email) and Twilio (SMS), logging each attempt to `alert_dispatches`.
5. The dashboard subscribes to Postgres changes for live updates and lets the parent generate / export an executive briefing.

## 8. Installation & Setup

```bash
git clone <repo>
cd aegis
bun install
bun run dev
```

This project is built and hosted on **Lovable**, so the Supabase project, edge functions, Resend, Twilio, and AI gateway are all provisioned through the Lovable Cloud integration. To self-host, you would need to recreate the schema (`supabase/migrations/`), deploy the functions in `supabase/functions/`, and provide:

- `LOVABLE_API_KEY` (or any compatible OpenAI-style gateway key for Gemini / GPT-5)
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

## 9. Usage

- `/` — Landing page + AI spend meter (live, reads from `ai_usage`).
- `/argus`, `/echo`, `/mnemosyne`, `/hermes`, `/aletheia` — interactive module demos.
- `/dashboard` — parental command center (timeline, KPIs, executive summary, PDF export, fire-test alert, weekly digest).
- `/companion` — preview of the planned on-device capture extension.

## 10. Costs

All AI cost is **metered per call** and tallied live on the home page from the `ai_usage` table. Pricing below is approximate and based on the AI gateway rates at build time.

### 10.1 Per-call AI cost (current)

| Model                   | Input ($/1k tok) | Output ($/1k tok) | Typical call (Aegis) |
|-------------------------|------------------|-------------------|----------------------|
| Gemini 2.5 Flash        | 0.000075         | 0.000300          | ~$0.0002 / message   |
| Gemini 2.5 Pro          | 0.00125          | 0.005             | ~$0.004 / image      |
| GPT-5 mini              | ~0.00025         | ~0.002            | ~$0.002 / call       |

Most modules (Argus, Echo, aegis-chat, executive-summary, generate-scenario) run on **Gemini 2.5 Flash**. Mnemosyne and Aletheia use **Gemini 2.5 Pro** for vision quality.

### 10.2 Backend & infra (current)

| Service                 | Tier used in demo            | Approx monthly cost |
|-------------------------|------------------------------|---------------------|
| Supabase (DB + edge fn) | Free tier (Lovable Cloud)    | $0 (within $25 free Cloud balance) |
| Resend (email)          | Free dev tier                | $0 (≤ 3k emails/mo) |
| Twilio (SMS)            | Pay-as-you-go                | ~$0.0079 per SMS to MX |
| Lovable hosting         | Included in workspace plan   | $0 marginal         |
| **Total infra (demo)**  |                              | **≈ $0–$5 / month** |

### 10.3 End-to-end demo run cost

A full demo run (≈ 30 chat messages + 5 voice clips + 5 images + 1 executive summary + 1 PDF export + 1 critical SMS) costs roughly:

- AI: **~$0.04**
- SMS: **~$0.01**
- Email + DB + hosting: **~$0**
- **Total: under $0.06 per full demo**

### 10.4 Companion (future) — projected cost

Companion adds on-device capture (iOS Safari Web Extension) and forwards structured events to Argus. The capture itself is free (runs on the user's device), but the back-end ingest grows with active users.

Assuming a **1,000 active minors** pilot with **~200 inspected messages / minor / day**:

| Item                                       | Volume / month       | Unit cost           | Monthly cost |
|--------------------------------------------|----------------------|---------------------|--------------|
| Argus inference (Gemini 2.5 Flash)         | 6M messages          | ~$0.0002 / msg      | **~$1,200**  |
| Image scans (Mnemosyne, Gemini 2.5 Pro)    | 30k images           | ~$0.004 / img       | **~$120**    |
| Voice clips (Echo, Gemini 2.5 Flash multimodal) | 15k clips       | ~$0.0008 / clip     | **~$12**     |
| Aletheia (deepfake checks, on-demand)      | 5k checks            | ~$0.005 / check     | **~$25**     |
| Critical SMS fan-out (Twilio MX)           | ~2k alerts × 1 SMS   | $0.0079 / SMS       | **~$16**     |
| Resend digests + criticals                 | ~30k emails          | $0.0004 / email     | **~$12**     |
| Supabase (DB + edge invocations)           | upgrade to Pro       | $25 + usage         | **~$50**     |
| **Estimated total (1k-user pilot)**        |                      |                     | **≈ $1,435 / month** |

That's roughly **$1.44 per protected minor per month** at the pilot scale, and falls to ~**$0.80 / minor / month** at 10k users once Gemini batch pricing and Twilio volume tiers kick in.

> The live "AI spend to date" meter on the home page reflects only inference cost, not Twilio/Resend/Supabase infra. SMS and infra costs are projected separately above.

## 11. Roadmap

- **v0.1 (now)** — full hackathon demo: 5 inference modules + dashboard + alerts + AI exec brief + PDF.
- **v0.2** — ship Companion (iOS Safari Web Extension) into TestFlight; on-device pHash cache for repeat-image suppression.
- **v0.3** — Hermes federated rollout with k-anonymity ≥ 50 enforced server-side; per-region risk heatmap.
- **v0.4** — fine-tuned MX-Spanish slang model for Argus; offline fallback classifier on-device.
- **v1.0** — school / NGO aggregate dashboard with exportable policy reports.

## 12. Risks & Limitations

- **Demo data, not production data.** Scenarios are AI-generated synthetic conversations.
- **Model drift.** Slang and grooming tactics change; the classifier needs continuous evaluation.
- **No content surfaced to parents.** This is by design; some parents may want more — we deliberately surface only metadata + recommended actions.
- **AI gateway dependency.** Outage or rate-limit on the AI gateway degrades all modules to a neutral "no signal" state (never to false-positive critical).

## 13. License

Built for Hackathon 404 (U.S. Embassy in Mexico). Licensing TBD post-event.
