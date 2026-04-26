/**
 * Aletheia — algorithmic exposure dashboard data generator.
 *
 * Client-side port of the original Python `aletheia.py`. Produces a
 * deterministic-but-fresh weekly exposure profile across the dimensions
 * identified in the convocatoria #2 problem ("exposición a contenidos
 * normalizados"). Pure functions, no network.
 */

export type AletheiaDimension = {
  key: string;
  label: string;
  description: string;
  color: string;
  exposure_pct: number;
  minutes_this_week: number;
  delta_vs_last_week: number;
  tips: string[];
};

export type AletheiaTimelineRow = {
  day: string;
  date: string;
  [dimensionKey: string]: number | string;
};

export type AletheiaPlatformShare = { platform: string; share_pct: number };

export type AletheiaReport = {
  headline: string;
  dimensions: AletheiaDimension[];
  timeline: AletheiaTimelineRow[];
  platform_split: AletheiaPlatformShare[];
  total_risk_minutes: number;
  reset_steps: string[];
  generated_at: string;
  ownership_note: string;
};

const DIMENSIONS = [
  {
    key: "narcocultura",
    label: "Narcocultura",
    description: "Glamorized cartel content, narcocorridos, lifestyle posts.",
    color: "#E11D48",
  },
  {
    key: "body_image_extremes",
    label: "Body Image Extremes",
    description: "Pro-ana, extreme diet, unrealistic body standards.",
    color: "#F59E0B",
  },
  {
    key: "dangerous_challenges",
    label: "Dangerous Challenges",
    description:
      "Viral risky stunts, breath-holding, choking, drug-mix dares.",
    color: "#7C3AED",
  },
  {
    key: "hate_content",
    label: "Hate & Harassment",
    description: "Targeted insults, hateful tropes, incel pipelines.",
    color: "#0EA5E9",
  },
  {
    key: "unrealistic_lifestyle",
    label: "Unrealistic Lifestyle",
    description: "Constant comparison, lifestyle envy, fake luxury.",
    color: "#10B981",
  },
  {
    key: "normalized_substance_use",
    label: "Substance Normalization",
    description: "Vape / alcohol / pill content shown as routine.",
    color: "#3B82F6",
  },
] as const;

const PLATFORMS = ["Instagram Reels", "YouTube Shorts", "Snapchat Spotlight"];

const ACTION_TIPS: Record<string, string[]> = {
  narcocultura: [
    "Tap “Not interested” on three narcocorrido clips this week.",
    "Follow two creators outside the genre to dilute the signal.",
  ],
  body_image_extremes: [
    "Mute hashtags like #thinspo and #whatieatinaday.",
    "Train the algorithm by liking body-neutral / fitness-positive posts.",
  ],
  dangerous_challenges: [
    "Long-press → “Not interested” on viral challenge videos.",
    "Report any video that promotes self-harm directly to the platform.",
  ],
  hate_content: [
    "Block accounts that repeatedly insult identity groups.",
    "Save creators with calm, evidence-based commentary instead.",
  ],
  unrealistic_lifestyle: [
    "Take a 24-hour scrolling break — the feed will recalibrate.",
    "Follow real-job creators (teachers, scientists, artisans) to widen the mix.",
  ],
  normalized_substance_use: [
    "Mark vape/alcohol promo content as Not interested.",
    "Search and engage with sober-curious or recovery creators.",
  ],
};

/** Cheap deterministic 32-bit hash of a string. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG seeded from a 32-bit int. */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededValue(seed: string, low: number, high: number): number {
  const r = rng(hashString(seed))();
  return low + r * (high - low);
}

function todayBucket(seedModifier = ""): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}${seedModifier}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildExposureReport(seedModifier = ""): AletheiaReport {
  const dayBucket = todayBucket(seedModifier);

  const dims: AletheiaDimension[] = DIMENSIONS.map((d) => {
    const pct = Math.round(seededValue(`${dayBucket}-${d.key}-pct`, 4, 32) * 10) / 10;
    const minutes = Math.floor(seededValue(`${dayBucket}-${d.key}-min`, 12, 95));
    const delta = Math.round(seededValue(`${dayBucket}-${d.key}-delta`, -22, 30) * 10) / 10;
    return {
      ...d,
      exposure_pct: pct,
      minutes_this_week: minutes,
      delta_vs_last_week: delta,
      tips: ACTION_TIPS[d.key] ?? [],
    };
  });

  const total_risk_minutes = dims.reduce((acc, d) => acc + d.minutes_this_week, 0);
  dims.sort((a, b) => b.exposure_pct - a.exposure_pct);

  // Daily timeline (7 days, last entry = today).
  const timeline: AletheiaTimelineRow[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - (6 - i));
    const seed = `${dayBucket}-day-${i}`;
    const r = rng(hashString(seed));
    const dateStr = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
    const entry: AletheiaTimelineRow = {
      day: DAY_NAMES[day.getUTCDay()],
      date: dateStr,
    };
    for (const d of DIMENSIONS) {
      entry[d.key] = Math.round((2 + r() * 20) * 10) / 10;
    }
    timeline.push(entry);
  }

  // Platform split.
  const r = rng(hashString(dayBucket));
  const platform_split: AletheiaPlatformShare[] = [];
  let remaining = 100;
  for (let i = 0; i < PLATFORMS.length - 1; i++) {
    let v = Math.floor(20 + r() * 31); // 20..50 inclusive
    v = Math.min(v, remaining - 5);
    platform_split.push({ platform: PLATFORMS[i], share_pct: v });
    remaining -= v;
  }
  platform_split.push({ platform: PLATFORMS[PLATFORMS.length - 1], share_pct: Math.max(remaining, 0) });

  const headlineDim = dims[0];
  const headline =
    `This week your feed is mostly ${headlineDim.label.toLowerCase()} — ` +
    `${headlineDim.exposure_pct}% of risk-flagged content.`;

  const reset_steps = [
    "Open your feed and tap **Not interested** on the three most recent flagged posts.",
    "Follow two creators outside your usual circle to widen the signal.",
    "Take a 12-hour scrolling break — the algorithm recalibrates fast.",
    "Search a positive interest you actually care about; engage for 5 minutes.",
  ];

  return {
    headline,
    dimensions: dims,
    timeline,
    platform_split,
    total_risk_minutes,
    reset_steps,
    generated_at: new Date().toISOString(),
    ownership_note:
      "This report is for YOU. It is not shared with your parents. You decide what to do.",
  };
}
