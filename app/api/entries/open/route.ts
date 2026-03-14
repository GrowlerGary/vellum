import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { getTmdbDetail } from '@/lib/metadata/tmdb'
import { getHardcoverDetail } from '@/lib/metadata/hardcover'
import { getAudnexusDetail } from '@/lib/metadata/audnexus'
import { getIgdbDetail } from '@/lib/metadata/igdb'

const openSchema = z.object({
  source: z.enum(['TMDB', 'IGDB', 'HARDCOVER', 'MANUAL', 'AUDIOBOOKSHELF', 'AUDNEXUS']),
  externalId: z.string().min(1),
  mediaType: z.enum(['MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME']),
  title: z.string().min(1),
  year: z.number().nullable().optional(),
  posterUrl: z.string().nullable().optional(),
  overview: z.string().optional(),
  genres: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = openSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { source, externalId, mediaType, title, year, posterUrl, overview, genres } = parsed.data

  // Fetch rich metadata from the provider (director, cast, authors, narrators, pages, etc.)
  let metadata: Record<string, unknown> = {}
  try {
    let detail
    switch (source) {
      case 'TMDB': {
        const tmdbType = mediaType === 'TV_SHOW' ? 'tv' : 'movie'
        detail = await getTmdbDetail(externalId, tmdbType)
        break
      }
      case 'HARDCOVER':
        detail = await getHardcoverDetail(externalId)
        break
      case 'AUDNEXUS':
        detail = await getAudnexusDetail(externalId)
        break
      case 'IGDB':
        detail = await getIgdbDetail(externalId)
        break
    }
    if (detail) {
      metadata = detail.metadata as Record<string, unknown>
    }
  } catch (err) {
    console.error('[entries/open] metadata enrichment failed:', err)
  }

  // Upsert the MediaItem — enrich with full metadata on create, update cosmetic fields only
  const mediaItem = await db.mediaItem.upsert({
    where: { source_externalId_type: { source, externalId, type: mediaType } },
    create: {
      source,
      externalId,
      type: mediaType,
      title,
      year: year ?? null,
      posterUrl: posterUrl ?? null,
      overview: overview ?? '',
      genres: genres ?? [],
      metadata,
    },
    update: {
      title,
      posterUrl: posterUrl ?? null,
      metadata,
    },
    select: { id: true },
  })

  // Check if user already has an entry for this item
  const existing = await db.mediaEntry.findUnique({
    where: { userId_mediaItemId: { userId: session.user.id, mediaItemId: mediaItem.id } },
    select: { id: true },
  })

  return NextResponse.json({
    itemId: mediaItem.id,
    entryId: existing?.id ?? null,
  })
}
