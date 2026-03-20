import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isShelfmarkEnabled, searchShelfmark } from '@/lib/shelfmark'

const SearchSchema = z.object({
  query: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isShelfmarkEnabled()) {
    return NextResponse.json({ error: 'Shelfmark is not configured' }, { status: 503 })
  }

  if (!rateLimit(`shelfmark-search:${session.user.id}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = SearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = await searchShelfmark(parsed.data.query)

  if (result.error) {
    return NextResponse.json({ releases: [], error: result.error }, { status: 502 })
  }

  return NextResponse.json({ releases: result.releases })
}
