import type { AiProvider, SuggestionInput, AiSuggestionResult } from "./index";
import { buildSuggestionPrompt, parseSuggestions } from "./index";

export class OllamaProvider implements AiProvider {
  async getSuggestions(
    consumed: SuggestionInput[],
    mediaType: string
  ): Promise<AiSuggestionResult[]> {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL ?? "llama3";

    const prompt = buildSuggestionPrompt(consumed, mediaType);

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    const data = await res.json() as { response?: string };
    return parseSuggestions(data.response ?? "");
  }
}
