import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isShelfmarkEnabled, downloadFromShelfmark } from '@/lib/shelfmark'

const DownloadSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  format: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isShelfmarkEnabled()) {
    return NextResponse.json({ error: 'Shelfmark is not configured' }, { status: 503 })
  }

  if (!rateLimit(`shelfmark-download:${session.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = DownloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = await downloadFromShelfmark(parsed.data)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
