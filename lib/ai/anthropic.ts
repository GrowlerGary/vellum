import type { AiProvider, SuggestionInput, AiSuggestionResult } from "./index";
import { buildSuggestionPrompt, parseSuggestions } from "./index";

export class AnthropicProvider implements AiProvider {
  async getSuggestions(
    consumed: SuggestionInput[],
    mediaType: string
  ): Promise<AiSuggestionResult[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const prompt = buildSuggestionPrompt(consumed, mediaType);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const text = data.content.find((c) => c.type === "text")?.text ?? "";
    return parseSuggestions(text);
  }
}
