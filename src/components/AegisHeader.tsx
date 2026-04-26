import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { TrustLayerButton } from "@/components/TrustLayer";

export type AegisHeaderLink = {
  label: string;
  href: string;
};

interface AegisHeaderProps {
  /** Module name shown next to the logo, e.g. "Argus", "Echo". */
  module?: string;
  /** Short tagline below module, e.g. "Live chat detector". */
  tagline?: string;
  /** Optional nav links rendered in the center/right of the header. */
  links?: AegisHeaderLink[];
  /** Show a small "Home" back link instead of the link list. */
  showBackHome?: boolean;
  /** Show the TrustLayer button. */
  showTrust?: boolean;
  /** Slot for additional right-aligned content (e.g. Reset, Fire alert). */
  rightSlot?: React.ReactNode;
}

/**
 * Shared editorial header for all Aegis module pages.
 * Matches the Landing page aesthetic: flat white bar, navy lockup,
 * mono overline tagline, text nav links.
 */
export function AegisHeader({
  module,
  tagline,
  links,
  showBackHome,
  showTrust,
  rightSlot,
}: AegisHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 text-foreground backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
        <Link to="/" className="group flex items-center gap-2.5 text-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground transition-colors group-hover:opacity-90">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-black tracking-tight text-foreground">
              AEGIS
              {module && (
                <span className="ml-2 text-muted-foreground">· {module}</span>
              )}
            </div>
            <div className="overline text-muted-foreground" style={{ fontSize: "0.55rem" }}>
              {tagline ?? "child-safety AI"}
            </div>
          </div>
        </Link>

        {links && links.length > 0 && (
          <nav className="hidden items-center gap-5 lg:flex">
            {links.map((n) => (
              <Link
                key={n.href}
                to={n.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {rightSlot}
          {showTrust && <TrustLayerButton />}
          {showBackHome && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <ArrowLeft className="h-3 w-3" />
              Home
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
