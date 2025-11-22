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
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground">{formattedDate}</div>

        {interaction.sentiment && (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-foreground">
            {sentimentCopy[interaction.sentiment] ?? interaction.sentiment}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground">Original note</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {interaction.raw_text}
          </p>
        </div>

        {interaction.summary && (
          <div className="rounded-lg border bg-muted/60 p-3 space-y-1">
            <div className="text-xs font-semibold text-foreground">AI summary</div>
            <p className="text-sm text-foreground">{interaction.summary}</p>
          </div>
        )}

        {(steps.follow_up_ideas && steps.follow_up_ideas.length > 0) ||
        (steps.things_to_remember && steps.things_to_remember.length > 0) ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground">
              AI suggestions
            </div>

            {steps.follow_up_ideas && steps.follow_up_ideas.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Follow-up ideas from the AI call
                </div>
                <ul className="list-disc list-inside text-xs text-foreground space-y-1">
                  {steps.follow_up_ideas.map((idea, i) => (
                    <li key={i}>{idea}</li>
                  ))}
                </ul>
              </div>
            )}

            {steps.things_to_remember &&
              steps.things_to_remember.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Things to remember from the AI call
                  </div>
                  <ul className="list-disc list-inside text-xs text-foreground space-y-1">
                    {steps.things_to_remember.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
