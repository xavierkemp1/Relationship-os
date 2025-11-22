import { supabase } from "./supabaseClient";

export type Sentiment = "positive" | "neutral" | "negative";

export type AiNextSteps = {
  follow_up_ideas: string[];
  things_to_remember: string[];
};

export async function createInteractionWithAI(personId: string, rawText: string) {
  // 1) Insert base interaction
  const { data: inserted, error: insertError } = await supabase
    .from("interactions")
    .insert({
      person_id: personId,
      raw_text: rawText,
      happened_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !inserted) {
    console.error("Failed to insert interaction", insertError);
    throw insertError;
  }

  const interactionId = inserted.id;

  // 2) Call edge function for AI insights
  const { data: aiData, error: aiError } = await supabase.functions.invoke(
    "interaction-insights",
    {
      body: { rawText },
    }
  );

  if (aiError) {
    console.error("AI error:", aiError);
    // We still keep the interaction; just return the base one
    return inserted;
  }

  const {
    summary,
    sentiment,
    follow_up_ideas,
    things_to_remember,
  } = aiData as {
    summary: string;
    sentiment: Sentiment;
    follow_up_ideas: string[];
    things_to_remember: string[];
  };

  // 3) Update interaction with AI fields
  const { data: updated, error: updateError } = await supabase
    .from("interactions")
    .update({
      summary,
      sentiment,
      ai_next_steps: {
        follow_up_ideas,
        things_to_remember,
      },
    })
    .eq("id", interactionId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("Failed to update interaction with AI data", updateError);
    // fallback: return original
    return inserted;
  }

  return updated;
}
