import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  decideEnforcement,
  issueCredential,
  mintToken,
  type AgeStatus,
  type EnforcementDecision,
  type RiskLevel,
  type TrustState,
} from "@/lib/trustLayer";

type Ctx = {
  state: TrustState;
  setRisk: (risk: RiskLevel) => void;
  setAge: (age: AgeStatus) => void;
  verify: () => EnforcementDecision;
};

const TrustContext = createContext<Ctx | null>(null);

export function TrustProvider({ children }: { children: ReactNode }) {
  const [age, setAgeState] = useState<AgeStatus>("minor");
  const [risk, setRiskState] = useState<RiskLevel>("low");
  const [credential] = useState(() => issueCredential());
  const [token, setToken] = useState(() => mintToken(credential, "minor", "low"));

  // Re-mint on age/risk change → ephemeral proof.
  useEffect(() => {
    setToken(mintToken(credential, age, risk));
  }, [credential, age, risk]);

  // Auto-refresh token before expiry.
  useEffect(() => {
    const id = setInterval(() => setToken(mintToken(credential, age, risk)), 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [credential, age, risk]);

  const value = useMemo<Ctx>(() => {
    const allowed = risk !== "high";
    return {
      state: {
        credential,
        token,
        interactionsAllowed: allowed,
        contentAccess: allowed,
      },
      setRisk: setRiskState,
      setAge: setAgeState,
      verify: () => decideEnforcement(token),
    };
  }, [credential, token, risk]);

  return <TrustContext.Provider value={value}>{children}</TrustContext.Provider>;
}

export function useTrust() {
  const ctx = useContext(TrustContext);
  if (!ctx) {
    // Safe no-op fallback so components mounted outside provider still work.
    return null;
  }
  return ctx;
}

/** Single button entry point. Uses existing pill style; neutral by default. */
export function TrustLayerButton({ className }: { className?: string }) {
  const ctx = useTrust();
  const [open, setOpen] = useState(false);
  if (!ctx) return null;
  const high = ctx.state.token.risk === "high";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="ZeroTrust Control Layer"
        className={cn(
          "relative flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        Trust Layer
        <span
          className={cn(
            "ml-0.5 inline-block h-1.5 w-1.5 rounded-full",
            high ? "bg-severity-critical" : "bg-primary",
            "animate-pulse",
          )}
          aria-hidden
        />
      </button>
      <TrustLayerPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "info" | "danger" | "muted" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          tone === "info" && "text-primary",
          tone === "danger" && "text-severity-critical underline decoration-severity-critical/60 underline-offset-4",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MicroLabel({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
        tone === "info" && "bg-primary/10 text-primary",
        tone === "danger" && "bg-severity-critical/10 text-severity-critical",
      )}
    >
      {children}
    </span>
  );
}

function TrustLayerPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ctx = useTrust();
  const [, force] = useState(0);
  const tick = useCallback(() => force((n) => n + 1), []);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, tick]);

  if (!ctx) return null;
  const { state, setRisk, setAge } = ctx;
  const { credential, token, interactionsAllowed, contentAccess } = state;
  const issuedRel = new Date(credential.issuedAt).toLocaleString();
  const ageLabel = token.age === "minor" ? "Minor" : "Adult";
  const riskLabel = token.risk[0].toUpperCase() + token.risk.slice(1);
  const high = token.risk === "high";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            ZeroTrust Control Layer
          </DialogTitle>
          <DialogDescription>
            Background verification — no personal data is exposed.
          </DialogDescription>
        </DialogHeader>

        {/* A. Identity Credential */}
        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Identity Credential
            </p>
            <MicroLabel>Signed Credential</MicroLabel>
          </div>
          <p className="text-sm font-semibold text-foreground">Identity Verified</p>
          <p className="text-xs text-muted-foreground">
            Credential issued by authority — Registro Nacional de Población · Instituto Nacional Electoral
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground/60">Issued {issuedRel}</p>
        </section>

        {/* B. Active Proof */}
        <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Active Proof
            </p>
            <MicroLabel>Active</MicroLabel>
          </div>
          <Row label="Verification Token" value="Active" tone="info" />
          <Row label="Scope" value="Age / Risk" tone="muted" />
          <Row label="Age Status" value={`Verified (${ageLabel})`} />
          <Row label="Risk Level" value={riskLabel} tone={high ? "danger" : "muted"} />
          <p className="pt-1 text-[10px] text-muted-foreground/70">
            Ephemeral proof — no personal data shared.
          </p>
        </section>

        {/* C. System Decision Engine */}
        <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            System Decision Engine
          </p>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
            <span>Credential</span>
            <span className="opacity-40">→</span>
            <span>Token</span>
            <span className="opacity-40">→</span>
            <span>Verification</span>
            <span className="opacity-40">→</span>
            <span className={cn(high ? "text-severity-critical" : "text-primary", "font-semibold")}>
              Decision
            </span>
          </div>
          <Row
            label="Interactions"
            value={interactionsAllowed ? "Allowed" : "Restricted"}
            tone={interactionsAllowed ? "muted" : "danger"}
          />
          <Row
            label="Content Access"
            value={contentAccess ? "Enabled" : "Blocked"}
            tone={contentAccess ? "muted" : "danger"}
          />
          {!interactionsAllowed && (
            <div className="pt-1">
              <MicroLabel tone="danger">Policy enforced silently</MicroLabel>
            </div>
          )}
        </section>

        {/* Operator controls — discreet, no new design language */}
        <section className="rounded-xl border border-dashed border-border p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Simulated state (for demo)
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Age:</span>
            {(["minor", "adult"] as AgeStatus[]).map((a) => (
              <button
                key={a}
                onClick={() => setAge(a)}
                className={cn(
                  "rounded-full border px-2 py-0.5 capitalize",
                  token.age === a
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {a}
              </button>
            ))}
            <span className="ml-2 text-muted-foreground">Risk:</span>
            {(["low", "medium", "high"] as RiskLevel[]).map((r) => (
              <button
                key={r}
                onClick={() => setRisk(r)}
                className={cn(
                  "rounded-full border px-2 py-0.5 capitalize",
                  token.risk === r
                    ? r === "high"
                      ? "border-severity-critical/50 bg-severity-critical/10 text-severity-critical"
                      : "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
