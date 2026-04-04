'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'

interface Episode {
  number: number
  title: string
  airDate: string | null
  overview: string
  watchedAt: string | null
  isFuture: boolean
}

interface Season {
  number: number
  name: string
  episodes: Episode[]
}

interface SeasonsResponse {
  seasons: Season[]
  watchCount: number
}

interface SeasonSectionProps {
  mediaItemId: string
  numberOfSeasons: number
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
      <div className="h-full bg-zinc-700 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

function EpisodeRow({
  episode,
  seasonNumber,
  mediaItemId,
  onToggle,
  onMarkUpTo,
}: {
  episode: Episode
  seasonNumber: number
  mediaItemId: string
  onToggle: (season: number, ep: number, watched: boolean) => void
  onMarkUpTo: (season: number, ep: number) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
        episode.isFuture ? 'opacity-40' : 'hover:bg-zinc-50'
      }`}
    >
      <span className="text-xs text-zinc-400 w-6 text-right flex-shrink-0">
        {episode.number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 truncate">{episode.title}</p>
        {episode.airDate && (
          <p className="text-xs text-zinc-400">
            {new Date(episode.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!episode.isFuture && (
          <>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-1 text-zinc-400 hover:text-zinc-600 text-xs"
                aria-label="More options"
              >
                ···
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 z-10 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 w-48">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50"
                    onClick={() => {
                      onMarkUpTo(seasonNumber, episode.number)
                      setMenuOpen(false)
                    }}
                  >
                    Mark all up to here as seen
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => onToggle(seasonNumber, episode.number, !episode.watchedAt)}
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                episode.watchedAt
                  ? 'bg-zinc-800 border-zinc-800 text-white'
                  : 'border-zinc-300 hover:border-zinc-500'
              }`}
              aria-label={episode.watchedAt ? 'Mark as unseen' : 'Mark as seen'}
            >
              {episode.watchedAt && <Check className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function SeasonSection({ mediaItemId, numberOfSeasons }: SeasonSectionProps) {
  const [seasonsData, setSeasonsData] = useState<Record<number, Season>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<number | null>(null)

  // Auto-expand season 1 on mount
  useEffect(() => {
    setExpanded(1)
  }, [])

  // Fetch season data when a season is expanded
  useEffect(() => {
    if (expanded === null || seasonsData[expanded]) return

    setLoading((l) => ({ ...l, [expanded]: true }))
    fetch(`/api/media-items/${mediaItemId}/seasons?season=${expanded}`)
      .then((r) => r.json())
      .then((data: SeasonsResponse) => {
        setSeasonsData((prev) => {
          const next = { ...prev }
          for (const s of data.seasons) {
            next[s.number] = s
          }
          return next
        })
      })
      .finally(() => setLoading((l) => ({ ...l, [expanded]: false })))
  }, [expanded, mediaItemId, seasonsData])

  const handleToggle = async (season: number, episode: number, markWatched: boolean) => {
    const method = markWatched ? 'POST' : 'DELETE'
    await fetch(`/api/media-items/${mediaItemId}/episodes/watch`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, episode }),
    })

    // Optimistically update local state
    setSeasonsData((prev) => {
      const s = prev[season]
      if (!s) return prev
      return {
        ...prev,
        [season]: {
          ...s,
          episodes: s.episodes.map((ep) =>
            ep.number === episode
              ? { ...ep, watchedAt: markWatched ? new Date().toISOString() : null }
              : ep
          ),
        },
      }
    })
  }

  const handleMarkUpTo = async (season: number, episode: number) => {
    await fetch(`/api/media-items/${mediaItemId}/episodes/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, episode, markUpTo: true }),
    })

    // Re-fetch this season to reflect updated state
    const res = await fetch(`/api/media-items/${mediaItemId}/seasons?season=${season}`)
    const data: SeasonsResponse = await res.json()
    setSeasonsData((prev) => {
      const next = { ...prev }
      for (const s of data.seasons) {
        next[s.number] = s
      }
      return next
    })
  }

  const seasonNumbers = Array.from({ length: numberOfSeasons }, (_, i) => i + 1)

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-zinc-900">Episodes</h2>
      <div className="space-y-1">
        {seasonNumbers.map((num) => {
          const season = seasonsData[num]
          const isExpanded = expanded === num
          const isLoading = loading[num]
          const watchedCount = season?.episodes.filter((e) => e.watchedAt).length ?? 0
          const totalCount = season?.episodes.length ?? 0

          return (
            <div key={num} className="border border-zinc-200 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : num)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                )}
                <span className="font-medium text-sm text-zinc-900 flex-1 text-left">
                  {season?.name ?? `Season ${num}`}
                </span>
                {season && (
                  <div className="flex items-center gap-2">
                    <ProgressBar value={watchedCount} max={totalCount} />
                    <span className="text-xs text-zinc-400 w-12 text-right">
                      {watchedCount} / {totalCount}
                    </span>
                  </div>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-100 bg-white px-2 py-1">
                  {isLoading ? (
                    <p className="text-sm text-zinc-400 text-center py-4">Loading episodes…</p>
                  ) : season ? (
                    season.episodes.map((ep) => (
                      <EpisodeRow
                        key={ep.number}
                        episode={ep}
                        seasonNumber={num}
                        mediaItemId={mediaItemId}
                        onToggle={handleToggle}
                        onMarkUpTo={handleMarkUpTo}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400 text-center py-4">No episode data available.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
