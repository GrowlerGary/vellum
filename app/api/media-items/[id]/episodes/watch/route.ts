import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const watchSchema = z.object({
  season: z.number().int().positive(),
  episode: z.number().int().positive(),
  markUpTo: z.boolean().optional().default(false),
})

const unWatchSchema = z.object({
  season: z.number().int().positive(),
  episode: z.number().int().positive(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: mediaItemId } = await params
  const body = await req.json()
  const parsed = watchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { season, episode, markUpTo } = parsed.data
  const userId = session.user.id

  if (markUpTo) {
    // Mark all episodes in this season up to and including the given episode
    // We need the season data to know which episode numbers exist
    const cache = await db.seasonCache.findUnique({ where: { mediaItemId } })
    const seasons = (cache?.data as { seasons: Array<{ number: number; episodes: Array<{ number: number }> }> } | null)?.seasons ?? []
    const seasonData = seasons.find((s) => s.number === season)
    const episodesToMark = seasonData
      ? seasonData.episodes.filter((ep) => ep.number <= episode).map((ep) => ep.number)
      : Array.from({ length: episode }, (_, i) => i + 1)

    await db.$transaction(
      episodesToMark.map((epNum) =>
        db.episodeWatch.upsert({
          where: { userId_mediaItemId_season_episode: { userId, mediaItemId, season, episode: epNum } },
          create: { userId, mediaItemId, season, episode: epNum },
          update: {},
        })
      )
    )
  } else {
    await db.episodeWatch.upsert({
      where: { userId_mediaItemId_season_episode: { userId, mediaItemId, season, episode } },
      create: { userId, mediaItemId, season, episode },
      update: {},
    })
  }

  const watchCount = await db.episodeWatch.count({ where: { userId, mediaItemId } })
  return NextResponse.json({ watchCount })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: mediaItemId } = await params
  const body = await req.json()
  const parsed = unWatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { season, episode } = parsed.data
  const userId = session.user.id

  await db.episodeWatch.deleteMany({
    where: { userId, mediaItemId, season, episode },
  })

  const watchCount = await db.episodeWatch.count({ where: { userId, mediaItemId } })
  return NextResponse.json({ watchCount })
}
