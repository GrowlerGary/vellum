import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import MediaPreviewClient from './MediaPreviewClient'

export default async function MediaPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const mediaItem = await db.mediaItem.findUnique({
    where: { id },
  })

  if (!mediaItem) notFound()

  // If user already has an entry, send them to the full detail page
  const entry = await db.mediaEntry.findUnique({
    where: { userId_mediaItemId: { userId: session.user.id, mediaItemId: id } },
    select: { id: true },
  })
  if (entry) redirect(`/item/${entry.id}`)

  return <MediaPreviewClient mediaItem={JSON.parse(JSON.stringify(mediaItem))} />
}
