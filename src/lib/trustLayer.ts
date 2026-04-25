// ZeroTrust Control Layer — simulated cryptographic primitives.
// No real keys, no PII. Everything is mocked, signed-looking, and ephemeral.

export type AgeStatus = "minor" | "adult";
export type RiskLevel = "low" | "medium" | "high";

export type TrustCredential = {
  issuer: "RENAPO" | "INE";
  issuedAt: string;
  signature: string; // opaque, mocked
};

export type TrustToken = {
  jti: string;
  iat: number;
  exp: number;
  scope: ("age" | "risk")[];
  age: AgeStatus;
  risk: RiskLevel;
  sig: string; // opaque, mocked
};

export type TrustState = {
  credential: TrustCredential;
  token: TrustToken;
  interactionsAllowed: boolean;
  contentAccess: boolean;
};

const ISSUERS: TrustCredential["issuer"][] = ["RENAPO", "INE"];

function fakeSig(seed: string): string {
  // Deterministic-looking opaque hash; never displayed in raw form.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex}`.slice(0, 16);
}

export function issueCredential(): TrustCredential {
  const issuer = ISSUERS[Math.floor(Math.random() * ISSUERS.length)];
  const issuedAt = new Date().toISOString();
  return {
    issuer,
    issuedAt,
    signature: fakeSig(`${issuer}:${issuedAt}`),
  };
}

export function mintToken(
  credential: TrustCredential,
  age: AgeStatus,
  risk: RiskLevel,
): TrustToken {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 5 * 60; // 5 minutes
  const jti = fakeSig(`${credential.signature}:${iat}:${age}:${risk}`);
  return {
    jti,
    iat,
    exp,
    scope: ["age", "risk"],
    age,
    risk,
    sig: fakeSig(`${jti}:${exp}`),
  };
}

export function isTokenValid(token: TrustToken): boolean {
  return Math.floor(Date.now() / 1000) < token.exp;
}

export type EnforcementDecision = {
  allow: boolean;
  delayMs: number;
  shadowBan: boolean;
  reason?: "high_risk" | "expired";
};

// Silent enforcement: never throws, never alerts.
export function decideEnforcement(token: TrustToken): EnforcementDecision {
  if (!isTokenValid(token)) {
    return { allow: true, delayMs: 0, shadowBan: false, reason: "expired" };
  }
  if (token.risk === "high") {
    return {
      allow: false,
      delayMs: 1200 + Math.floor(Math.random() * 800),
      shadowBan: true,
      reason: "high_risk",
    };
  }
  if (token.risk === "medium") {
    return { allow: true, delayMs: 250, shadowBan: false };
  }
  return { allow: true, delayMs: 0, shadowBan: false };
}
