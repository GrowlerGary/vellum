import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Authorization: requesting user must own an entry for this item
  const entry = await db.mediaEntry.findFirst({
    where: { mediaItemId: id, userId: session.user.id },
  })
  if (!entry)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Guard against stale entries pointing to an already-deleted MediaItem
  const item = await db.mediaItem.findUnique({ where: { id } })
  if (!item)
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })

  // Delete the item and all dependent records for all users.
  // This is a single-user tracker, so purging the MediaItem from the system
  // is the correct behaviour — the item can always be re-added via search.
  // FK-safe order: AiSuggestion and ListItem have no onDelete cascade from
  // MediaItem, so they must be removed first. MediaEntry cascades to
  // ListeningProgress. MediaItem cascades to SimilarItemCache.
  await db.$transaction(async (tx) => {
    await tx.aiSuggestion.deleteMany({ where: { mediaItemId: id } })
    await tx.listItem.deleteMany({ where: { mediaItemId: id } })
    await tx.mediaEntry.deleteMany({ where: { mediaItemId: id } })
    await tx.mediaItem.delete({ where: { id } })
  })

  return new NextResponse(null, { status: 204 })
}
