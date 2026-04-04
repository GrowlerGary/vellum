import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTmdbSeason } from '@/lib/metadata/tmdb'
import { mergeSeasonIntoCache, getAiredEpisodeCount, type SeasonCacheData } from '@/lib/seasons'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: mediaItemId } = await params
  const { searchParams } = req.nextUrl
  const seasonNumber = searchParams.get('season') ? Number(searchParams.get('season')) : null

  // Verify the media item exists and belongs to user's library
  const mediaItem = await db.mediaItem.findUnique({
    where: { id: mediaItemId },
    include: { seasonCache: true },
  })
  if (!mediaItem) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mediaItem.type !== 'TV_SHOW') {
    return NextResponse.json({ error: 'Not a TV show' }, { status: 400 })
  }

  const metadata = mediaItem.metadata as Record<string, unknown>
  const tmdbId = String(metadata.tmdbId ?? mediaItem.externalId)
  const showEnded = (metadata.status as string | undefined) === 'Ended'

  let cacheData: SeasonCacheData = (mediaItem.seasonCache?.data as unknown as SeasonCacheData) ?? { seasons: [] }
  const cacheAge = mediaItem.seasonCache
    ? Date.now() - new Date(mediaItem.seasonCache.fetchedAt).getTime()
    : Infinity

  // Fetch from TMDB if the requested season is missing or cache is stale
  if (seasonNumber !== null) {
    const hasSeason = cacheData.seasons.some((s) => s.number === seasonNumber)
    const isStale = !showEnded && cacheAge > CACHE_TTL_MS

    if (!hasSeason || isStale) {
      const fetched = await getTmdbSeason(tmdbId, seasonNumber)
      if (fetched) {
        cacheData = mergeSeasonIntoCache(cacheData, fetched)
        await db.seasonCache.upsert({
          where: { mediaItemId },
          create: { mediaItemId, data: cacheData as object, fetchedAt: new Date() },
          update: { data: cacheData as object, fetchedAt: new Date() },
        })
      }
    }
  }

  // Fetch user's watches for this item
  const watches = await db.episodeWatch.findMany({
    where: { userId: session.user.id, mediaItemId },
    select: { season: true, episode: true, watchedAt: true },
  })
  const watchMap = new Map(
    watches.map((w) => [`${w.season}:${w.episode}`, w.watchedAt.toISOString()])
  )

  // Annotate each episode with watchedAt
  const today = new Date().toISOString().split('T')[0]
  const annotatedSeasons = cacheData.seasons.map((s) => ({
    ...s,
    episodes: s.episodes.map((ep) => ({
      ...ep,
      watchedAt: watchMap.get(`${s.number}:${ep.number}`) ?? null,
      isFuture: ep.airDate !== null && ep.airDate > today,
    })),
  }))

  const airedCount = getAiredEpisodeCount(cacheData.seasons, today)

  return NextResponse.json({ seasons: annotatedSeasons, watchCount: watches.length, airedCount })
}
