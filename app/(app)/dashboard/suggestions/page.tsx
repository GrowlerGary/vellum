"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEDIA_TYPE_LABELS } from "@/lib/utils";
import { AddEntryDialog } from "@/components/media/AddEntryDialog";

interface SuggestionItem {
  id: string;
  reason: string;
  score: number | null;
  mediaItem: {
    id: string;
    title: string;
    type: string;
    year: number | null;
    posterUrl: string | null;
    overview: string;
    externalId: string;
    source: string;
    genres: string[];
    metadata: Record<string, unknown>;
  };
}

export default function SuggestionsPage() {
  const [mediaType, setMediaType] = useState("MOVIE");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SuggestionItem | null>(null);

  async function fetchSuggestions(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type: mediaType });
      if (refresh) params.set("refresh", "true");
      const res = await fetch(`/api/suggestions?${params}`);
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to fetch");
      }
      const data = await res.json() as { suggestions: SuggestionItem[]; cached: boolean };
      setSuggestions(data.suggestions);
      setCached(data.cached);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suggestions.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSuggestions(); }, [mediaType]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h1 className="text-2xl font-bold text-zinc-900">AI Suggestions</h1>
          {cached && <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">cached</span>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={mediaType} onValueChange={setMediaType}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchSuggestions(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error.includes("not set") ? (
            <p>AI provider not configured. Set <code className="font-mono">AI_PROVIDER</code> and the corresponding API key in your environment.</p>
          ) : error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-zinc-500">Generating suggestions based on your history...</p>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-zinc-900 leading-tight">{s.mediaItem.title}</h3>
                {s.mediaItem.year && (
                  <span className="text-xs text-zinc-400 shrink-0">{s.mediaItem.year}</span>
                )}
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed">{s.reason}</p>
              {s.score != null && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 rounded-full bg-indigo-400"
                    style={{ width: `${Math.round(s.score * 100)}%`, maxWidth: "100%" }}
                  />
                  <span className="text-xs text-zinc-400">{Math.round(s.score * 100)}% match</span>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => setSelected(s)}
              >
                Add to my list
              </Button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <AddEntryDialog
          item={{
            externalId: selected.mediaItem.externalId,
            source: selected.mediaItem.source,
            mediaType: selected.mediaItem.type,
            title: selected.mediaItem.title,
            year: selected.mediaItem.year,
            posterUrl: selected.mediaItem.posterUrl,
            backdropUrl: null,
            overview: selected.mediaItem.overview,
            genres: selected.mediaItem.genres,
            metadata: selected.mediaItem.metadata,
          }}
          open={!!selected}
          onClose={() => setSelected(null)}
          onSuccess={() => setSelected(null)}
        />
      )}
    </div>
  );
}
