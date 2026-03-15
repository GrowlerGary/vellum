import { MediaItem } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Check if external rating is missing from metadata and fetch it on demand.
 * Updates the MediaItem in the database if a rating is found.
 */
export async function backfillExternalRating(item: MediaItem): Promise<void> {
  const metadata = item.metadata as Record<string, unknown>

  switch (item.type) {
    case 'MOVIE':
    case 'TV_SHOW': {
      if (metadata.rottenTomatoesScore != null) return
      const imdbId = metadata.imdbId as string | undefined
      if (!imdbId) {
        // Try to get IMDB ID from TMDB first
        const tmdbId = metadata.tmdbId ?? item.externalId
        if (!tmdbId) return
        try {
          const { getTmdbDetail } = await import('./tmdb')
          const tmdbType = item.type === 'TV_SHOW' ? 'tv' : 'movie'
          const detail = await getTmdbDetail(String(tmdbId), tmdbType as 'movie' | 'tv')
          if (detail) {
            await db.mediaItem.update({
              where: { id: item.id },
              data: { metadata: { ...metadata, ...detail.metadata } as object },
            })
          }
        } catch (err) {
          console.error('[backfill] TMDB detail fetch failed:', err)
        }
        return
      }
      // Have IMDB ID — just fetch RT score
      try {
        const { fetchRottenTomatoesScore } = await import('./omdb')
        const score = await fetchRottenTomatoesScore(imdbId)
        if (score != null) {
          await db.mediaItem.update({
            where: { id: item.id },
            data: { metadata: { ...metadata, rottenTomatoesScore: score } as object },
          })
        }
      } catch (err) {
        console.error('[backfill] OMDB fetch failed:', err)
      }
      break
    }

    case 'AUDIOBOOK': {
      if (metadata.rating != null) return
      try {
        const { getAudnexusDetail } = await import('./audnexus')
        const detail = await getAudnexusDetail(item.externalId)
        if (detail?.metadata?.rating != null) {
          await db.mediaItem.update({
            where: { id: item.id },
            data: { metadata: { ...metadata, rating: detail.metadata.rating } as object },
          })
        }
      } catch (err) {
        console.error('[backfill] Audnexus fetch failed:', err)
      }
      break
    }

    case 'BOOK': {
      if (metadata.googleBooksRating != null || metadata.hardcoverRating != null) return
      // Try Google Books first
      try {
        const { fetchGoogleBooksRating } = await import('./google-books')
        const authors = metadata.authors as string[] | undefined
        const rating = await fetchGoogleBooksRating(item.title, authors)
        if (rating != null) {
          await db.mediaItem.update({
            where: { id: item.id },
            data: { metadata: { ...metadata, googleBooksRating: rating } as object },
          })
          return
        }
      } catch (err) {
        console.error('[backfill] Google Books fetch failed:', err)
      }
      // Fallback: fetch Hardcover rating
      const hardcoverId = metadata.hardcoverId as number | undefined
      if (hardcoverId) {
        try {
          const { getHardcoverDetail } = await import('./hardcover')
          const detail = await getHardcoverDetail(String(hardcoverId))
          if (detail?.metadata?.hardcoverRating != null) {
            await db.mediaItem.update({
              where: { id: item.id },
              data: { metadata: { ...metadata, hardcoverRating: detail.metadata.hardcoverRating } as object },
            })
          }
        } catch (err) {
          console.error('[backfill] Hardcover rating fetch failed:', err)
        }
      }
      break
    }

    case 'VIDEO_GAME': {
      // IGDB rating is already stored at creation time — nothing to backfill
      break
    }
  }
}
