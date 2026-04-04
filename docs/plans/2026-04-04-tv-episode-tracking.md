# TV Episode Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-episode watched/unwatched tracking for TV shows with season accordions on the item detail page, automatic show status derivation, and Trakt scrobble integration.

**Architecture:** Two new Prisma models (`SeasonCache` for TMDB episode data, `EpisodeWatch` for user watch state) follow the existing `SimilarItemCache` pattern. A `lib/seasons.ts` utility handles cache logic and status derivation. A new `SeasonSection` component renders season accordions in `ItemDetailClient`. TV show `MediaEntry.status` becomes derived (not manually set).

**Tech Stack:** Next.js 15 App Router, Prisma 5 + PostgreSQL, TypeScript, Vitest, Tailwind CSS, Radix UI, Lucide React, TMDB API

---

### Task 1: Add Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add `SeasonCache` and `EpisodeWatch` models to the schema**

In `prisma/schema.prisma`, add these two models at the end of the file (after `SimilarItemCache`). Also add `seasonCache SeasonCache?` and `episodeWatches EpisodeWatch[]` to the `MediaItem` model, and `episodeWatches EpisodeWatch[]` to the `User` model.

Add to `MediaItem` model (after `similarCache SimilarItemCache?`):
```prisma
  seasonCache    SeasonCache?
  episodeWatches EpisodeWatch[]
```

Add to `User` model (after `aiSuggestions AiSuggestion[]`):
```prisma
  episodeWatches EpisodeWatch[]
```

Add at the end of the file:
```prisma
model SeasonCache {
  id          String    @id @default(cuid())
  mediaItemId String    @unique
  data        Json
  fetchedAt   DateTime  @default(now())

  mediaItem MediaItem @relation(fields: [mediaItemId], references: [id], onDelete: Cascade)
}

model EpisodeWatch {
  id          String   @id @default(cuid())
  userId      String
  mediaItemId String
  season      Int
  episode     Int
  watchedAt   DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  mediaItem MediaItem @relation(fields: [mediaItemId], references: [id], onDelete: Cascade)

  @@unique([userId, mediaItemId, season, episode])
  @@index([userId, mediaItemId])
}
```

**Step 2: Generate and run migration**

```bash
cd /tmp/vellum
npx prisma migrate dev --name add_season_cache_and_episode_watch
```

Expected: Migration created and applied. Prisma Client regenerated.

**Step 3: Verify Prisma Client has the new types**

```bash
npx prisma generate
```

Expected: No errors.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SeasonCache and EpisodeWatch prisma models"
```

---

### Task 2: Add TMDB Season Fetch Function

**Files:**
- Modify: `lib/metadata/tmdb.ts`

**Step 1: Write the failing test**

Create `lib/metadata/__tests__/tmdb-seasons.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock env var
vi.stubEnv('TMDB_API_KEY', 'test-key')

describe('getTmdbSeason', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns episodes for a season', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        season_number: 1,
        name: 'Season 1',
        episodes: [
          { episode_number: 1, name: 'Pilot', air_date: '2023-09-17', overview: 'First episode' },
          { episode_number: 2, name: 'Episode 2', air_date: '2023-09-24', overview: 'Second episode' },
        ],
      }),
    })

    const { getTmdbSeason } = await import('../tmdb')
    const result = await getTmdbSeason('1234', 1)

    expect(result).not.toBeNull()
    expect(result!.number).toBe(1)
    expect(result!.name).toBe('Season 1')
    expect(result!.episodes).toHaveLength(2)
    expect(result!.episodes[0]).toEqual({
      number: 1,
      title: 'Pilot',
      airDate: '2023-09-17',
      overview: 'First episode',
    })
  })

  it('returns null when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { getTmdbSeason } = await import('../tmdb')
    const result = await getTmdbSeason('1234', 1)

    expect(result).toBeNull()
  })

  it('calls the correct TMDB endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ season_number: 2, name: 'Season 2', episodes: [] }),
    })

    const { getTmdbSeason } = await import('../tmdb')
    await getTmdbSeason('5678', 2)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/tv/5678/season/2',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) })
    )
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /tmp/vellum
npx vitest run lib/metadata/__tests__/tmdb-seasons.test.ts
```

Expected: FAIL — `getTmdbSeason is not a function`

**Step 3: Add the export interface and function to `lib/metadata/tmdb.ts`**

Add after the existing interfaces (before `mapItem`):

```typescript
export interface TmdbEpisode {
  number: number
  title: string
  airDate: string | null
  overview: string
}

