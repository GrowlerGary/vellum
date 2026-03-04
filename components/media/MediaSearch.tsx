"use client";

import { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { MediaDetailDialog } from "./MediaDetailDialog";
import { MEDIA_TYPE_LABELS } from "@/lib/utils";

interface SearchResult {
  externalId: string;
  source: string;
  mediaType: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  genres: string[];
  metadata: Record<string, unknown>;
}

export function MediaSearch() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string, t: string) => {
    if (q.length < 2) { setResults([]); setWarnings([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (t !== "all") params.set("type", t);
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json() as { results: SearchResult[]; warnings?: string[] };
      setResults(data.results ?? []);
      setWarnings(data.warnings ?? []);
    } catch {
      setResults([]);
      setWarnings(["Search request failed. Please try again."]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value, type), 400);
  }

  function handleTypeChange(value: string) {
    setType(value);
    if (query.length >= 2) search(query, value);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search movies, TV shows, books, games..."
            className="pl-9"
            autoFocus
          />
        </div>
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      )}

      {!loading && results.length === 0 && query.length >= 2 && (
        <p className="text-center text-zinc-500 py-8">No results found.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((r) => (
            <MediaCard
              key={`${r.source}-${r.externalId}`}
              id={r.externalId}
              title={r.title}
              year={r.year}
              posterUrl={r.posterUrl}
              mediaType={r.mediaType}
              onClick={() => setSelected(r)}
            />
          ))}
        </div>
      )}

      {selected && (
        <MediaDetailDialog
          source={selected.source}
          externalId={selected.externalId}
          type={selected.mediaType}
          initialItem={{
            title: selected.title,
            year: selected.year,
            posterUrl: selected.posterUrl,
            backdropUrl: selected.backdropUrl,
            overview: selected.overview,
            genres: selected.genres,
            metadata: selected.metadata,
          }}
          open={!!selected}
          onClose={() => setSelected(null)}
          onSuccess={() => setSelected(null)}
        />
      )}
    </div>
  );
}
