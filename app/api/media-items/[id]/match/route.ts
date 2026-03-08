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

// Higher rank = further along / more desirable to keep
const STATUS_PRIORITY: Record<string, number> = {
  COMPLETED: 4,
  IN_PROGRESS: 3,
  DROPPED: 2,
  WANT: 1,
}

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

  // Check whether the target (source, externalId) already exists as a different item.
  // This happens when e.g. an ABS-created duplicate is being matched to a Hardcover item
  // that was already saved via "Want to Consume". Without conflict detection the update would
  // hit the @@unique([source, externalId]) constraint and silently fail.
  //
  // Use findUnique with the composite key (more reliable than findFirst + NOT filter).
  const existingForTarget = await db.mediaItem.findUnique({
    where: {
      source_externalId: {
        source: parsed.data.source,
        externalId: parsed.data.externalId,
      },
    },
  })
  // Only treat it as a conflict if it's a *different* item (not the one we're already updating)
  const conflictItem = existingForTarget?.id !== id ? existingForTarget : null

  if (conflictItem) {
    // ── Auto-merge ────────────────────────────────────────────────────────────
    // The source item (id) is a duplicate. Merge it into conflictItem (targetId)
    // then delete the source.
    const targetId = conflictItem.id
    const ext = parsed.data.externalData

    await db.$transaction(async (tx) => {
      // 1. Merge MediaEntries: move each source user's entry to the target item
      const sourceEntries = await tx.mediaEntry.findMany({
        where: { mediaItemId: id },
        include: { listeningProgress: true },
      })

      for (const sourceEntry of sourceEntries) {
        const targetEntry = await tx.mediaEntry.findUnique({
          where: { userId_mediaItemId: { userId: sourceEntry.userId, mediaItemId: targetId } },
          include: { listeningProgress: true },
        })

        if (!targetEntry) {
          // No existing entry on target — just re-point this entry
          await tx.mediaEntry.update({
            where: { id: sourceEntry.id },
            data: { mediaItemId: targetId },
          })
        } else {
          // Both source and target have entries for this user — keep the better one
          const sourceRank = STATUS_PRIORITY[sourceEntry.status] ?? 0
          const targetRank = STATUS_PRIORITY[targetEntry.status] ?? 0

          if (sourceRank > targetRank) {
            await tx.mediaEntry.update({
              where: { id: targetEntry.id },
              data: {
                status: sourceEntry.status,
                startedAt: sourceEntry.startedAt ?? targetEntry.startedAt,
                completedAt: sourceEntry.completedAt ?? targetEntry.completedAt,
                // Keep target rating if it has one; fall back to source
                rating: targetEntry.rating ?? sourceEntry.rating,
              },
            })
          }

          // Move ListeningProgress to target if source is further along
          if (sourceEntry.listeningProgress) {
            const sourceProgress = sourceEntry.listeningProgress.progress
            const targetProgress = targetEntry.listeningProgress?.progress ?? -1
            if (sourceProgress > targetProgress) {
              if (targetEntry.listeningProgress) {
                await tx.listeningProgress.delete({ where: { mediaEntryId: targetEntry.id } })
              }
              await tx.listeningProgress.update({
                where: { mediaEntryId: sourceEntry.id },
                data: { mediaEntryId: targetEntry.id },
              })
            }
            // If source has less progress, it will be cascade-deleted with the source entry
          }

          // Delete the source entry (cascade deletes any remaining ListeningProgress)
          await tx.mediaEntry.delete({ where: { id: sourceEntry.id } })
        }
      }

      // 2. Move ListItems to target; delete if target already has the item in the list
      const sourceListItems = await tx.listItem.findMany({ where: { mediaItemId: id } })
      for (const listItem of sourceListItems) {
        const exists = await tx.listItem.findUnique({
          where: { listId_mediaItemId: { listId: listItem.listId, mediaItemId: targetId } },
        })
        if (!exists) {
          await tx.listItem.update({
            where: { id: listItem.id },
            data: { mediaItemId: targetId },
          })
        } else {
          await tx.listItem.delete({ where: { id: listItem.id } })
        }
      }

      // 3. Delete AiSuggestions referencing source (no cascade from MediaItem)
      await tx.aiSuggestion.deleteMany({ where: { mediaItemId: id } })

      // 4. Delete source MediaItem (SimilarItemCache cascades automatically)
      await tx.mediaItem.delete({ where: { id } })

      // 5. Transfer absLibraryItemId and apply requested field updates to target
      const absId = item.source === 'AUDIOBOOKSHELF' ? item.externalId : item.absLibraryItemId
      const targetUpdateData: Record<string, unknown> = {}
      if (absId && !conflictItem.absLibraryItemId) {
        targetUpdateData.absLibraryItemId = absId
      }
      if (parsed.data.fields.title) targetUpdateData.title = ext.title
      if (parsed.data.fields.year) targetUpdateData.year = ext.year
      if (parsed.data.fields.posterUrl) targetUpdateData.posterUrl = ext.posterUrl
      if (parsed.data.fields.backdropUrl) targetUpdateData.backdropUrl = ext.backdropUrl
      if (parsed.data.fields.overview) targetUpdateData.overview = ext.overview
      if (parsed.data.fields.genres) targetUpdateData.genres = ext.genres
      if (parsed.data.fields.metadata) targetUpdateData.metadata = ext.metadata
      if (Object.keys(targetUpdateData).length > 0) {
        await tx.mediaItem.update({ where: { id: targetId }, data: targetUpdateData })
      }

      // 6. Invalidate target's similar-items cache
      await tx.similarItemCache.deleteMany({ where: { mediaItemId: targetId } })
    })

    return NextResponse.json({ id: targetId, merged: true })
  }

  // ── Normal update (no conflict) ───────────────────────────────────────────

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
