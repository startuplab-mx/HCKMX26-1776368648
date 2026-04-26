import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

/**
 * Live tally of AI spend across all Aegis modules.
 * Reads from the public.ai_usage table populated by edge functions.
 */
export function AiCostMeter() {
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [calls, setCalls] = useState<number>(0);
  const [tokens, setTokens] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error } = await supabase
        .from("ai_usage")
        .select("cost_usd,total_tokens");
      if (!mounted) return;
      if (error || !data) {
        setTotalUsd(0);
        return;
      }
      const cost = data.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
      const tok = data.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0);
      setTotalUsd(cost);
      setCalls(data.length);
      setTokens(tok);
    }
    load();
    const channel = supabase
      .channel("ai_usage_meter")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_usage" },
        load,
      )
      .subscribe();
    const id = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, []);

  const formatted =
    totalUsd === null
      ? "—"
      : totalUsd < 0.01
        ? `$${totalUsd.toFixed(4)}`
        : `$${totalUsd.toFixed(2)}`;

  return (
    <div>
      <div className="overline mb-3 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        AI spend to date
      </div>
      <div className="font-display text-xl font-normal italic leading-none text-foreground">
        {formatted}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Live total across every Aegis AI call.{" "}
        {calls > 0 && (
          <span className="text-muted-foreground/80">
            {calls.toLocaleString()} calls · {(tokens / 1000).toFixed(1)}k tokens.
          </span>
        )}
      </p>
    </div>
  );
}
