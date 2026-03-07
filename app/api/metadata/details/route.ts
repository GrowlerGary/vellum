import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTmdbDetail } from '@/lib/metadata/tmdb'
import { getIgdbDetail } from '@/lib/metadata/igdb'
import { getHardcoverDetail } from '@/lib/metadata/hardcover'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const source = searchParams.get('source')
  const id = searchParams.get('id')
  const mediaType = searchParams.get('mediaType') ?? 'movie'

  if (!source || !id) {
    return NextResponse.json({ error: 'Missing required params: source, id' }, { status: 400 })
  }

  try {
    let detail
    switch (source) {
      case 'TMDB': {
        const tmdbType = mediaType === 'TV_SHOW' ? 'tv' : 'movie'
        detail = await getTmdbDetail(id, tmdbType)
        break
      }
      case 'IGDB':
        detail = await getIgdbDetail(id)
        break
      case 'HARDCOVER':
        detail = await getHardcoverDetail(id, mediaType === 'AUDIOBOOK')
        break
      default:
        return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 })
    }

    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err) {
    console.error('Metadata details error:', err)
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 502 })
  }
}
