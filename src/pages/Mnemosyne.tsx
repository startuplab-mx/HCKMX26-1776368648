import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Image as ImageIcon,
  Upload,
  Loader2,
  Fingerprint,
  AlertTriangle,
  Sparkles,
  X,
  Lock,
  ShieldCheck,
  EyeOff,
  Eye,
  Ban,
} from "lucide-react";
import { type Severity } from "@/lib/utils";
import { SeverityBadge } from "@/components/SeverityBadge";
import { toast } from "sonner";
import {
  perceptualHashFromDataUrl,
  hammingDistanceHex,
} from "@/lib/phash";

// Auto-block thresholds: if risk_score >= AUTOBLOCK_THRESHOLD, the image is
// auto-blurred, auto-added to the local blocklist and marked as blocked.
// At BLUR_THRESHOLD it's blurred but the parent can reveal it.
const AUTOBLOCK_THRESHOLD = 0.7;
const BLUR_THRESHOLD = 0.4;

type MnemosyneResult = {
  risk_score: number;
  category: string;
  severity: Severity;
  subject_appears_minor: boolean;
  contains_nudity: boolean;
  identifying_info: string[];
  explanation: string;
  recommended_action: string;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const CATEGORY_LABELS: Record<string, string> = {
  explicit_imagery: "Explicit imagery",
  minor_explicit_risk: "Minor in explicit context",
  self_generated_intimate: "Self-generated intimate",
  identifying_info_visible: "Identifying info visible",
  violence_weapons: "Violence / weapons",
  drugs_alcohol: "Drugs / alcohol",
  benign: "Safe to share",
};

// Demo blocklist — in a real product this would be a server-side database
// of hashes from NCMEC / law enforcement / verified parent reports.
const BLOCKLIST_KEY = "aegis.mnemosyne.blocklist";

function loadBlocklist(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBlocklist(list: string[]) {
  localStorage.setItem(BLOCKLIST_KEY, JSON.stringify(list));
}

export default function Mnemosyne() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [matchedHash, setMatchedHash] = useState<{
    hash: string;
    distance: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MnemosyneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [blocklist, setBlocklist] = useState<string[]>(loadBlocklist());
  const [blocked, setBlocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file (PNG / JPG / WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image is larger than 5 MB. Try a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      setImageDataUrl(url);
      setFileName(file.name);
      setResult(null);
      setError(null);
      setMatchedHash(null);
      setBlocked(false);
      setRevealed(false);

      // Compute perceptual hash locally — never leaves the device.
      try {
        const h = await perceptualHashFromDataUrl(url);
        setHash(h);
        // Check against demo blocklist (Hamming distance <= 8 bits is "near match").
        const list = loadBlocklist();
        let best: { hash: string; distance: number } | null = null;
        for (const candidate of list) {
          const d = hammingDistanceHex(h, candidate);
          if (!best || d < best.distance) best = { hash: candidate, distance: d };
        }
        if (best && best.distance <= 8) {
          setMatchedHash(best);
          setBlocked(true); // auto-block on hash match
          toast.error("Known harmful image matched — auto-blocked", {
            description: `Hamming distance ${best.distance} bits. Sharing prevented.`,
          });
        }
      } catch (e) {
        console.error("hash failed", e);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  async function analyze() {
    if (!imageDataUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-image",
        { body: { image: imageDataUrl } },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const r = data as MnemosyneResult;
      setResult(r);

      // Auto-block + auto-add to blocklist when score is high
      if (r.risk_score >= AUTOBLOCK_THRESHOLD) {
        setBlocked(true);
        setRevealed(false);
        if (hash && !loadBlocklist().includes(hash)) {
          const next = [...loadBlocklist(), hash];
          saveBlocklist(next);
          setBlocklist(next);
          toast.error(
            `Auto-blocked & hash quarantined · ${(r.risk_score * 100).toFixed(0)}/100`,
            { description: "Image will not be shared. Hash added to local blocklist." },
          );
        } else {
          toast.error(`Auto-blocked · ${CATEGORY_LABELS[r.category] ?? r.category}`, {
            description: r.explanation,
          });
        }
      } else if (r.severity === "medium") {
        toast.warning(`Caution: ${CATEGORY_LABELS[r.category] ?? r.category}`, {
          description: r.explanation,
        });
      } else {
        toast.success("Safe to share — no significant risk.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      setError(msg);
      toast.error("Analysis failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function unblock() {
    setBlocked(false);
    setRevealed(true);
    toast.info("Override applied", {
      description: "Image temporarily unblocked. The hash remains on the blocklist.",
    });
  }

  function addToBlocklist() {
    if (!hash) return;
    if (blocklist.includes(hash)) {
      toast.info("Already on the blocklist.");
      return;
    }
    const next = [...blocklist, hash];
    setBlocklist(next);
    saveBlocklist(next);
    toast.success("Hash added to blocklist", {
      description: "Future near-duplicates will be flagged instantly.",
    });
  }

  function clearBlocklist() {
    setBlocklist([]);
    saveBlocklist([]);
    setMatchedHash(null);
    toast.success("Blocklist cleared.");
  }

  function reset() {
    setImageDataUrl(null);
    setFileName(null);
    setHash(null);
    setMatchedHash(null);
    setResult(null);
    setError(null);
    setBlocked(false);
    setRevealed(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Visual blur strength: stronger when blocked, lighter when caution-only
  const blurClass = (() => {
    if (revealed) return "";
    if (blocked) return "blur-2xl scale-105";
    if (result && result.risk_score >= BLUR_THRESHOLD) return "blur-md";
    return "";
  })();

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
                Mnemosyne · Image protection
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/echo"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Echo (voice)
            </Link>
            <Link
              to="/helios"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Helios (screen)
            </Link>
            <Link
              to="/dashboard"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-gradient-hero text-primary-foreground">
        <div className="mx-auto max-w-[1400px] px-6 py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest backdrop-blur">
            <ImageIcon className="h-3 w-3" />
            Mnemosyne — initiative #5
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
            Stop the image before it leaves the device.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
            Mnemosyne combines a local <strong>perceptual hash</strong> (the
            image is fingerprinted in the browser, never uploaded for hashing)
            with a vision risk classifier — so known sextortion images are
            blocked instantly, and new ones are caught by AI.
          </p>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[1fr_1fr] lg:px-6">
        {/* Left: dropzone */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-base font-semibold">
                Drop an image
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG or WebP · max 5 MB · hashed locally first
              </p>
            </div>
            {imageDataUrl && (
              <button
                onClick={reset}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            )}
          </div>

          {!imageDataUrl ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={
                "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors " +
                (dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50")
              }
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-shield text-primary-foreground shadow-elevated">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">Drop an image here</p>
                <p className="text-xs text-muted-foreground">
                  or click to choose a file
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
                <img
                  src={imageDataUrl}
                  alt={fileName ?? "image"}
                  className={
                    "max-h-[420px] w-full object-contain transition-all duration-500 " +
                    blurClass
                  }
                />
                {blocked && !revealed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-severity-critical/15 backdrop-blur-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-severity-critical text-severity-critical-foreground shadow-alert animate-pulse-alert">
                      <Ban className="h-7 w-7" />
                    </div>
                    <p className="font-display text-base font-bold text-severity-critical-foreground drop-shadow">
                      Auto-blocked by Mnemosyne
                    </p>
                    <p className="max-w-xs px-4 text-center text-xs text-severity-critical-foreground/90 drop-shadow">
                      {matchedHash
                        ? "Hash matches a known harmful image."
                        : `Risk score ≥ ${(AUTOBLOCK_THRESHOLD * 100).toFixed(0)}/100. Sharing prevented.`}
                    </p>
                    <button
                      onClick={unblock}
                      className="flex items-center gap-1.5 rounded-full border border-primary-foreground/40 bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold text-primary-foreground backdrop-blur hover:bg-primary-foreground/20"
                    >
                      <Eye className="h-3 w-3" />
                      Parent override · reveal
                    </button>
                  </div>
                )}
                {!blocked && result && result.risk_score >= BLUR_THRESHOLD && !revealed && (
                  <button
                    onClick={() => setRevealed(true)}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur hover:bg-card"
                  >
                    <Eye className="h-3 w-3" /> Reveal
                  </button>
                )}
                {revealed && (
                  <button
                    onClick={() => setRevealed(false)}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur hover:bg-card"
                  >
                    <EyeOff className="h-3 w-3" /> Re-blur
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs text-muted-foreground">
                  <ImageIcon className="mr-1 inline h-3 w-3" />
                  {fileName}
                </p>
                <button
                  onClick={analyze}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-elevated transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze with Mnemosyne
                    </>
                  )}
                </button>
              </div>

              {/* Local hash card */}
              {hash && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4 text-primary" />
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Local perceptual hash
                      </p>
                    </div>
                    <button
                      onClick={addToBlocklist}
                      className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      + Block
                    </button>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">
                    {hash}
                  </p>
                  {matchedHash && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-severity-critical/30 bg-severity-critical/5 px-3 py-2 text-xs text-severity-critical">
                      <Lock className="h-3.5 w-3.5" />
                      <span>
                        Match on blocklist · distance {matchedHash.distance} bits
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Blocklist */}
          <div className="mt-4 rounded-xl border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Local blocklist · {blocklist.length}
              </p>
              {blocklist.length > 0 && (
                <button
                  onClick={clearBlocklist}
                  className="text-[10px] font-medium text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
            {blocklist.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add a hash with "+ Block" to simulate a known-harmful image.
                Future near-duplicates will be flagged before any upload.
              </p>
            ) : (
              <ul className="space-y-1">
                {blocklist.map((h) => (
                  <li
                    key={h}
                    className="truncate font-mono text-[11px] text-muted-foreground"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right: results */}
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-gradient-hero px-5 py-4 text-primary-foreground">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                Image analysis
              </p>
              <p className="font-display text-base font-semibold">
                Share-safety verdict
              </p>
            </div>
            {result && <SeverityBadge severity={result.severity} />}
          </div>

          <div className="space-y-4 p-5">
            {!result && !loading && !error && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Drop an image to see Mnemosyne analysis.
                </p>
                <p className="max-w-xs text-xs text-muted-foreground/70">
                  Try a selfie, a photo of a school uniform, or anything you'd
                  rather a child not share publicly.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  Classifying share-safety…
                </p>
                <p className="text-xs text-muted-foreground">
                  Usually under 3 seconds.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Analysis failed
                </p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            )}

            {result && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Category
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {CATEGORY_LABELS[result.category] ?? result.category}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Risk score
                    </p>
                    <p
                      className={
                        "mt-1 font-mono text-sm font-bold " +
                        (result.severity === "critical"
                          ? "text-severity-critical"
                          : result.severity === "medium"
                            ? "text-severity-medium"
                            : "text-severity-low")
                      }
                    >
                      {(result.risk_score * 100).toFixed(0)} / 100
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Subject appears minor
                    </p>
                    <p
                      className={
                        "mt-1 text-sm font-semibold " +
                        (result.subject_appears_minor
                          ? "text-severity-critical"
                          : "text-foreground")
                      }
                    >
                      {result.subject_appears_minor ? "Yes" : "No / unclear"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Nudity detected
                    </p>
                    <p
                      className={
                        "mt-1 text-sm font-semibold " +
                        (result.contains_nudity
                          ? "text-severity-critical"
                          : "text-foreground")
                      }
                    >
                      {result.contains_nudity ? "Yes" : "No"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Why it's flagged
                  </p>
                  <p className="mt-1 text-sm">{result.explanation}</p>
                </div>

                {result.recommended_action && (
                  <div
                    className={
                      "rounded-xl border p-4 " +
                      (result.severity === "critical"
                        ? "border-severity-critical/30 bg-severity-critical/5"
                        : "border-primary/20 bg-primary/5")
                    }
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                      Recommended action
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      → {result.recommended_action}
                    </p>
                  </div>
                )}

                {result.identifying_info?.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Identifying elements
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.identifying_info.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <p className="px-6 pb-8 text-center text-xs text-muted-foreground">
        Privacy-first: hash is computed in your browser; the raw image is
        analyzed in-memory and never stored.
      </p>
    </div>
  );
}
