import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const VALID_TYPES = ['MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME'] as const

const schema = z.object({
  categoryOrder: z
    .array(z.enum(VALID_TYPES))
    .length(5)
    .refine((arr) => new Set(arr).size === 5, { message: 'All 5 media types must be present exactly once' }),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { categoryOrder: true },
  })

  return NextResponse.json({
    categoryOrder: user?.categoryOrder?.length ? user.categoryOrder : [...VALID_TYPES],
  })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { categoryOrder: parsed.data.categoryOrder },
  })

  return NextResponse.json({ ok: true })
}
