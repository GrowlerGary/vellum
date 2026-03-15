import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import ItemDetailClient from './ItemDetailClient'
import { backfillExternalRating } from '@/lib/metadata/backfill-rating'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const entry = await db.mediaEntry.findFirst({
    where: { id, userId: session.user.id },
    include: {
      mediaItem: true,
      listeningProgress: true,
    },
  })

  if (!entry) notFound()

  // Lazy backfill: fetch external rating if missing from metadata
  await backfillExternalRating(entry.mediaItem)

  // Re-read to get updated metadata
  const updated = await db.mediaEntry.findFirst({
    where: { id, userId: session.user.id },
    include: {
      mediaItem: true,
      listeningProgress: true,
    },
  })

  return <ItemDetailClient entry={JSON.parse(JSON.stringify(updated ?? entry))} />
}
