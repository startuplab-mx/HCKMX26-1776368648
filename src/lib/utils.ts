import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Severity = "low" | "medium" | "critical";

export const severityCopy: Record<Severity, { label: string; tone: string }> = {
  low: { label: "Low", tone: "Continue monitoring." },
  medium: { label: "Caution", tone: "Review with the minor soon." },
  critical: { label: "Critical", tone: "Act now — alert the parent." },
};

export const categoryLabels: Record<string, string> = {
  grooming: "Grooming",
  sexual_harassment: "Sexual harassment",
  pedophilia_risk: "Pedophilia risk",
  narco_recruitment: "Narco recruitment",
  financial_fraud: "Financial fraud",
  personal_info_extraction: "Personal info extraction",
  sextortion: "Sextortion",
  cyberbullying: "Cyberbullying",
  unsafe_meetup: "Unsafe meetup request",
  drugs_alcohol: "Drugs / alcohol",
  explicit_imagery: "Explicit imagery",
  benign: "Safe",
};
