import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { validateReorderPayload } from './validation'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = validateReorderPayload(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const entryIds = parsed.data.entries.map((e) => e.id)

  // Verify all entries belong to the requesting user
  const existingEntries = await db.mediaEntry.findMany({
    where: { id: { in: entryIds }, userId: session.user.id },
    select: { id: true },
  })

  if (existingEntries.length !== entryIds.length) {
    return NextResponse.json(
      { error: 'Some entries not found or unauthorized' },
      { status: 403 }
    )
  }

  // Atomic batch update — all succeed or none do
  await db.$transaction(
    parsed.data.entries.map((e) =>
      db.mediaEntry.update({
        where: { id: e.id },
        data: { sortOrder: e.sortOrder },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
