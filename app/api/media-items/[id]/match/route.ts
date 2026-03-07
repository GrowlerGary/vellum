import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const matchSchema = z.object({
  source: z.enum(['TMDB', 'IGDB', 'HARDCOVER']),
  externalId: z.string().min(1),
  fields: z.object({
    title: z.boolean().optional(),
    year: z.boolean().optional(),
    posterUrl: z.boolean().optional(),
    backdropUrl: z.boolean().optional(),
    overview: z.boolean().optional(),
    genres: z.boolean().optional(),
    metadata: z.boolean().optional(),
  }),
  externalData: z.record(z.string(), z.unknown()),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await request.json()
  const parsed = matchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Verify the requesting user owns an entry for this media item
  const entry = await db.mediaEntry.findFirst({
    where: { mediaItemId: id, userId: session.user.id },
  })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const item = await db.mediaItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Media item not found' }, { status: 404 })

  // Build update from selected fields
  const updateData: Record<string, unknown> = {
    source: parsed.data.source,
    externalId: parsed.data.externalId,
  }

  // Preserve ABS library item ID if this item originated from Audiobookshelf
  if (item.source === 'AUDIOBOOKSHELF') {
    updateData.absLibraryItemId = item.externalId
  }

  const ext = parsed.data.externalData
  if (parsed.data.fields.title) updateData.title = ext.title
  if (parsed.data.fields.year) updateData.year = ext.year
  if (parsed.data.fields.posterUrl) updateData.posterUrl = ext.posterUrl
  if (parsed.data.fields.backdropUrl) updateData.backdropUrl = ext.backdropUrl
  if (parsed.data.fields.overview) updateData.overview = ext.overview
  if (parsed.data.fields.genres) updateData.genres = ext.genres
  if (parsed.data.fields.metadata) updateData.metadata = ext.metadata

  const updated = await db.mediaItem.update({
    where: { id },
    data: updateData,
  })

  // Invalidate similar items cache so next visit fetches fresh recommendations
  await db.similarItemCache.deleteMany({ where: { mediaItemId: id } })

  return NextResponse.json(updated)
}
