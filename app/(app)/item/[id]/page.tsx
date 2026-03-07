import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import ItemDetailClient from './ItemDetailClient'

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

  return <ItemDetailClient entry={JSON.parse(JSON.stringify(entry))} />
}