export interface TmdbSeasonData {
  number: number
  name: string
  episodes: TmdbEpisode[]
}
```

Add at the end of the file:

```typescript
export async function getTmdbSeason(
  tmdbId: string,
  seasonNumber: number
): Promise<TmdbSeasonData | null> {
  const url = `${TMDB_BASE}/tv/${tmdbId}/season/${seasonNumber}`
  try {
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) return null
    const data = await res.json() as {
      season_number: number
      name: string
      episodes: Array<{
        episode_number: number
        name: string
        air_date: string | null
        overview: string
      }>
    }
    return {
      number: data.season_number,
      name: data.name,
      episodes: (data.episodes ?? []).map((ep) => ({
        number: ep.episode_number,
        title: ep.name,
        airDate: ep.air_date ?? null,
        overview: ep.overview ?? '',
      })),
    }
  } catch {
    return null
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run lib/metadata/__tests__/tmdb-seasons.test.ts
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add lib/metadata/tmdb.ts lib/metadata/__tests__/tmdb-seasons.test.ts
git commit -m "feat: add getTmdbSeason to TMDB metadata lib"
```

---

### Task 3: Season Utility Library

**Files:**
- Create: `lib/seasons.ts`
- Create: `lib/__tests__/seasons.test.ts`

This lib contains the two pure functions that power the feature: status derivation and cache data merging. Test these first.

**Step 1: Write the failing tests**

Create `lib/__tests__/seasons.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { deriveShowStatus, mergeSeasonIntoCache, getAiredEpisodeCount } from '@/lib/seasons'

describe('deriveShowStatus', () => {
  it('returns null when no episodes watched', () => {
    expect(deriveShowStatus(0, 10)).toBeNull()
  })

  it('returns IN_PROGRESS when some episodes watched', () => {
    expect(deriveShowStatus(3, 10)).toBe('IN_PROGRESS')
  })

  it('returns COMPLETED when all aired episodes watched', () => {
    expect(deriveShowStatus(10, 10)).toBe('COMPLETED')
  })

  it('returns IN_PROGRESS when more watched than aired (edge case)', () => {
    // Can happen if cache is stale and new episodes added
    expect(deriveShowStatus(11, 10)).toBe('IN_PROGRESS')
  })

  it('returns null when airedCount is 0', () => {
    expect(deriveShowStatus(0, 0)).toBeNull()
  })
})

describe('getAiredEpisodeCount', () => {
  const today = '2024-06-01'

  it('counts only episodes with air date before or on today', () => {
    const seasons = [
      {
        number: 1,
        name: 'Season 1',
        episodes: [
          { number: 1, title: 'Ep 1', airDate: '2024-01-01', overview: '' },
          { number: 2, title: 'Ep 2', airDate: '2024-05-31', overview: '' },
          { number: 3, title: 'Ep 3', airDate: '2024-07-01', overview: '' }, // future
        ],
      },
    ]
    expect(getAiredEpisodeCount(seasons, today)).toBe(2)
  })

  it('counts episodes with null air date as aired', () => {
    const seasons = [
      {
        number: 1,
        name: 'Season 1',
        episodes: [
          { number: 1, title: 'Ep 1', airDate: null, overview: '' },
        ],
      },
    ]
    expect(getAiredEpisodeCount(seasons, today)).toBe(1)
  })

  it('returns 0 for empty seasons', () => {
    expect(getAiredEpisodeCount([], today)).toBe(0)
  })
})

describe('mergeSeasonIntoCache', () => {
  it('adds a new season to empty cache data', () => {
    const newSeason = { number: 1, name: 'Season 1', episodes: [] }
    const result = mergeSeasonIntoCache({ seasons: [] }, newSeason)
    expect(result.seasons).toHaveLength(1)
    expect(result.seasons[0].number).toBe(1)
  })

  it('replaces an existing season', () => {
    const existing = {
      seasons: [
        { number: 1, name: 'Season 1', episodes: [{ number: 1, title: 'Old', airDate: null, overview: '' }] },
      ],
    }
    const newSeason = { number: 1, name: 'Season 1', episodes: [{ number: 1, title: 'New', airDate: null, overview: '' }] }
    const result = mergeSeasonIntoCache(existing, newSeason)
    expect(result.seasons).toHaveLength(1)
    expect(result.seasons[0].episodes[0].title).toBe('New')
  })

  it('preserves other seasons when adding a new one', () => {
    const existing = {
      seasons: [
        { number: 1, name: 'Season 1', episodes: [] },
      ],
    }
    const newSeason = { number: 2, name: 'Season 2', episodes: [] }
    const result = mergeSeasonIntoCache(existing, newSeason)
    expect(result.seasons).toHaveLength(2)
    expect(result.seasons.map((s) => s.number)).toEqual([1, 2])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /tmp/vellum
npx vitest run lib/__tests__/seasons.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/seasons'`

**Step 3: Implement `lib/seasons.ts`**

Create `lib/seasons.ts`:

```typescript
import type { TmdbSeasonData, TmdbEpisode } from '@/lib/metadata/tmdb'

export interface SeasonCacheData {
  seasons: TmdbSeasonData[]
}

/**
 * Derives the show's EntryStatus from episode watch counts.
 * TV show status is computed, not manually set.
 */
export function deriveShowStatus(
  watchCount: number,
  airedCount: number
): 'IN_PROGRESS' | 'COMPLETED' | null {
  if (watchCount === 0 || airedCount === 0) return null
  if (watchCount >= airedCount) return 'COMPLETED'
  return 'IN_PROGRESS'
}

/**
 * Counts episodes that have aired on or before the given date string (YYYY-MM-DD).
 * Episodes with null airDate are treated as aired.
 */
export function getAiredEpisodeCount(
  seasons: TmdbSeasonData[],
  todayStr: string
): number {
  return seasons.reduce((total, season) => {
    return total + season.episodes.filter((ep) => {
      if (!ep.airDate) return true
      return ep.airDate <= todayStr
    }).length
  }, 0)
}

/**
 * Merges a newly fetched season into the existing cache data.
 * Replaces the season if it already exists, otherwise appends it.
 */
export function mergeSeasonIntoCache(
  existing: SeasonCacheData,
  newSeason: TmdbSeasonData
): SeasonCacheData {
  const others = existing.seasons.filter((s) => s.number !== newSeason.number)
  const merged = [...others, newSeason].sort((a, b) => a.number - b.number)
  return { seasons: merged }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run lib/__tests__/seasons.test.ts
```

Expected: PASS (9 tests)

**Step 5: Run all tests to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add lib/seasons.ts lib/__tests__/seasons.test.ts
git commit -m "feat: add season utility lib with status derivation and cache merge"
```

---

### Task 4: GET /api/media-items/[id]/seasons Route

**Files:**
- Create: `app/api/media-items/[id]/seasons/route.ts`

This route returns season+episode data for a show, lazily fetching from TMDB per season and caching in `SeasonCache`. It annotates each episode with the current user's `watchedAt`.

**Step 1: Create the route file**

Create `app/api/media-items/[id]/seasons/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTmdbSeason } from '@/lib/metadata/tmdb'
import { mergeSeasonIntoCache, type SeasonCacheData } from '@/lib/seasons'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: mediaItemId } = await params
  const { searchParams } = req.nextUrl
  const seasonNumber = searchParams.get('season') ? Number(searchParams.get('season')) : null

  // Verify the media item exists and belongs to user's library
  const mediaItem = await db.mediaItem.findUnique({
    where: { id: mediaItemId },
    include: { seasonCache: true },
  })
  if (!mediaItem) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mediaItem.type !== 'TV_SHOW') {
    return NextResponse.json({ error: 'Not a TV show' }, { status: 400 })
  }

  const metadata = mediaItem.metadata as Record<string, unknown>
  const tmdbId = String(metadata.tmdbId ?? mediaItem.externalId)
  const showEnded = (metadata.status as string | undefined) === 'Ended'

  let cacheData: SeasonCacheData = (mediaItem.seasonCache?.data as SeasonCacheData) ?? { seasons: [] }
  const cacheAge = mediaItem.seasonCache
    ? Date.now() - new Date(mediaItem.seasonCache.fetchedAt).getTime()
    : Infinity

  // Fetch from TMDB if the requested season is missing or cache is stale
  if (seasonNumber !== null) {
    const hasSeason = cacheData.seasons.some((s) => s.number === seasonNumber)
    const isStale = !showEnded && cacheAge > CACHE_TTL_MS

    if (!hasSeason || isStale) {
      const fetched = await getTmdbSeason(tmdbId, seasonNumber)
      if (fetched) {
        cacheData = mergeSeasonIntoCache(cacheData, fetched)
        await db.seasonCache.upsert({
          where: { mediaItemId },
          create: { mediaItemId, data: cacheData as object, fetchedAt: new Date() },
          update: { data: cacheData as object, fetchedAt: new Date() },
        })
      }
    }
  }

  // Fetch user's watches for this item
  const watches = await db.episodeWatch.findMany({
    where: { userId: session.user.id, mediaItemId },
    select: { season: true, episode: true, watchedAt: true },
  })
  const watchMap = new Map(
    watches.map((w) => [`${w.season}:${w.episode}`, w.watchedAt.toISOString()])
  )

  // Annotate each episode with watchedAt
  const today = new Date().toISOString().split('T')[0]
  const annotatedSeasons = cacheData.seasons.map((s) => ({
    ...s,
    episodes: s.episodes.map((ep) => ({
      ...ep,
      watchedAt: watchMap.get(`${s.number}:${ep.number}`) ?? null,
      isFuture: ep.airDate !== null && ep.airDate > today,
    })),
  }))

  return NextResponse.json({ seasons: annotatedSeasons, watchCount: watches.length })
}
```

**Step 2: Test manually with curl (or verify types compile)**

```bash
cd /tmp/vellum
npx tsc --noEmit
```

Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add app/api/media-items/[id]/seasons/route.ts
git commit -m "feat: add GET /api/media-items/[id]/seasons with lazy TMDB caching"
```

---

### Task 5: POST and DELETE /api/media-items/[id]/episodes/watch Routes

**Files:**
- Create: `app/api/media-items/[id]/episodes/watch/route.ts`

**Step 1: Create the route file**

Create `app/api/media-items/[id]/episodes/watch/route.ts`:

```typescript
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
```

**Step 2: Verify TypeScript compiles**

```bash
cd /tmp/vellum
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add "app/api/media-items/[id]/episodes/watch/route.ts"
git commit -m "feat: add POST/DELETE /api/media-items/[id]/episodes/watch"
```

---

### Task 6: Derive TV Show Status in Entry Endpoints

**Files:**
- Modify: `app/api/entries/route.ts`
- Modify: `app/api/entries/[id]/route.ts`

TV show `MediaEntry.status` is now computed. We enrich it after fetching from the DB.

**Step 1: Write the failing test for the derivation helper**

Add to `lib/__tests__/seasons.test.ts` (append at the bottom):

```typescript
import { enrichEntriesWithTvStatus } from '@/lib/seasons'

describe('enrichEntriesWithTvStatus', () => {
  it('overrides status for TV_SHOW entries based on watch counts', () => {
    const entries = [
      {
        id: '1',
        status: 'COMPLETED' as const,
        mediaItem: { type: 'TV_SHOW', metadata: {} },
        _count: { episodeWatches: 5 },
      },
      {
        id: '2',
        status: 'WANT' as const,
        mediaItem: { type: 'MOVIE', metadata: {} },
        _count: { episodeWatches: 0 },
      },
    ]
    const airedCounts = new Map([['1', 10]])
    const result = enrichEntriesWithTvStatus(entries as never, airedCounts)

    expect(result[0].status).toBe('IN_PROGRESS') // 5 of 10 watched
    expect(result[1].status).toBe('WANT')         // movies unchanged
  })

  it('sets COMPLETED when all aired episodes watched', () => {
    const entries = [
      {
        id: '1',
        status: 'IN_PROGRESS' as const,
        mediaItem: { type: 'TV_SHOW', metadata: {} },
        _count: { episodeWatches: 10 },
      },
    ]
    const airedCounts = new Map([['1', 10]])
    const result = enrichEntriesWithTvStatus(entries as never, airedCounts)

    expect(result[0].status).toBe('COMPLETED')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/seasons.test.ts
```

Expected: FAIL — `enrichEntriesWithTvStatus is not a function`

**Step 3: Add the helper to `lib/seasons.ts`**

Append to `lib/seasons.ts`:

```typescript
interface EntryWithCounts {
  id: string
  status: string | null
  mediaItem: { type: string; metadata: unknown }
  _count: { episodeWatches: number }
  [key: string]: unknown
}

/**
 * Overrides status for TV_SHOW entries based on episode watch counts.
 * All other media types are returned unchanged.
 */
export function enrichEntriesWithTvStatus<T extends EntryWithCounts>(
  entries: T[],
  airedCountsByEntryId: Map<string, number>
): T[] {
  return entries.map((entry) => {
    if (entry.mediaItem.type !== 'TV_SHOW') return entry
    const airedCount = airedCountsByEntryId.get(entry.id) ?? 0
    const derived = deriveShowStatus(entry._count.episodeWatches, airedCount)
    return { ...entry, status: derived }
  })
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run lib/__tests__/seasons.test.ts
```

Expected: PASS (all tests)

**Step 5: Update `app/api/entries/route.ts` GET handler**

Replace the `GET` function in `app/api/entries/route.ts` with:

```typescript
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type')
  const status = searchParams.get('status')

  const entries = await db.mediaEntry.findMany({
    where: {
      userId: session.user.id,
      ...(type ? { mediaItem: { type: type as never } } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      mediaItem: true,
      _count: { select: { episodeWatches: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // For TV shows, compute status from episode watch counts
  const tvEntries = entries.filter((e) => e.mediaItem.type === 'TV_SHOW')
  let airedCountsMap = new Map<string, number>()

  if (tvEntries.length > 0) {
    const caches = await db.seasonCache.findMany({
      where: { mediaItemId: { in: tvEntries.map((e) => e.mediaItemId) } },
      select: { mediaItemId: true, data: true },
    })
    const today = new Date().toISOString().split('T')[0]
    for (const entry of tvEntries) {
      const cache = caches.find((c) => c.mediaItemId === entry.mediaItemId)
      const seasons = (cache?.data as { seasons: Array<{ number: number; episodes: Array<{ airDate: string | null }> }> } | null)?.seasons ?? []
      const { getAiredEpisodeCount } = await import('@/lib/seasons')
      airedCountsMap.set(entry.id, getAiredEpisodeCount(seasons, today))
    }
  }

  // Add episodeWatches count to the entry object for enrichment
  const enrichedEntries = entries.map((e) => ({
    ...e,
    _count: { episodeWatches: (e as typeof e & { _count: { episodeWatches: number } })._count.episodeWatches },
  }))

  const { enrichEntriesWithTvStatus } = await import('@/lib/seasons')
  const result = enrichEntriesWithTvStatus(enrichedEntries as never, airedCountsMap)

  return NextResponse.json(result)
}
```

> **Note:** Also add `import { getAiredEpisodeCount, enrichEntriesWithTvStatus } from '@/lib/seasons'` to the top of the file (replace the dynamic imports with static ones for cleanliness).

**Step 6: Update `app/api/entries/[id]/route.ts` PUT handler**

The `PUT` handler currently lets clients set status on TV shows directly. For TV shows, ignore the incoming `status` field (it's derived). Replace the `PUT` handler:

```typescript
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const entry = await db.mediaEntry.findUnique({
    where: { id },
    include: { mediaItem: true },
  })
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { status, startedAt, completedAt, ...rest } = parsed.data

  // TV show status is derived from episode watches — ignore incoming status
  const isTvShow = entry.mediaItem.type === 'TV_SHOW'

  const updated = await db.mediaEntry.update({
    where: { id },
    data: {
      ...rest,
      ...(!isTvShow && status !== undefined ? { status: status === null ? null : status } : {}),
      startedAt: startedAt ? new Date(startedAt) : undefined,
      completedAt: completedAt ? new Date(completedAt) : undefined,
    },
    include: { mediaItem: true },
  })

  return NextResponse.json(updated)
}
```

**Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 9: Commit**

```bash
git add lib/seasons.ts lib/__tests__/seasons.test.ts app/api/entries/route.ts "app/api/entries/[id]/route.ts"
git commit -m "feat: derive TV show status from episode watch counts in entry endpoints"
```

---

### Task 7: Update Trakt Webhook for Episode Tracking

**Files:**
- Modify: `app/api/scrobble/trakt/route.ts`

**Step 1: Update the POST handler**

Replace the TV show handling section in `app/api/scrobble/trakt/route.ts`. The existing flow is fine for movies. For TV shows, after upserting the media item and entry, also create an `EpisodeWatch` for the specific episode.

Find this block (around line 100):
```typescript
  const isMovie = !!payload.movie;
  const tmdbId = isMovie ? payload.movie?.ids?.tmdb : payload.show?.ids?.tmdb;
  const title = isMovie ? (payload.movie?.title ?? "") : (payload.show?.title ?? "");
  const year = isMovie ? payload.movie?.year : payload.show?.year;

  if (!tmdbId) return NextResponse.json({ status: "no_tmdb_id" });

  const externalId = String(tmdbId);
  const mediaType = isMovie ? "MOVIE" : "TV_SHOW";

  // Upsert media item
  const mediaItem = await db.mediaItem.upsert({
    where: { source_externalId_type: { source: "TMDB", externalId, type: mediaType } },
    create: {
      type: mediaType,
      externalId,
      source: "TMDB",
      title,
      year: year ?? null,
      genres: [],
      overview: "",
      metadata: { tmdbId },
    },
    update: {},
  });

  // Create/update entry as COMPLETED
  await db.mediaEntry.upsert({
    where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
    create: {
      userId,
      mediaItemId: mediaItem.id,
      status: "COMPLETED",
      isPublic: true,
      completedAt: new Date(),
    },
    update: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ status: "ok", title, mediaType });
```

Replace with:

```typescript
  const isMovie = !!payload.movie;
  const tmdbId = isMovie ? payload.movie?.ids?.tmdb : payload.show?.ids?.tmdb;
  const title = isMovie ? (payload.movie?.title ?? "") : (payload.show?.title ?? "");
  const year = isMovie ? payload.movie?.year : payload.show?.year;

  if (!tmdbId) return NextResponse.json({ status: "no_tmdb_id" });

  const externalId = String(tmdbId);
  const mediaType = isMovie ? "MOVIE" : "TV_SHOW";

  // Upsert media item
  const mediaItem = await db.mediaItem.upsert({
    where: { source_externalId_type: { source: "TMDB", externalId, type: mediaType } },
    create: {
      type: mediaType,
      externalId,
      source: "TMDB",
      title,
      year: year ?? null,
      genres: [],
      overview: "",
      metadata: { tmdbId },
    },
    update: {},
  });

  // Upsert entry — for TV shows, status is derived; for movies, set COMPLETED
  await db.mediaEntry.upsert({
    where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
    create: {
      userId,
      mediaItemId: mediaItem.id,
      status: isMovie ? "COMPLETED" : null,
      isPublic: true,
      completedAt: isMovie ? new Date() : null,
    },
    update: isMovie
      ? { status: "COMPLETED", completedAt: new Date() }
      : {},
  });

  // For TV shows, record the specific episode watch
  if (!isMovie && payload.episode?.season && payload.episode?.number) {
    const seasonNum = payload.episode.season;
    const episodeNum = payload.episode.number;

    await db.episodeWatch.upsert({
      where: {
        userId_mediaItemId_season_episode: {
          userId,
          mediaItemId: mediaItem.id,
          season: seasonNum,
          episode: episodeNum,
        },
      },
      create: { userId, mediaItemId: mediaItem.id, season: seasonNum, episode: episodeNum },
      update: {},
    });
  }

  return NextResponse.json({ status: "ok", title, mediaType });
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add app/api/scrobble/trakt/route.ts
git commit -m "feat: record episode watches from Trakt scrobble webhook"
```

---

### Task 8: SeasonSection Component

**Files:**
- Create: `components/media/SeasonSection.tsx`

This is a client component that renders the season accordions. It fetches episode data lazily (per season on expand) and handles toggling watches.

**Step 1: Create the component**

Create `components/media/SeasonSection.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'

interface Episode {
  number: number
  title: string
  airDate: string | null
  overview: string
  watchedAt: string | null
  isFuture: boolean
}

interface Season {
  number: number
  name: string
  episodes: Episode[]
}

interface SeasonsResponse {
  seasons: Season[]
  watchCount: number
}

interface SeasonSectionProps {
  mediaItemId: string
  numberOfSeasons: number
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
      <div className="h-full bg-zinc-700 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

function EpisodeRow({
  episode,
  seasonNumber,
  mediaItemId,
  onToggle,
  onMarkUpTo,
}: {
  episode: Episode
  seasonNumber: number
  mediaItemId: string
  onToggle: (season: number, ep: number, watched: boolean) => void
  onMarkUpTo: (season: number, ep: number) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
        episode.isFuture ? 'opacity-40' : 'hover:bg-zinc-50'
      }`}
    >
      <span className="text-xs text-zinc-400 w-6 text-right flex-shrink-0">
        {episode.number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 truncate">{episode.title}</p>
        {episode.airDate && (
          <p className="text-xs text-zinc-400">
            {new Date(episode.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!episode.isFuture && (
          <>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-1 text-zinc-400 hover:text-zinc-600 text-xs"
                aria-label="More options"
              >
                ···
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 z-10 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 w-48">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50"
                    onClick={() => {
                      onMarkUpTo(seasonNumber, episode.number)
                      setMenuOpen(false)
                    }}
                  >
                    Mark all up to here as seen
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => onToggle(seasonNumber, episode.number, !episode.watchedAt)}
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                episode.watchedAt
                  ? 'bg-zinc-800 border-zinc-800 text-white'
                  : 'border-zinc-300 hover:border-zinc-500'
              }`}
              aria-label={episode.watchedAt ? 'Mark as unseen' : 'Mark as seen'}
            >
              {episode.watchedAt && <Check className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function SeasonSection({ mediaItemId, numberOfSeasons }: SeasonSectionProps) {
  const [seasonsData, setSeasonsData] = useState<Record<number, Season>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<number | null>(null)

  // Determine first season to auto-expand on mount
  useEffect(() => {
    setExpanded(1)
  }, [])

  // Fetch season data when a season is expanded
  useEffect(() => {
    if (expanded === null || seasonsData[expanded]) return

    setLoading((l) => ({ ...l, [expanded]: true }))
    fetch(`/api/media-items/${mediaItemId}/seasons?season=${expanded}`)
      .then((r) => r.json())
      .then((data: SeasonsResponse) => {
        setSeasonsData((prev) => {
          const next = { ...prev }
          for (const s of data.seasons) {
            next[s.number] = s
          }
          return next
        })
      })
      .finally(() => setLoading((l) => ({ ...l, [expanded]: false })))
  }, [expanded, mediaItemId, seasonsData])

  const handleToggle = async (season: number, episode: number, markWatched: boolean) => {
    const method = markWatched ? 'POST' : 'DELETE'
    await fetch(`/api/media-items/${mediaItemId}/episodes/watch`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, episode }),
    })

    // Optimistically update local state
    setSeasonsData((prev) => {
      const s = prev[season]
      if (!s) return prev
      return {
        ...prev,
        [season]: {
          ...s,
          episodes: s.episodes.map((ep) =>
            ep.number === episode
              ? { ...ep, watchedAt: markWatched ? new Date().toISOString() : null }
              : ep
          ),
        },
      }
    })
  }

  const handleMarkUpTo = async (season: number, episode: number) => {
    await fetch(`/api/media-items/${mediaItemId}/episodes/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, episode, markUpTo: true }),
    })

    // Re-fetch this season to reflect updated state
    const res = await fetch(`/api/media-items/${mediaItemId}/seasons?season=${season}`)
    const data: SeasonsResponse = await res.json()
    setSeasonsData((prev) => {
      const next = { ...prev }
      for (const s of data.seasons) {
        next[s.number] = s
      }
      return next
    })
  }

  const seasonNumbers = Array.from({ length: numberOfSeasons }, (_, i) => i + 1)

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-zinc-900">Episodes</h2>
      <div className="space-y-1">
        {seasonNumbers.map((num) => {
          const season = seasonsData[num]
          const isExpanded = expanded === num
          const isLoading = loading[num]
          const watchedCount = season?.episodes.filter((e) => e.watchedAt).length ?? 0
          const totalCount = season?.episodes.length ?? 0

          return (
            <div key={num} className="border border-zinc-200 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : num)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                )}
                <span className="font-medium text-sm text-zinc-900 flex-1 text-left">
                  {season?.name ?? `Season ${num}`}
                </span>
                {season && (
                  <div className="flex items-center gap-2">
                    <ProgressBar value={watchedCount} max={totalCount} />
                    <span className="text-xs text-zinc-400 w-12 text-right">
                      {watchedCount} / {totalCount}
                    </span>
                  </div>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-100 bg-white px-2 py-1">
                  {isLoading ? (
                    <p className="text-sm text-zinc-400 text-center py-4">Loading episodes…</p>
                  ) : season ? (
                    season.episodes.map((ep) => (
                      <EpisodeRow
                        key={ep.number}
                        episode={ep}
                        seasonNumber={num}
                        mediaItemId={mediaItemId}
                        onToggle={handleToggle}
                        onMarkUpTo={handleMarkUpTo}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400 text-center py-4">No episode data available.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add components/media/SeasonSection.tsx
git commit -m "feat: add SeasonSection component with accordion UI and episode watch toggles"
```

---

### Task 9: Integrate SeasonSection into ItemDetailClient

**Files:**
- Modify: `app/(app)/item/[id]/ItemDetailClient.tsx`

**Step 1: Add the import**

At the top of `ItemDetailClient.tsx`, add:

```typescript
import { SeasonSection } from '@/components/media/SeasonSection'
```

**Step 2: Make status read-only for TV shows**

In `ItemDetailClient.tsx`, find the status buttons section. It currently renders clickable `StatusBadge` buttons. Wrap the entire status section in a conditional:

```tsx
{/* Status */}
{item.type === 'TV_SHOW' ? (
  <div className="space-y-1">
    <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Status</p>
    <p className="text-sm text-zinc-500 italic">Tracked automatically via episodes</p>
    {status && (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
        {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
      </span>
    )}
  </div>
) : (
  /* existing status buttons JSX — leave unchanged */
  <div className="...">
    {/* ... existing status badge buttons ... */}
  </div>
)}
```

> **Important:** Find the actual status buttons block in the file and only wrap it — don't move any other code.

**Step 3: Render SeasonSection for TV shows**

Find where `<SimilarItemsSection>` is rendered. Just above it, add:

```tsx
{item.type === 'TV_SHOW' && (
  <SeasonSection
    mediaItemId={item.id}
    numberOfSeasons={(item.metadata as Record<string, unknown>).numberOfSeasons as number ?? 1}
  />
)}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add "app/(app)/item/[id]/ItemDetailClient.tsx"
git commit -m "feat: integrate SeasonSection into TV show item detail page"
```

---

### Task 10: Push and Open PR

**Step 1: Push the branch**

```bash
git push origin main
```

> If working in a feature branch, push that branch and open a PR instead.

**Step 2: Run final test suite**

```bash
npx vitest run
```

Expected: All tests pass. Note the test count — it should be higher than the original 21.

**Step 3: Verify build**

```bash
npx next build
```

Expected: Build succeeds with no errors (warnings about dynamic imports are fine).
