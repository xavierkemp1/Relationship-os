import { useMemo } from "react";

export type InteractionCardProps = {
  interaction: {
    id: string;
    happened_at: string;
    raw_text: string;
    summary: string | null;
    sentiment: string | null;
    ai_next_steps: {
      follow_up_ideas?: string[];
      things_to_remember?: string[];
    } | null;
  };
};

const sentimentCopy: Record<string, string> = {
  positive: "😊 Positive",
  neutral: "😐 Neutral",
  negative: "😕 Negative",
};

export function InteractionCard({ interaction }: InteractionCardProps) {
  const steps = interaction.ai_next_steps ?? {};
  const formattedDate = useMemo(
    () => new Date(interaction.happened_at).toLocaleString(),
    [interaction.happened_at]
  );

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-background">
      <div className="text-xs text-muted-foreground">{formattedDate}</div>

      {interaction.summary ? (
        <p className="text-sm text-foreground">{interaction.summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {interaction.raw_text}
        </p>
      )}

      {interaction.sentiment && (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-foreground">
          {sentimentCopy[interaction.sentiment] ?? interaction.sentiment}
        </span>
      )}

      {steps.follow_up_ideas && steps.follow_up_ideas.length > 0 && (
        <div className="mt-1 space-y-1">
          <div className="text-xs font-semibold text-foreground">
            Suggested next steps
          </div>
          <ul className="list-disc list-inside text-xs text-foreground space-y-1">
            {steps.follow_up_ideas.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ul>
        </div>
      )}

      {steps.things_to_remember && steps.things_to_remember.length > 0 && (
        <div className="mt-1 space-y-1">
          <div className="text-xs font-semibold text-foreground">
            Things to remember
          </div>
          <ul className="list-disc list-inside text-xs text-foreground space-y-1">
            {steps.things_to_remember.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
