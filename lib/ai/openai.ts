import type { AiProvider, SuggestionInput, AiSuggestionResult } from "./index";
import { buildSuggestionPrompt, parseSuggestions } from "./index";

export class OpenAiProvider implements AiProvider {
  async getSuggestions(
    consumed: SuggestionInput[],
    mediaType: string
  ): Promise<AiSuggestionResult[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";

    const prompt = buildSuggestionPrompt(consumed, mediaType);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = data.choices[0]?.message?.content ?? "";
    // OpenAI json_object wraps in an object; try both
    try {
      const parsed = JSON.parse(text) as { suggestions?: AiSuggestionResult[] } | AiSuggestionResult[];
      if (Array.isArray(parsed)) return parsed;
      if (parsed.suggestions) return parsed.suggestions;
      return parseSuggestions(text);
    } catch {
      return parseSuggestions(text);
    }
  }
}
