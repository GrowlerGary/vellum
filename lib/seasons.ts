import type { TmdbSeasonData } from '@/lib/metadata/tmdb'

export interface SeasonCacheData {
  seasons: TmdbSeasonData[]
}

/**
 * Derives the show's EntryStatus from episode watch counts.
 * TV show status is computed, not manually set.
 */
export function deriveShowStatus(
  watchCount: number,
  airedCount: number
): 'IN_PROGRESS' | 'COMPLETED' | null {
  if (watchCount === 0 || airedCount === 0) return null
  if (watchCount === airedCount) return 'COMPLETED'
  return 'IN_PROGRESS'
}

/**
 * Counts episodes that have aired on or before the given date string (YYYY-MM-DD).
 * Episodes with null airDate are treated as aired.
 */
export function getAiredEpisodeCount(
  seasons: TmdbSeasonData[],
  todayStr: string
): number {
  return seasons.reduce((total, season) => {
    return total + season.episodes.filter((ep) => {
      if (!ep.airDate) return true
      return ep.airDate <= todayStr
    }).length
  }, 0)
}

/**
 * Merges a newly fetched season into the existing cache data.
 * Replaces the season if it already exists, otherwise appends it.
 */
export function mergeSeasonIntoCache(
  existing: SeasonCacheData,
  newSeason: TmdbSeasonData
): SeasonCacheData {
  const others = existing.seasons.filter((s) => s.number !== newSeason.number)
  const merged = [...others, newSeason].sort((a, b) => a.number - b.number)
  return { seasons: merged }
}

interface EntryWithCounts {
  id: string
  status: string | null
  mediaItem: { type: string; metadata: unknown }
  _count: { episodeWatches: number }
  [key: string]: unknown
}

/**
 * Overrides status for TV_SHOW entries based on episode watch counts.
 * All other media types are returned unchanged.
 */
export function enrichEntriesWithTvStatus<T extends EntryWithCounts>(
  entries: T[],
  airedCountsByEntryId: Map<string, number>
): T[] {
  return entries.map((entry) => {
    if (entry.mediaItem.type !== 'TV_SHOW') return entry
    const airedCount = airedCountsByEntryId.get(entry.id) ?? 0
    const derived = deriveShowStatus(entry._count.episodeWatches, airedCount)
    return { ...entry, status: derived }
  })
}
