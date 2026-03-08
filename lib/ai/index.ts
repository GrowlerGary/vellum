export interface SuggestionInput {
  title: string;
  type: string;
  rating?: number | null;
  status: string | null;
}

export interface AiSuggestionResult {
  title: string;
  type: string;
  year?: number;
  reason: string;
  score: number;
}

export interface AiProvider {
  getSuggestions(
    consumed: SuggestionInput[],
    mediaType: string
  ): Promise<AiSuggestionResult[]>;
}

async function getProvider(): Promise<AiProvider> {
  const provider = process.env.AI_PROVIDER ?? "anthropic";
  switch (provider) {
    case "openai": {
      const { OpenAiProvider } = await import("./openai");
      return new OpenAiProvider();
    }
    case "ollama": {
      const { OllamaProvider } = await import("./ollama");
      return new OllamaProvider();
    }
    default: {
      const { AnthropicProvider } = await import("./anthropic");
      return new AnthropicProvider();
    }
  }
}

export async function getSuggestions(
  consumed: SuggestionInput[],
  mediaType: string
): Promise<AiSuggestionResult[]> {
  const provider = await getProvider();
  return provider.getSuggestions(consumed, mediaType);
}

export function buildSuggestionPrompt(
  consumed: SuggestionInput[],
  mediaType: string
): string {
  const typeLabel = mediaType.replace("_", " ").toLowerCase();
  const list = consumed
    .filter((e) => e.status === "COMPLETED" || e.status === "IN_PROGRESS")
    .slice(0, 40)
    .map((e) => `- "${e.title}" (${e.type})${e.rating ? ` rated ${e.rating}/5` : ""}`)
    .join("\n");

  return `You are a media recommendation assistant. Based on the following ${typeLabel}s the user has consumed, suggest 8 ${typeLabel}s they would enjoy.

User's consumed media:
${list || "No entries yet."}

Return ONLY a valid JSON array (no markdown, no extra text) with this exact format:
[
  {
    "title": "string",
    "type": "${mediaType}",
    "year": 2023,
    "reason": "One sentence explaining why they'd enjoy this",
    "score": 0.95
  }
]

Include a mix of well-known titles and hidden gems. Include upcoming releases if relevant. Score is 0-1 confidence.`;
}

export function parseSuggestions(text: string): AiSuggestionResult[] {
  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as AiSuggestionResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
