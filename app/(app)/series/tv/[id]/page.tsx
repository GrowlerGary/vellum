"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { TmdbResult, TmdbSeason, TmdbEpisode } from "@/lib/metadata/tmdb";

interface SeriesData {
  show: TmdbResult;
  seasons: TmdbSeason[];
  watchedEpisodeIds: number[];
}

export default function TvSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const [showId, setShowId] = useState<string | null>(null);
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(new Set());

  useEffect(() => {
    params.then((p) => setShowId(p.id));
  }, [params]);

  useEffect(() => {
    if (!showId) return;
    setLoading(true);
    fetch(`/api/series/tv/${showId}`)
      .then((r) => r.json() as Promise<SeriesData & { error?: string }>)
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setWatched(new Set(d.watchedEpisodeIds));
        // Open the first season by default
        if (d.seasons.length > 0) setOpenSeasons(new Set([d.seasons[0].season_number]));
      })
      .catch(() => setError("Failed to load series."))
      .finally(() => setLoading(false));
  }, [showId]);

  async function toggleEpisode(episode: TmdbEpisode) {
    if (!showId) return;
    const nowWatched = !watched.has(episode.id);
    // Optimistic update
    setWatched((prev) => {
      const next = new Set(prev);
      nowWatched ? next.add(episode.id) : next.delete(episode.id);
      return next;
    });
    await fetch(`/api/series/tv/${showId}/watched`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: episode.id, watched: nowWatched }),
    });
  }

  function toggleSeason(n: number) {
    setOpenSeasons((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function watchedCountForSeason(season: TmdbSeason) {
    return season.episodes.filter((e) => watched.has(e.id)).length;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="py-10 text-center text-sm text-red-600">{error || "Not found."}</div>;
  }

  const { show, seasons } = data;
  const backdrop = show.backdropUrl;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="relative rounded-xl overflow-hidden bg-zinc-900">
        {backdrop && (
          <Image src={backdrop} alt="" fill className="object-cover opacity-30" sizes="100vw" />
        )}
        <div className="relative flex gap-6 p-6">
          {show.posterUrl && (
            <div className="hidden sm:block flex-shrink-0 w-28 aspect-[2/3] relative rounded-md overflow-hidden shadow-lg">
              <Image src={show.posterUrl} alt={show.title} fill className="object-cover" sizes="112px" />
            </div>
          )}
          <div className="flex flex-col gap-2 text-white min-w-0">
            <h1 className="text-2xl font-bold">{show.title}</h1>
            {show.year && <p className="text-sm text-zinc-300">{show.year}</p>}
            {show.overview && (
              <p className="text-sm text-zinc-200 line-clamp-3 max-w-2xl">{show.overview}</p>
            )}
            <p className="text-sm text-zinc-300">
              {seasons.length} season{seasons.length !== 1 ? "s" : ""} ·{" "}
              {seasons.reduce((t, s) => t + s.episodes.length, 0)} episodes
            </p>
          </div>
        </div>
      </div>

      {/* Seasons */}
      <div className="flex flex-col gap-3">
        {seasons.map((season) => {
          const open = openSeasons.has(season.season_number);
          const watchedCount = watchedCountForSeason(season);
          const total = season.episodes.length;
          return (
            <div key={season.season_number} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors"
                onClick={() => toggleSeason(season.season_number)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-zinc-900 truncate">{season.name}</span>
                  {season.air_date && (
                    <span className="text-xs text-zinc-400 flex-shrink-0">
                      {new Date(season.air_date).getFullYear()}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400 flex-shrink-0">{total} episodes</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {watchedCount > 0 && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {watchedCount}/{total} watched
                    </span>
                  )}
                  {open ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </button>

              {open && (
                <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                  {season.episodes.map((ep) => {
                    const isWatched = watched.has(ep.id);
                    return (
                      <div key={ep.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors">
                        <button
                          onClick={() => toggleEpisode(ep)}
                          className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isWatched
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-zinc-300 hover:border-indigo-400"
                          }`}
                        >
                          {isWatched && <Check className="h-3 w-3 text-white" />}
                        </button>
                        {ep.still_path && (
                          <div className="hidden sm:block flex-shrink-0 w-20 aspect-video relative rounded overflow-hidden bg-zinc-100">
                            <Image
                              src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                              alt={ep.name}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-zinc-400 flex-shrink-0">E{ep.episode_number}</span>
                            <span className="text-sm font-medium text-zinc-900 truncate">{ep.name}</span>
                            {ep.runtime && (
                              <span className="text-xs text-zinc-400 flex-shrink-0">{ep.runtime}m</span>
                            )}
                          </div>
                          {ep.air_date && (
                            <span className="text-xs text-zinc-400">
                              {new Date(ep.air_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          )}
                          {ep.overview && (
                            <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{ep.overview}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
