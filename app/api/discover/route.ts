import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDiscoverRecommendations } from '@/lib/discover'

const VALID_TYPES = ['MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME'] as const
type MediaType = (typeof VALID_TYPES)[number]

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')?.toUpperCase()

  if (!type || !VALID_TYPES.includes(type as MediaType)) {
    return NextResponse.json(
      { error: `Missing or invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const recommendations = await getDiscoverRecommendations(session.user.id, type)
    return NextResponse.json({ recommendations })
  } catch (err) {
    console.error('Discover error:', err)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 502 })
  }
}
