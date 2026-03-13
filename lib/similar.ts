import { db } from '@/lib/db'
import { getSimilarTmdb } from '@/lib/metadata/tmdb'
import { getSimilarIgdb } from '@/lib/metadata/igdb'
import { getSimilarHardcover } from '@/lib/metadata/hardcover'
import { getSimilarAudnexus } from '@/lib/metadata/audnexus'

const CACHE_TTL_DAYS = 7

// Normalised shape stored in SimilarItemCache.results
export interface SimilarItem {
  externalId: string
  source: string
  mediaType: string
  title: string
  year: number | null
  posterUrl: string | null
  overview: string
  genres: string[]
}

export type SimilarSource = 'cache' | 'fresh' | 'none'

export interface SimilarResult {
  items: SimilarItem[]
  source: SimilarSource
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
}

async function fetchFromSource(
  externalId: string,
  mediaSource: string,
  mediaType: string
): Promise<SimilarItem[]> {
  switch (mediaSource) {
    case 'TMDB': {
      const tmdbType = mediaType === 'MOVIE' ? 'movie' : 'tv'
      const results = await getSimilarTmdb(externalId, tmdbType)
      return results.map((r) => ({
        externalId: r.externalId,
        source: 'TMDB',
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    case 'IGDB': {
      const results = await getSimilarIgdb(externalId)
      return results.map((r) => ({
        externalId: r.externalId,
        source: 'IGDB',
        mediaType: 'VIDEO_GAME',
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    case 'HARDCOVER': {
      const results = await getSimilarHardcover(externalId)
      return results.map((r) => ({
        externalId: r.externalId,
        source: 'HARDCOVER',
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    case 'AUDNEXUS': {
      const results = await getSimilarAudnexus(externalId)
      return results.map((r) => ({
        externalId: r.externalId,
        source: 'AUDNEXUS',
        mediaType: 'AUDIOBOOK',
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    default:
      return []
  }
}

async function fetchByTitleFallback(
  title: string,
  mediaType: string
): Promise<SimilarItem[]> {
  // For MANUAL / AUDIOBOOKSHELF items: do a title-based search on the likely source
  try {
    if (mediaType === 'AUDIOBOOK') {
      const { searchAudnexus } = await import('@/lib/metadata/audnexus')
      const results = await searchAudnexus(title)
      return results.map((r) => ({
        externalId: r.externalId,
        source: 'AUDNEXUS',
        mediaType: 'AUDIOBOOK',
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    if (mediaType === 'BOOK') {
      const results = await getSimilarHardcover(title) // title-based fallback
      return results.map((r) => ({
        externalId: r.externalId,
        source: 'HARDCOVER',
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    if (mediaType === 'MOVIE' || mediaType === 'TV_SHOW') {
      const { searchTmdb } = await import('@/lib/metadata/tmdb')
      const results = await searchTmdb(title)
      return results.slice(0, 8).map((r) => ({
        externalId: r.externalId,
        source: 'TMDB',
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
    if (mediaType === 'VIDEO_GAME') {
      const { searchIgdb } = await import('@/lib/metadata/igdb')
      const results = await searchIgdb(title)
      return results.slice(0, 8).map((r) => ({
        externalId: r.externalId,
        source: 'IGDB',
        mediaType: 'VIDEO_GAME',
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        overview: r.overview,
        genres: r.genres,
      }))
    }
  } catch {
    // ignore — fallback to empty
  }
  return []
}

export async function getSimilarItems(mediaItemId: string): Promise<SimilarResult> {
  const item = await db.mediaItem.findUnique({ where: { id: mediaItemId } })
  if (!item) return { items: [], source: 'none' }

  // Check cache first
  const cached = await db.similarItemCache.findUnique({ where: { mediaItemId } })
  if (cached && daysSince(cached.fetchedAt) < CACHE_TTL_DAYS) {
    return { items: cached.results as unknown as SimilarItem[], source: 'cache' }
  }

  // Strategy 1: direct similar lookup from source API
  let results = await fetchFromSource(item.externalId, item.source, item.type)

  // Strategy 2: title-based search fallback for MANUAL / AUDIOBOOKSHELF
  if (results.length === 0 && (item.source === 'MANUAL' || item.source === 'AUDIOBOOKSHELF')) {
    results = await fetchByTitleFallback(item.title, item.type)
  }

  // Cache whatever we got (including empty to avoid hammering APIs)
  const jsonResults = results as unknown as Parameters<typeof db.similarItemCache.upsert>[0]['create']['results']
  await db.similarItemCache.upsert({
    where: { mediaItemId },
    create: { mediaItemId, results: jsonResults, fetchedAt: new Date() },
    update: { results: jsonResults, fetchedAt: new Date() },
  })

  return { items: results, source: results.length > 0 ? 'fresh' : 'none' }
}
