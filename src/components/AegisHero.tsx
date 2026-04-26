import type { LucideIcon } from "lucide-react";

interface AegisHeroProps {
  /** Module name e.g. "Echo — initiative #2". */
  eyebrow: string;
  /** Optional icon shown next to the eyebrow. */
  icon?: LucideIcon;
  /** Bold display headline. */
  title: string;
  /** Supporting description paragraph. */
  description: React.ReactNode;
  /** Optional right-side slot (e.g. controls, stats). */
  rightSlot?: React.ReactNode;
}

/**
 * Shared editorial hero strip for module pages.
 * Light grid background, oversized display headline, mono eyebrow —
 * matches the Aegis Landing aesthetic.
 */
export function AegisHero({
  eyebrow,
  icon: Icon,
  title,
  description,
  rightSlot,
}: AegisHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="aegis-grid-bg pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-12 lg:py-16">
        <div className="grid items-end gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-5 flex items-center gap-3">
              {Icon && (
                <span className="grid h-7 w-7 place-items-center rounded-md bg-secondary text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="overline">{eyebrow}</span>
              <span className="h-px w-10 bg-border" />
            </div>
            <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <div className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {description}
            </div>
          </div>
          {rightSlot && (
            <div className="lg:col-span-4">{rightSlot}</div>
          )}
        </div>
      </div>
    </section>
  );
}
