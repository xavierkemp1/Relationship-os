import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai@v4.50.0/mod.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== "string") {
      return new Response(
        JSON.stringify({ error: "rawText is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // or your exact model ID
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You summarise relationship interactions and suggest kind, practical next steps.",
        },
        {
          role: "user",
          content: `
Here are notes about an interaction I had with someone:

${rawText}

Return STRICT JSON with these exact keys:
- summary: short 2–4 sentence summary
- sentiment: "positive" | "neutral" | "negative"
- follow_up_ideas: list of 2–5 concrete things I could do next
- things_to_remember: list of 2–5 details or preferences to keep in mind
          `,
        },
      ],
    });

    const json = completion.choices[0].message.content ?? "{}";
    const data = JSON.parse(json);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("interaction-insights error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
