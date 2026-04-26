import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlayCircle, Sparkles, Loader2 } from "lucide-react";
import { SCENARIOS, type DemoScenario, getScenario } from "@/lib/scenarios";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  busy: boolean;
  onSendStranger: (text: string, persona?: string) => Promise<void> | void;
};

export function ScenarioControls({ busy, onSendStranger }: Props) {
  const [scenarios, setScenarios] = useState<DemoScenario[]>(SCENARIOS);
  const [selectedId, setSelectedId] = useState<string>("");
  const [step, setStep] = useState(0);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const current = getScenarioFromList(scenarios, selectedId);

  function getScenarioFromList(list: DemoScenario[], id: string) {
    return list.find((s) => s.id === id) ?? getScenario(id);
  }

  async function handleNext() {
    if (!current) return;
    if (step >= current.messages.length) {
      toast.info("Scenario complete", { duration: 1500 });
      return;
    }
    const msg = current.messages[step];
    setStep((n) => n + 1);
    await onSendStranger(msg, current.persona);
  }

  function onChange(id: string) {
    setSelectedId(id);
    setStep(0);
  }

  async function generateAi() {
    const topic = aiTopic.trim();
    if (!topic || aiBusy) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-scenario",
        { body: { topic } },
      );
      if (error) throw error;
      if (!data?.messages?.length) throw new Error("Empty scenario");
      const sc: DemoScenario = {
        id: data.id,
        title: data.title,
        description: data.description,
        persona: data.persona,
        messages: data.messages,
      };
      setScenarios((prev) => [sc, ...prev]);
      setSelectedId(sc.id);
      setStep(0);
      setAiTopic("");
      toast.success(`Generated: ${sc.title}`, {
        description: `${sc.messages.length} messages ready to play`,
      });
    } catch (e) {
      toast.error("Could not generate scenario", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="overline mr-1 text-muted-foreground">
          Demo scenario
        </span>
        <Select value={selectedId} onValueChange={onChange}>
          <SelectTrigger className="h-9 w-[240px] bg-background">
            <SelectValue placeholder="Pick a scenario…" />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!selectedId || busy}
          onClick={handleNext}
          className="h-9"
        >
          <PlayCircle className="mr-1.5 h-4 w-4" />
          Send next message
        </Button>
        {current && (
          <span className="overline ml-auto text-muted-foreground">
            step {step}/{current.messages.length}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <span className="overline mr-1 text-muted-foreground">AI generate</span>
        <input
          value={aiTopic}
          onChange={(e) => setAiTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generateAi();
          }}
          placeholder="e.g. fake modeling agency recruiting minors"
          className="h-9 flex-1 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!aiTopic.trim() || aiBusy}
          onClick={generateAi}
          className="h-9"
        >
          {aiBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          Generate
        </Button>
      </div>

      {current?.description && (
        <p className="mt-2 text-xs text-muted-foreground">
          {current.description}
        </p>
      )}
    </div>
  );
}
