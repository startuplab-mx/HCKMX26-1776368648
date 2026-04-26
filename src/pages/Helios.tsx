import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  Upload,
  ImageIcon,
  Loader2,
  ScanText,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import { categoryLabels, type Severity } from "@/lib/utils";
import { SeverityBadge } from "@/components/SeverityBadge";
import { toast } from "sonner";
import { AegisHeader } from "@/components/AegisHeader";
import { AegisHero } from "@/components/AegisHero";

type HeliosResult = {
  extracted_text: string;
  detected_app: string;
  risk_score: number;
  category: string;
  severity: Severity;
  explanation: string;
  recommended_action: string;
  visible_red_flags: string[];
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export default function Helios() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HeliosResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file (PNG / JPG / WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image is larger than 5 MB. Try a smaller screenshot.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setFileName(file.name);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  async function persistCriticalEvent(r: HeliosResult) {
    // Persist Helios critical events into risk_events so the existing
    // database trigger (notify_critical_risk) fires dispatch-critical-alert,
    // which sends the Resend email + Twilio SMS to the parent on file.
    try {
      const { data: existing } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("label", "Helios screen")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let sessionId = existing?.id as string | undefined;
      if (!sessionId) {
        const { data: created, error: cErr } = await supabase
          .from("chat_sessions")
          .insert({ label: "Helios screen" })
          .select("id")
          .single();
        if (cErr) throw cErr;
        sessionId = created.id;
      }

      const { error: insErr } = await supabase.from("risk_events").insert({
        session_id: sessionId!,
        category: r.category,
        severity: r.severity,
        risk_score: r.risk_score,
        explanation: r.explanation,
        recommended_action: r.recommended_action,
        matched_patterns: r.visible_red_flags ?? [],
      });
      if (insErr) throw insErr;
    } catch (e) {
      console.warn("Helios: failed to persist critical event", e);
    }
  }

  async function analyze() {
    if (!imageDataUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-screen",
        { body: { image: imageDataUrl } },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data as HeliosResult);
      const r = data as HeliosResult;
      if (r.severity === "critical") {
        toast.error(`Critical: ${categoryLabels[r.category] ?? r.category}`, {
          description: r.explanation,
        });
        // Fire-and-forget: persist so the DB trigger sends the Resend email + SMS.
        void persistCriticalEvent(r);
      } else if (r.severity === "medium") {
        toast.warning(`Caution: ${categoryLabels[r.category] ?? r.category}`, {
          description: r.explanation,
        });
      } else {
        toast.success("No significant risk detected.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      setError(msg);
      toast.error("Analysis failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImageDataUrl(null);
    setFileName(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-background">
      <AegisHeader
        module="Helios"
        tagline="screen analysis"
        links={[
          { label: "Argus", href: "/demo" },
          { label: "Echo", href: "/echo" },
          { label: "Mnemosyne", href: "/mnemosyne" },
          { label: "Hermes", href: "/hermes" },
          { label: "Aletheia", href: "/aletheia" },
          { label: "Dashboard", href: "/dashboard" },
        ]}
        showTrust
        showBackHome
      />

      <AegisHero
        eyebrow="Helios · the all-seeing sun"
        icon={Eye}
        title="Drop a screenshot. We'll OCR it and classify the risk."
        description={
          <>
            Helios is the OCR + vision layer of Aegis — designed for closed apps
            like Snapchat, Roblox or in-game chats where Argus can't reach. OCR
            works in <strong className="text-foreground">Spanish and English</strong>{" "}
            (including Spanglish). The image is analyzed in-memory and never
            stored.
          </>
        }
      />

      {/* Main */}
      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[1fr_1fr] lg:px-6">
        {/* Left: dropzone / preview */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-base font-semibold">
                Upload a screenshot
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG or WebP · max 5 MB
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elevated">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Drop a screenshot here
                </p>
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
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                <img
                  src={imageDataUrl}
                  alt={fileName ?? "screenshot"}
                  className="max-h-[420px] w-full object-contain"
                />
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
                      Analyze with Helios
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right: results */}
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                Vision analysis
              </p>
              <p className="font-display text-base font-semibold">
                Risk verdict
              </p>
            </div>
            {result && <SeverityBadge severity={result.severity} />}
          </div>

          <div className="space-y-4 p-5">
            {!result && !loading && !error && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Eye className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Upload a screenshot to see Helios analysis.
                </p>
                <p className="max-w-xs text-xs text-muted-foreground/70">
                  Try a chat screenshot, an Instagram DM, a Roblox message — Helios will OCR it and flag risks.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  Reading screen + classifying risk…
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
                {/* Verdict block */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Category
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {categoryLabels[result.category] ?? result.category}
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
                  <div className="col-span-2 rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Detected app
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize">
                      {result.detected_app || "unknown"}
                    </p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Why it's flagged
                  </p>
                  <p className="mt-1 text-sm">{result.explanation}</p>
                </div>

                {/* Recommended action */}
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

                {/* Red flags */}
                {result.visible_red_flags &&
                  result.visible_red_flags.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Visible patterns
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.visible_red_flags.map((flag) => (
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

                {/* OCR text */}
                <details className="rounded-xl border border-border bg-background">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    <ScanText className="h-3.5 w-3.5" />
                    Extracted text (OCR)
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border bg-muted/30 p-4 font-mono text-[11px] leading-relaxed text-foreground">
                    {result.extracted_text || "(no text detected)"}
                  </pre>
                </details>
              </>
            )}
          </div>
        </section>
      </main>

      <p className="px-6 pb-8 text-center text-xs text-muted-foreground">
        Privacy-first: screenshots are analyzed in-memory and never stored.
      </p>
    </div>
  );
}
