import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Mic,
  Square,
  Loader2,
  Sparkles,
  AlertTriangle,
  Volume2,
  Upload,
  Trash2,
  Languages,
  Users,
} from "lucide-react";
import { categoryLabels, type Severity } from "@/lib/utils";
import { SeverityBadge } from "@/components/SeverityBadge";
import { toast } from "sonner";

type EchoResult = {
  transcript: string;
  detected_language: string;
  speaker_count: number;
  likely_adult_speaker: boolean;
  dominant_tone: string;
  risk_score: number;
  category: string;
  severity: Severity;
  explanation: string;
  recommended_action: string;
  audio_red_flags: string[];
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_SECONDS = 60;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function Echo() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string>("audio/webm");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EchoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioMime(blob.type || "audio/webm");
        const dataUrl = await blobToDataUrl(blob);
        setAudioDataUrl(dataUrl);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      setAudioUrl(null);
      setAudioDataUrl(null);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Microphone permission denied.";
      setError(msg);
      toast.error("Cannot record", { description: msg });
    }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please choose an audio file (MP3, WAV, WebM, OGG, M4A).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Audio is larger than 10 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioMime(file.type);
    const dataUrl = await blobToDataUrl(file);
    setAudioDataUrl(dataUrl);
    setResult(null);
    setError(null);
  }, []);

  function reset() {
    setAudioUrl(null);
    setAudioDataUrl(null);
    setResult(null);
    setError(null);
    setSeconds(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze() {
    if (!audioDataUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-audio",
        { body: { audio: audioDataUrl, mime: audioMime } },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const r = data as EchoResult;
      setResult(r);
      if (r.severity === "critical") {
        toast.error(`Critical: ${categoryLabels[r.category] ?? r.category}`, {
          description: r.explanation,
        });
      } else if (r.severity === "medium") {
        toast.warning(`Caution: ${categoryLabels[r.category] ?? r.category}`, {
          description: r.explanation,
        });
      } else {
        toast.success("No significant voice risk detected.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      setError(msg);
      toast.error("Analysis failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

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
                Echo · Voice analysis
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/mnemosyne"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Mnemosyne (image)
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
            <Mic className="h-3 w-3" />
            Echo — initiative #2
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
            Hear what's happening on the headset.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
            Echo is the voice layer of Aegis — designed for game voice chats,
            Discord calls and voice notes where Argus can't read messages. It
            transcribes, detects adult-to-minor patterns, and classifies risk.
          </p>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[1fr_1fr] lg:px-6">
        {/* Left: recorder / upload */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-base font-semibold">
                Record or upload audio
              </p>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_SECONDS}s recording · 10 MB upload
              </p>
            </div>
            {audioUrl && (
              <button
                onClick={reset}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {/* Recorder */}
          <div className="rounded-xl border border-border bg-muted/30 p-6">
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={
                  "flex h-24 w-24 items-center justify-center rounded-full text-primary-foreground shadow-elevated transition-transform hover:scale-105 " +
                  (recording
                    ? "bg-gradient-alert animate-pulse-alert"
                    : "bg-gradient-shield")
                }
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                {recording ? (
                  <Square className="h-8 w-8" fill="currentColor" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold">
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recording
                    ? "Recording… click to stop"
                    : "Click the mic to record (max 60s)"}
                </p>
              </div>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground">
              <Upload className="h-4 w-4" />
              Upload an audio file
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
          </div>

          {/* Playback + analyze */}
          {audioUrl && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3">
                <Volume2 className="h-4 w-4 shrink-0 text-primary" />
                <audio src={audioUrl} controls className="h-10 w-full" />
              </div>
              <button
                onClick={analyze}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elevated transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transcribing & analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze with Echo
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Right: results */}
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-gradient-hero px-5 py-4 text-primary-foreground">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                Voice analysis
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
                <Mic className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Record or upload audio to see Echo analysis.
                </p>
                <p className="max-w-xs text-xs text-muted-foreground/70">
                  Try a roleplay grooming line in Spanish or English — Echo
                  will transcribe, detect adult vs. minor voices and flag risk.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  Transcribing + classifying voice risk…
                </p>
                <p className="text-xs text-muted-foreground">
                  Usually under 5 seconds.
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
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-3 w-3" /> Speakers
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {result.speaker_count}
                      {result.likely_adult_speaker && (
                        <span className="ml-2 rounded-full bg-severity-critical/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-severity-critical">
                          adult voice
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <Languages className="h-3 w-3" /> Language · tone
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize">
                      {result.detected_language} · {result.dominant_tone}
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

                {result.audio_red_flags?.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Voice patterns
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.audio_red_flags.map((flag) => (
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

                <details className="rounded-xl border border-border bg-background">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    <Volume2 className="h-3.5 w-3.5" />
                    Transcript
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border bg-muted/30 p-4 font-mono text-[11px] leading-relaxed text-foreground">
                    {result.transcript || "(no speech detected)"}
                  </pre>
                </details>
              </>
            )}
          </div>
        </section>
      </main>

      <p className="px-6 pb-8 text-center text-xs text-muted-foreground">
        Privacy-first: audio is analyzed in-memory and never stored.
      </p>
    </div>
  );
}
