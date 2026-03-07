# Media Tracking Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Vellum with drag-and-drop queue ordering, real-time ABS progress tracking, similar-item recommendations, and free metadata-driven discovery.

**Architecture:** Extend the existing Next.js 15 + Prisma + PostgreSQL stack. Add @dnd-kit for drag-and-drop. Add a Node.js sidecar service for ABS Socket.IO listener. Convert item detail modal to full page. All new API routes use Zod validation.

**Tech Stack:** Next.js 15, React 19, Prisma 5, @dnd-kit, socket.io-client, Zod, Tailwind CSS 4, Radix UI

**Design doc:** `docs/plans/2026-03-07-media-tracking-enhancements-design.md`

---

## Phase 1: Foundation

### Task 1: Set Up Test Framework

There are no tests in the project. Set up Vitest for unit/integration testing.

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/__tests__/utils.test.ts`
- Modify: `package.json` (add vitest deps + test script)
- Modify: `tsconfig.json` (add vitest types)

**Step 1: Install Vitest**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [],
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

**Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Write a smoke test for existing utils**

Create `lib/__tests__/utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { slugify, formatYear, formatRating } from '@/lib/utils'

describe('utils', () => {
  describe('slugify', () => {
    it('converts title to slug', () => {
      expect(slugify('Project Hail Mary')).toBe('project-hail-mary')
    })
  })

  describe('formatYear', () => {
    it('formats a valid year', () => {
      expect(formatYear(2024)).toBe('2024')
    })
    it('returns empty string for null', () => {
      expect(formatYear(null)).toBe('')
    })
  })
})
```

**Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add vitest.config.ts lib/__tests__/ package.json package-lock.json tsconfig.json
git commit -m "chore: set up Vitest test framework with utils smoke tests"
```

---

### Task 2: Schema Migration — New Models and Fields

Add all schema changes needed across features in a single migration.

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add AUDIOBOOKSHELF to MetadataSource enum**

```prisma
enum MetadataSource {
  TMDB
  IGDB
  HARDCOVER
  AUDIOBOOKSHELF
  MANUAL
}
```

**Step 2: Add fields to User model**

```prisma
model User {
  // ... existing fields ...
  categoryOrder   String[]  @default(["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"])
  // ... existing relations ...
}
```

**Step 3: Add absLibraryItemId to MediaItem**

```prisma
model MediaItem {
  // ... existing fields ...
  absLibraryItemId String?
  // ... existing relations ...
  similarCache    SimilarItemCache?
}
```

**Step 4: Add listeningProgress relation to MediaEntry**

```prisma
model MediaEntry {
  // ... existing fields and relations ...
  listeningProgress ListeningProgress?
}
```

**Step 5: Add new models**

```prisma
model ListeningProgress {
  id              String   @id @default(cuid())
  mediaEntryId    String   @unique
  progress        Float
  currentTime     Float
  duration        Float
  currentChapter  String?
  lastSyncedAt    DateTime @default(now())

  mediaEntry      MediaEntry @relation(fields: [mediaEntryId], references: [id], onDelete: Cascade)
}

model SimilarItemCache {
  id          String   @id @default(cuid())
  mediaItemId String   @unique
  results     Json
  fetchedAt   DateTime @default(now())

  mediaItem   MediaItem @relation(fields: [mediaItemId], references: [id], onDelete: Cascade)
}
```

**Step 6: Generate and apply migration**

```bash
npx prisma migrate dev --name add_listening_progress_similar_cache_category_order
npx prisma generate
```

**Step 7: Verify schema compiles**

```bash
npm run build
```

If build fails due to new relations not being used yet, that's fine — this validates the schema itself.

**Step 8: Commit**

```bash
git add prisma/
git commit -m "feat: add schema for listening progress, similar cache, category order"
```

---

### Task 3: Install Frontend Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install @dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit dependencies for drag-and-drop"
```

---

## Phase 2: Item Detail Page

Convert the modal-based item detail to a full page. This is a prerequisite for Fix Match and Similar Items.

### Task 4: Create Item Detail Page

**Files:**
- Create: `app/(app)/item/[id]/page.tsx`
- Create: `app/(app)/item/[id]/ItemDetailClient.tsx`
- Modify: `components/media/MediaCard.tsx` (link to /item/[id])

**Step 1: Write the server page component**

Create `app/(app)/item/[id]/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import ItemDetailClient from './ItemDetailClient'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const entry = await prisma.mediaEntry.findFirst({
    where: { id, userId: session.user.id },
    include: {
      mediaItem: true,
      listeningProgress: true,
    },
  })

  if (!entry) notFound()

  return <ItemDetailClient entry={JSON.parse(JSON.stringify(entry))} />
}
```

**Step 2: Write the client component**

Create `app/(app)/item/[id]/ItemDetailClient.tsx` with:
- Header section: poster, title, year, genres, source badge
- Status & Rating section: status selector, RatingWidget, review textarea, dates
- Metadata section: overview/description, author/director from metadata JSON
- Listening Progress section (audiobooks only): progress bar, chapter
- Placeholder sections for Similar Items and Fix Match (to be implemented later)

This is a large component. Key structure:

```typescript
'use client'

import { useState } from 'react'
import { MediaEntry, MediaItem, ListeningProgress } from '@prisma/client'
import { RatingWidget } from '@/components/media/RatingWidget'
import { StatusBadge } from '@/components/media/StatusBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS, STATUS_LABELS } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

type EntryWithRelations = MediaEntry & {
  mediaItem: MediaItem
  listeningProgress: ListeningProgress | null
}

export default function ItemDetailClient({ entry }: { entry: EntryWithRelations }) {
  const [status, setStatus] = useState(entry.status)
  const [rating, setRating] = useState(entry.rating)
  const [reviewText, setReviewText] = useState(entry.reviewText || '')
  const item = entry.mediaItem

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as any)
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  const handleRatingChange = async (newRating: number) => {
    setRating(newRating)
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: newRating }),
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Back button */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Header: poster + metadata */}
      <div className="flex gap-6">
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt={item.title} width={200} height={300}
            className="rounded-xl shadow-md object-cover" />
        ) : (
          <div className="w-[200px] h-[300px] bg-zinc-100 rounded-xl flex items-center justify-center text-4xl">
            {MEDIA_TYPE_ICONS[item.type as keyof typeof MEDIA_TYPE_ICONS]}
          </div>
        )}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{item.title}</h1>
            <p className="text-zinc-500">{MEDIA_TYPE_LABELS[item.type as keyof typeof MEDIA_TYPE_LABELS]} {item.year && `· ${item.year}`}</p>
          </div>
          {item.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {item.genres.map(g => (
                <span key={g} className="px-2 py-1 bg-zinc-100 rounded-md text-sm">{g}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4">
            <StatusBadge status={status} />
            <RatingWidget value={rating || 0} onChange={handleRatingChange} size="lg" />
          </div>
          {/* Status selector buttons */}
          <div className="flex gap-2">
            {['WANT', 'IN_PROGRESS', 'COMPLETED', 'DROPPED'].map(s => (
              <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm"
                onClick={() => handleStatusChange(s)}>
                {STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview */}
      {item.overview && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Overview</h2>
          <p className="text-zinc-700 leading-relaxed">{item.overview}</p>
        </section>
      )}

      {/* Listening Progress (audiobooks only) */}
      {entry.listeningProgress && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Listening Progress</h2>
          <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
            <div className="w-full bg-zinc-200 rounded-full h-3">
              <div className="bg-indigo-600 h-3 rounded-full"
                style={{ width: `${Math.round(entry.listeningProgress.progress * 100)}%` }} />
            </div>
            <div className="flex justify-between text-sm text-zinc-500">
              <span>{Math.round(entry.listeningProgress.progress * 100)}% complete</span>
              {entry.listeningProgress.currentChapter && (
                <span>{entry.listeningProgress.currentChapter}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Review */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Review</h2>
        <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
          placeholder="Write your thoughts..."
          onBlur={() => fetch(`/api/entries/${entry.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewText }),
          })}
        />
      </section>

      {/* Similar Items placeholder */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Similar Items</h2>
        <p className="text-zinc-400 text-sm">Coming soon</p>
      </section>
    </div>
  )
}
```

**Step 3: Update MediaCard to link to /item/[id]**

In `components/media/MediaCard.tsx`, add `entryId` prop and wrap the card in a `Link` to `/item/${entryId}` when provided. Don't break existing usage — make it optional.

**Step 4: Update dashboard to pass entryId to MediaCard**

In `app/(app)/dashboard/page.tsx`, pass `entryId={entry.id}` to each MediaCard so they link to the detail page.

**Step 5: Verify by running the dev server**

```bash
npm run dev
```

Click a media card on the dashboard — it should navigate to `/item/[id]` with full metadata display.

**Step 6: Commit**

```bash
git add app/(app)/item/ components/media/MediaCard.tsx app/(app)/dashboard/page.tsx
git commit -m "feat: add full item detail page replacing modal"
```

---

## Phase 3: Dashboard Layout Overhaul

### Task 5: Collapsible Card-Stack Component

**Files:**
- Create: `components/media/CollapsibleCategory.tsx`
- Create: `components/media/StackedCards.tsx`

**Step 1: Write the StackedCards component**

Displays 1-2 visible cards with a "+N more" stacked indicator:

```typescript
'use client'

interface StackedCardsProps {
  children: React.ReactNode[]  // MediaCard elements
  maxVisible?: number  // default 2
}

export function StackedCards({ children, maxVisible = 2 }: StackedCardsProps) {
  const visible = children.slice(0, maxVisible)
  const remaining = children.length - maxVisible

  return (
    <div className="flex gap-3 items-start">
      {visible}
      {remaining > 0 && (
        <div className="relative w-20 h-[140px] flex items-center justify-center">
          {/* Stacked card visual */}
          <div className="absolute inset-0 bg-zinc-200 rounded-lg rotate-2" />
          <div className="absolute inset-0 bg-zinc-100 rounded-lg -rotate-1" />
          <div className="relative bg-white rounded-lg border border-zinc-200 w-full h-full flex items-center justify-center">
            <span className="text-sm font-medium text-zinc-500">+{remaining}<br/>more</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Write the CollapsibleCategory component**

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { StackedCards } from './StackedCards'
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS } from '@/lib/utils'

interface CollapsibleCategoryProps {
  mediaType: string
  children: React.ReactNode[]
  isExpanded?: boolean
  onToggle?: () => void
}

export function CollapsibleCategory({ mediaType, children, isExpanded, onToggle }: CollapsibleCategoryProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = isExpanded ?? internalExpanded
  const toggle = onToggle ?? (() => setInternalExpanded(!internalExpanded))

  if (children.length === 0) return null

  const icon = MEDIA_TYPE_ICONS[mediaType as keyof typeof MEDIA_TYPE_ICONS]
  const label = MEDIA_TYPE_LABELS[mediaType as keyof typeof MEDIA_TYPE_LABELS]

  return (
    <div>
      <button onClick={toggle}
        className="flex items-center gap-2 w-full text-left py-2 hover:bg-zinc-50 rounded-lg px-2">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-zinc-400 ml-1">({children.length})</span>
        <span className="ml-auto">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-2">
          {children}
        </div>
      ) : (
        <div className="mt-2">
          <StackedCards>{children}</StackedCards>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add components/media/CollapsibleCategory.tsx components/media/StackedCards.tsx
git commit -m "feat: add CollapsibleCategory and StackedCards components"
```

---

### Task 6: Refactor Dashboard with Collapsible Grid Layout

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Create: `app/(app)/dashboard/DashboardClient.tsx`

**Step 1: Create client-side dashboard component**

The dashboard needs client-side state for expand/collapse. Extract the rendering into `DashboardClient.tsx`. This component receives serialized entries and the user's `categoryOrder`.

Key structure:
- Three sections: "Currently Consuming", "Want to Consume", "Recently Consumed"
- Each section groups entries by media type using `CollapsibleCategory`
- Categories rendered in a 2-column responsive grid: `grid grid-cols-1 md:grid-cols-2 gap-4`
- When a category is expanded, it spans full width using CSS: expanded category renders outside the grid as a full-width block below its row
- Categories ordered by user's `categoryOrder` preference

**Step 2: Update the server page component**

Fetch the user's `categoryOrder` from the database and pass it to `DashboardClient`. Serialize all data with `JSON.parse(JSON.stringify(...))`.

**Step 3: Verify responsive layout**

```bash
npm run dev
```

Test at mobile (375px) and desktop (1280px) widths. Collapsed categories should show stacked cards in a 2-column grid on desktop. Expanding one should show full content spanning full width.

**Step 4: Commit**

```bash
git add app/(app)/dashboard/
git commit -m "feat: refactor dashboard with collapsible card-stack grid layout"
```

---

### Task 7: Category Order Settings

**Files:**
- Modify: `app/(app)/settings/page.tsx`
- Create: `app/api/users/category-order/route.ts`

**Step 1: Add category order API route**

Create `app/api/users/category-order/route.ts`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod/v4'

const schema = z.object({
  categoryOrder: z.array(z.enum(['MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME'])).length(5),
})

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { categoryOrder: parsed.data.categoryOrder },
  })

  return NextResponse.json({ ok: true })
}
```

**Step 2: Add drag-and-drop category reorder to Settings page**

Add a "Category Order" section to the settings page with a sortable list of media types using @dnd-kit. Each item shows the icon + label. Reordering calls `PUT /api/users/category-order`.

**Step 3: Commit**

```bash
git add app/(app)/settings/page.tsx app/api/users/category-order/
git commit -m "feat: add configurable category display order in settings"
```

---

## Phase 4: Drag-and-Drop Queue Reordering

### Task 8: Reorder API Endpoint

**Files:**
- Create: `app/api/entries/reorder/route.ts`
- Create: `app/api/entries/__tests__/reorder.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'

// Test the validation logic extracted into a pure function
import { validateReorderPayload } from '../reorder/validation'

describe('validateReorderPayload', () => {
  it('rejects empty entries array', () => {
    const result = validateReorderPayload({ entries: [] })
    expect(result.success).toBe(false)
  })

  it('accepts valid entries', () => {
    const result = validateReorderPayload({
      entries: [
        { id: 'abc', sortOrder: 0 },
        { id: 'def', sortOrder: 1 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative sortOrder', () => {
    const result = validateReorderPayload({
      entries: [{ id: 'abc', sortOrder: -1 }],
    })
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run app/api/entries/__tests__/reorder.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement validation module**

Create `app/api/entries/reorder/validation.ts`:

```typescript
import { z } from 'zod/v4'

const reorderSchema = z.object({
  entries: z.array(z.object({
    id: z.string().min(1),
    sortOrder: z.number().int().min(0),
  })).min(1),
})

export function validateReorderPayload(data: unknown) {
  return reorderSchema.safeParse(data)
}
```

**Step 4: Run test — verify it passes**

```bash
npx vitest run app/api/entries/__tests__/reorder.test.ts
```

Expected: PASS

**Step 5: Implement the API route**

Create `app/api/entries/reorder/route.ts`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { validateReorderPayload } from './validation'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = validateReorderPayload(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const entryIds = parsed.data.entries.map(e => e.id)

  // Verify all entries belong to the user
  const existingEntries = await prisma.mediaEntry.findMany({
    where: { id: { in: entryIds }, userId: session.user.id },
    select: { id: true },
  })

  if (existingEntries.length !== entryIds.length) {
    return NextResponse.json({ error: 'Some entries not found or unauthorized' }, { status: 403 })
  }

  // Atomic batch update
  await prisma.$transaction(
    parsed.data.entries.map(e =>
      prisma.mediaEntry.update({
        where: { id: e.id },
        data: { sortOrder: e.sortOrder },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
```

**Step 6: Commit**

```bash
git add app/api/entries/reorder/ app/api/entries/__tests__/
git commit -m "feat: add PATCH /api/entries/reorder endpoint with Zod validation"
```

---

### Task 9: Drag-and-Drop UI in Want Queue

**Files:**
- Create: `components/media/SortableMediaCard.tsx`
- Modify: `app/(app)/dashboard/DashboardClient.tsx`
- Modify: `components/media/CollapsibleCategory.tsx`

**Step 1: Create SortableMediaCard wrapper**

Wraps MediaCard with @dnd-kit sortable behavior:

```typescript
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableMediaCardProps {
  id: string
  children: React.ReactNode
}

export function SortableMediaCard({ id, children }: SortableMediaCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button {...attributes} {...listeners}
        className="absolute top-1 left-1 z-10 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-zinc-400" />
      </button>
      {children}
    </div>
  )
}
```

**Step 2: Add DndContext to expanded Want queue in DashboardClient**

When the "Want to Consume" section is expanded for a media type, wrap the card grid in:
- `<DndContext>` with `closestCenter` collision detection + pointer + touch sensors
- `<SortableContext>` with `verticalListSortingStrategy` (or rectSortingStrategy for grid)
- Each card wrapped in `<SortableMediaCard>`

On `onDragEnd`: recalculate sort orders and call `PATCH /api/entries/reorder`.

**Step 3: Verify drag-and-drop works**

```bash
npm run dev
```

Expand a Want category, drag items to reorder. Verify the order persists after page refresh.

**Step 4: Commit**

```bash
git add components/media/SortableMediaCard.tsx app/(app)/dashboard/DashboardClient.tsx
git commit -m "feat: add drag-and-drop reordering for Want to Consume queue"
```

---

## Phase 5: Similar Items

### Task 10: Metadata API Similar Endpoints

**Files:**
- Modify: `lib/metadata/tmdb.ts` (add `getSimilarTmdb`)
- Modify: `lib/metadata/igdb.ts` (add `getSimilarIgdb`)
- Modify: `lib/metadata/hardcover.ts` (add `getSimilarHardcover`)

**Step 1: Add getSimilarTmdb**

```typescript
export async function getSimilarTmdb(
  externalId: string,
  mediaType: 'movie' | 'tv'
): Promise<TmdbResult[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []

  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${externalId}/similar?language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) return []

  const data = await res.json()
  return data.results.slice(0, 8).map((item: any) => ({
    // map to TmdbResult format (same as existing searchTmdb mapping)
  }))
}
```

**Step 2: Add getSimilarIgdb**

Use the IGDB `similar_games` field in the existing query pattern.

**Step 3: Add getSimilarHardcover**

Use Hardcover's GraphQL API to query related books (if available), or use genre/author-based search as fallback.

**Step 4: Test each endpoint manually**

```bash
npm run dev
# Call endpoints via curl or browser
```

**Step 5: Commit**

```bash
git add lib/metadata/
git commit -m "feat: add similar items endpoints for TMDB, IGDB, Hardcover"
```

---

### Task 11: Similar Items API Route with Caching

**Files:**
- Create: `app/api/media-items/[id]/similar/route.ts`
- Create: `lib/similar.ts` (cascading resolution logic)

**Step 1: Implement cascading resolution logic**

Create `lib/similar.ts`:

```typescript
import { prisma } from '@/lib/db'
import { getSimilarTmdb } from '@/lib/metadata/tmdb'
import { getSimilarIgdb } from '@/lib/metadata/igdb'
import { getSimilarHardcover } from '@/lib/metadata/hardcover'

const CACHE_TTL_DAYS = 7

export async function getSimilarItems(mediaItemId: string) {
  const item = await prisma.mediaItem.findUnique({ where: { id: mediaItemId } })
  if (!item) return { items: [], source: 'none' as const }

  // Check cache
  const cached = await prisma.similarItemCache.findUnique({ where: { mediaItemId } })
  if (cached && daysSince(cached.fetchedAt) < CACHE_TTL_DAYS) {
    return { items: cached.results as any[], source: 'cache' as const }
  }

  // Strategy 1: Direct external source lookup
  let results = await fetchSimilarFromSource(item)

  // Strategy 2: Title-based search fallback
  if (results.length === 0 && (item.source === 'MANUAL' || item.source === 'AUDIOBOOKSHELF')) {
    results = await fetchSimilarByTitleSearch(item)
  }

  // Strategy 3: AI fallback (if configured)
  if (results.length === 0 && process.env.AI_PROVIDER) {
    results = await fetchSimilarFromAI(item)
  }

  // Cache results
  if (results.length > 0) {
    await prisma.similarItemCache.upsert({
      where: { mediaItemId },
      create: { mediaItemId, results, fetchedAt: new Date() },
      update: { results, fetchedAt: new Date() },
    })
  }

  return { items: results, source: results.length > 0 ? 'fresh' : 'none' as const }
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
}

async function fetchSimilarFromSource(item: any) {
  switch (item.source) {
    case 'TMDB': {
      const type = item.type === 'MOVIE' ? 'movie' : 'tv'
      return getSimilarTmdb(item.externalId, type)
    }
    case 'IGDB':
      return getSimilarIgdb(item.externalId)
    case 'HARDCOVER':
      return getSimilarHardcover(item.externalId)
    default:
      return []
  }
}

async function fetchSimilarByTitleSearch(item: any) {
  // Search by title on the appropriate API, take best match, then get similar
  // Implementation depends on media type
  return []
}

async function fetchSimilarFromAI(item: any) {
  // Use existing AI provider to generate similar items
  // Similar to existing suggestion system but for a single item
  return []
}
```

**Step 2: Create API route**

Create `app/api/media-items/[id]/similar/route.ts`:

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getSimilarItems } from '@/lib/similar'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await getSimilarItems(id)

  return NextResponse.json(result)
}
```

**Step 3: Commit**

```bash
git add lib/similar.ts app/api/media-items/
git commit -m "feat: add similar items API with cascading resolution and 7-day caching"
```

---

### Task 12: Similar Items Section on Item Detail Page

**Files:**
- Modify: `app/(app)/item/[id]/ItemDetailClient.tsx`
- Create: `components/media/SimilarItemsSection.tsx`

**Step 1: Create SimilarItemsSection component**

Fetches similar items on mount and displays as horizontal scrollable card row. Shows "Fix Match" prompt if no results and no external source.

**Step 2: Add to ItemDetailClient**

Replace the placeholder section with `<SimilarItemsSection mediaItemId={item.id} source={item.source} />`.

**Step 3: Commit**

```bash
git add components/media/SimilarItemsSection.tsx app/(app)/item/
git commit -m "feat: add similar items section to item detail page"
```

---

## Phase 6: Fix Match

### Task 13: Metadata Detail API Route

**Files:**
- Create: `app/api/metadata/details/route.ts`

**Step 1: Create the API route**

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getTmdbDetail } from '@/lib/metadata/tmdb'
import { getIgdbDetail } from '@/lib/metadata/igdb'
import { getHardcoverDetail } from '@/lib/metadata/hardcover'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const id = searchParams.get('id')
  if (!source || !id) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  let detail
  switch (source) {
    case 'TMDB': detail = await getTmdbDetail(id, searchParams.get('mediaType') || 'movie'); break
    case 'IGDB': detail = await getIgdbDetail(id); break
    case 'HARDCOVER': detail = await getHardcoverDetail(id, false); break
    default: return NextResponse.json({ error: 'Unknown source' }, { status: 400 })
  }

  return NextResponse.json(detail)
}
```

**Step 2: Commit**

```bash
git add app/api/metadata/details/
git commit -m "feat: add metadata details API route for Fix Match"
```

---

### Task 14: Match API Endpoint

**Files:**
- Create: `app/api/media-items/[id]/match/route.ts`

**Step 1: Implement the match endpoint**

Accepts selected field overrides and updates the MediaItem:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod/v4'

const matchSchema = z.object({
  source: z.enum(['TMDB', 'IGDB', 'HARDCOVER']),
  externalId: z.string(),
  fields: z.object({
    title: z.boolean().optional(),
    year: z.boolean().optional(),
    posterUrl: z.boolean().optional(),
    backdropUrl: z.boolean().optional(),
    overview: z.boolean().optional(),
    genres: z.boolean().optional(),
    metadata: z.boolean().optional(),
  }),
  externalData: z.record(z.unknown()),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = matchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Verify user owns an entry for this media item
  const entry = await prisma.mediaEntry.findFirst({
    where: { mediaItemId: id, userId: session.user.id },
  })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const item = await prisma.mediaItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // Build update data from selected fields
  const updateData: Record<string, any> = {
    source: parsed.data.source,
    externalId: parsed.data.externalId,
  }

  // Preserve ABS link if the item was from ABS
  if (item.source === 'AUDIOBOOKSHELF') {
    updateData.absLibraryItemId = item.externalId
  }

  const ext = parsed.data.externalData
  if (parsed.data.fields.title) updateData.title = ext.title
  if (parsed.data.fields.year) updateData.year = ext.year
  if (parsed.data.fields.posterUrl) updateData.posterUrl = ext.posterUrl
  if (parsed.data.fields.backdropUrl) updateData.backdropUrl = ext.backdropUrl
  if (parsed.data.fields.overview) updateData.overview = ext.overview
  if (parsed.data.fields.genres) updateData.genres = ext.genres
  if (parsed.data.fields.metadata) updateData.metadata = ext.metadata

  const updated = await prisma.mediaItem.update({
    where: { id },
    data: updateData,
  })

  // Invalidate similar items cache
  await prisma.similarItemCache.deleteMany({ where: { mediaItemId: id } })

  return NextResponse.json(updated)
}
```

**Step 2: Commit**

```bash
git add app/api/media-items/
git commit -m "feat: add PATCH /api/media-items/[id]/match for Fix Match"
```

---

### Task 15: Fix Match Inline UI on Item Detail Page

**Files:**
- Create: `components/media/FixMatchSection.tsx`
- Modify: `app/(app)/item/[id]/ItemDetailClient.tsx`

**Step 1: Create FixMatchSection component**

Three states: idle (shows "Fix Match" button), searching (search input + results list), merging (side-by-side field comparison with toggle checkboxes).

Key UI:
- Search input pre-filled with item title
- Source selector dropdown (TMDB / IGDB / Hardcover)
- Results list with poster thumbnail, title, year, description
- Clicking a result transitions to merge preview
- Merge preview: two columns (Current | External) for each field with checkbox toggles
- "Update All" button at top, "Apply Selected" at bottom
- Cancel by clicking away or pressing Escape

**Step 2: Add to ItemDetailClient**

Add `<FixMatchSection mediaItem={item} onMatchApplied={refreshItem} />` as an inline section on the detail page.

**Step 3: Verify the full flow**

```bash
npm run dev
```

Navigate to an item → click Fix Match → search → pick a result → toggle fields → apply. Verify the item updates and similar items reload.

**Step 4: Commit**

```bash
git add components/media/FixMatchSection.tsx app/(app)/item/
git commit -m "feat: add inline Fix Match UI on item detail page"
```

---

## Phase 7: Discover Recommendations

### Task 16: Discover Algorithm

**Files:**
- Create: `lib/discover.ts`
- Create: `app/api/discover/route.ts`
- Create: `lib/__tests__/discover.test.ts`

**Step 1: Write the failing test for the aggregation algorithm**

```typescript
import { describe, it, expect } from 'vitest'
import { aggregateAndRank } from '@/lib/discover'

describe('aggregateAndRank', () => {
  it('deduplicates and ranks by frequency', () => {
    const similarSets = [
      [{ title: 'A', externalId: '1' }, { title: 'B', externalId: '2' }],
      [{ title: 'A', externalId: '1' }, { title: 'C', externalId: '3' }],
    ]
    const existing = new Set<string>()
    const result = aggregateAndRank(similarSets, existing)

    expect(result[0].title).toBe('A')  // appears in 2 sets
    expect(result[0].frequency).toBe(2)
    expect(result.length).toBe(3)
  })

  it('filters out items already in library', () => {
    const similarSets = [
      [{ title: 'A', externalId: '1' }, { title: 'B', externalId: '2' }],
    ]
    const existing = new Set(['1'])
    const result = aggregateAndRank(similarSets, existing)

    expect(result.length).toBe(1)
    expect(result[0].title).toBe('B')
  })
})
```

**Step 2: Run test — verify it fails**

**Step 3: Implement**

Create `lib/discover.ts` with the `aggregateAndRank` pure function and the full `getDiscoverRecommendations(userId, mediaType)` function that:
1. Fetches top-rated entries
2. Fetches similar items for each from metadata APIs
3. Calls `aggregateAndRank`
4. Optionally merges AI suggestions if configured

**Step 4: Run test — verify it passes**

**Step 5: Create API route**

`GET /api/discover?type=MOVIE` — returns ranked recommendations for the given type.

**Step 6: Commit**

```bash
git add lib/discover.ts lib/__tests__/discover.test.ts app/api/discover/
git commit -m "feat: add metadata-aggregated Discover recommendations"
```

---

### Task 17: Discover Dashboard Section

**Files:**
- Modify: `app/(app)/dashboard/DashboardClient.tsx`
- Create: `components/media/DiscoverSection.tsx`

**Step 1: Create DiscoverSection component**

Fetches recommendations from `/api/discover?type=<type>` on mount. Uses the same `CollapsibleCategory` pattern. Shows "AI pick" badge on AI-enhanced items. Only renders for types with >= 3 rated entries.

**Step 2: Add to dashboard below the main sections**

**Step 3: Commit**

```bash
git add components/media/DiscoverSection.tsx app/(app)/dashboard/
git commit -m "feat: add Discover recommendations section to dashboard"
```

---

## Phase 8: ABS Sidecar Service

### Task 18: Create abs-listener Service Structure

**Files:**
- Create: `abs-listener/package.json`
- Create: `abs-listener/tsconfig.json`
- Create: `abs-listener/Dockerfile`
- Create: `abs-listener/src/index.ts`
- Create: `abs-listener/src/config.ts`

**Step 1: Initialize the service**

```bash
mkdir -p abs-listener/src
cd abs-listener
```

Create `package.json`:

```json
{
  "name": "vellum-abs-listener",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "prisma": "^5.22.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Create `src/config.ts`:

```typescript
export const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  absUrl: process.env.ABS_URL || '',
  absUsername: process.env.ABS_USERNAME || '',
  absPassword: process.env.ABS_PASSWORD || '',
}

export function validateConfig() {
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
}
```

**Step 2: Create Dockerfile**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma/ ./prisma/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
CMD ["node", "dist/index.js"]
```

Note: The service needs access to the same `prisma/schema.prisma` as the main app. Symlink or copy it.

**Step 3: Commit**

```bash
git add abs-listener/
git commit -m "feat: scaffold abs-listener sidecar service"
```

---

### Task 19: ABS Socket.IO Listener + Auth

**Files:**
- Create: `abs-listener/src/abs-client.ts`

**Step 1: Implement the ABS client**

```typescript
import { io, Socket } from 'socket.io-client'
import { config } from './config'

export class ABSClient {
  private socket: Socket | null = null
  private token: string | null = null

  async connect(): Promise<void> {
    // Step 1: HTTP login to get token
    const loginRes = await fetch(`${config.absUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.absUsername,
        password: config.absPassword,
      }),
    })

    if (!loginRes.ok) throw new Error(`ABS login failed: ${loginRes.status}`)
    const loginData = await loginRes.json()
    this.token = loginData.user.token

    // Step 2: Socket.IO connection
    this.socket = io(config.absUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
    })

    this.socket.on('connect', () => {
      console.log('[ABS] Socket connected, authenticating...')
      this.socket!.emit('auth', this.token)
    })

    this.socket.on('init', (data: any) => {
      console.log('[ABS] Authenticated successfully')
    })

    this.socket.on('connect_error', (err: Error) => {
      console.error('[ABS] Connection error:', err.message)
    })

    this.socket.on('disconnect', (reason: string) => {
      console.warn('[ABS] Disconnected:', reason)
    })
  }

  onProgressUpdate(handler: (data: any) => void): void {
    if (!this.socket) throw new Error('Not connected')
    this.socket.on('user_item_progress_updated', handler)
  }

  async getItemDetails(libraryItemId: string): Promise<any> {
    const res = await fetch(`${config.absUrl}/api/items/${libraryItemId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch item ${libraryItemId}`)
    return res.json()
  }
}
```

**Step 2: Commit**

```bash
git add abs-listener/src/abs-client.ts
git commit -m "feat: implement ABS Socket.IO client with auth and reconnection"
```

---

### Task 20: Item Matching + Progress Writing

**Files:**
- Create: `abs-listener/src/sync.ts`
- Modify: `abs-listener/src/index.ts`

**Step 1: Implement sync logic**

Create `abs-listener/src/sync.ts` with:
- `syncProgress(absClient, event)` — main handler for progress updates
- Multi-strategy matching (ABS ID → title fuzzy match → create new)
- Auto-status detection (0% → WANT, 0-100% → IN_PROGRESS, 100% → COMPLETED)
- Upsert `ListeningProgress` record with current chapter info

**Step 2: Wire up in index.ts**

```typescript
import { validateConfig, config } from './config'
import { ABSClient } from './abs-client'
import { syncProgress } from './sync'
import { PrismaClient } from '@prisma/client'

async function main() {
  validateConfig()

  const prisma = new PrismaClient()
  const abs = new ABSClient()

  console.log('[ABS-Listener] Starting...')
  await abs.connect()

  abs.onProgressUpdate(async (event) => {
    try {
      await syncProgress(prisma, abs, event)
    } catch (err) {
      console.error('[ABS-Listener] Sync error:', err)
    }
  })

  console.log('[ABS-Listener] Listening for progress updates')
}

main().catch((err) => {
  console.error('[ABS-Listener] Fatal error:', err)
  process.exit(1)
})
```

**Step 3: Commit**

```bash
git add abs-listener/src/
git commit -m "feat: implement ABS progress sync with multi-strategy item matching"
```

---

### Task 21: Docker Compose Integration

**Files:**
- Modify: `docker-compose.yml`
- Create: `abs-listener/prisma/` (symlink or copy schema)

**Step 1: Copy prisma schema to abs-listener**

The abs-listener needs access to the Prisma schema. Create a build script or symlink:

```bash
# In abs-listener/Dockerfile, copy from parent:
COPY ../prisma/schema.prisma ./prisma/schema.prisma
```

Or use Docker build context from the root. Adjust the Dockerfile accordingly.

**Step 2: Add abs-listener service to docker-compose.yml**

```yaml
  abs-listener:
    build:
      context: .
      dockerfile: abs-listener/Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://vellum:vellum@db:5432/vellum
      # ---------------------------------------------------------------------------
      # OPTIONAL — Audiobookshelf real-time progress sync
      # Set your ABS instance URL and credentials to enable live scrobbling
      # ---------------------------------------------------------------------------
      ABS_URL: ""
      ABS_USERNAME: ""
      ABS_PASSWORD: ""
```

**Step 3: Commit**

```bash
git add docker-compose.yml abs-listener/
git commit -m "feat: add abs-listener sidecar service to docker-compose"
```

---

### Task 22: Listening Progress Display on Dashboard

**Files:**
- Modify: `components/media/MediaCard.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (include listeningProgress in query)

**Step 1: Update dashboard query to include listeningProgress**

In the dashboard server component, add `listeningProgress: true` to the `include` clause of the entries query.

**Step 2: Update MediaCard to show progress bar for audiobooks**

When `listeningProgress` is passed as a prop, show a small progress bar at the bottom of the card and the chapter name.

**Step 3: Commit**

```bash
git add components/media/MediaCard.tsx app/(app)/dashboard/
git commit -m "feat: show listening progress on audiobook cards in dashboard"
```

---

## Phase 9: Security Hardening

### Task 23: Input Validation Audit

**Files:**
- Modify: all API routes in `app/api/` that accept request bodies

**Step 1: Audit each API route for Zod validation**

Check every POST/PUT/PATCH/DELETE route. Add Zod validation where missing. The existing entries route already uses Zod — follow that pattern.

Routes to audit:
- `app/api/entries/route.ts` — ✅ has Zod
- `app/api/entries/[id]/route.ts` — check if PUT body is validated
- `app/api/entries/[id]/promote/route.ts` — check
- `app/api/lists/route.ts` — check
- `app/api/lists/[id]/route.ts` — check
- `app/api/users/route.ts` — check
- `app/api/scrobble/*/route.ts` — check webhook payloads

**Step 2: Commit**

```bash
git add app/api/
git commit -m "security: add Zod validation to all API route request bodies"
```

---

### Task 24: Rate Limiting + Secrets Management

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `.env.example`
- Modify: `app/api/auth/[...nextauth]/route.ts` (add rate limiting)
- Modify: `.gitignore` (ensure .env is listed)

**Step 1: Implement in-memory rate limiter**

Simple token-bucket rate limiter for API routes. No external dependencies.

```typescript
const buckets = new Map<string, { tokens: number; lastRefill: number }>()

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.lastRefill > windowMs) {
    buckets.set(key, { tokens: maxRequests - 1, lastRefill: now })
    return true
  }

  if (bucket.tokens > 0) {
    bucket.tokens--
    return true
  }

  return false
}
```

**Step 2: Create .env.example**

List all env vars with placeholder values. No real secrets.

**Step 3: Verify .gitignore excludes .env**

**Step 4: Commit**

```bash
git add lib/rate-limit.ts .env.example .gitignore app/api/auth/
git commit -m "security: add rate limiting and .env.example, verify .gitignore"
```

---

### Task 25: API Key Exposure Audit + npm audit

**Files:**
- No file changes expected (audit only)

**Step 1: Check for NEXT_PUBLIC_ prefix on sensitive vars**

```bash
grep -r "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Verify none of the sensitive keys (API keys, secrets, passwords) use `NEXT_PUBLIC_` prefix.

**Step 2: Run npm audit**

```bash
npm audit
```

Fix any high/critical vulnerabilities.

**Step 3: Verify no secrets in committed code**

```bash
git log --all -p | grep -i "api_key\|secret\|password" | head -20
```

Ensure only placeholder values or env var references appear.

**Step 4: Commit any fixes**

```bash
git commit -m "security: resolve npm audit findings and verify no exposed secrets"
```

---

## Execution Dependency Graph

```
Task 1 (tests) ──┐
Task 2 (schema) ──┤
Task 3 (deps) ────┤
                   ├──→ Task 4 (item detail page)
                   │         │
                   │         ├──→ Task 12 (similar items UI)
                   │         ├──→ Task 15 (fix match UI)
                   │         │
                   ├──→ Task 5-6 (dashboard layout)
                   │         │
                   │         ├──→ Task 7 (category order)
                   │         ├──→ Task 8-9 (drag-and-drop)
                   │         ├──→ Task 17 (discover section)
                   │         └──→ Task 22 (progress display)
                   │
                   ├──→ Task 10-11 (similar items API)
                   ├──→ Task 13-14 (fix match API)
                   ├──→ Task 16 (discover algorithm)
                   ├──→ Task 18-21 (ABS sidecar)
                   └──→ Task 23-25 (security)
```

**Parallel work possible:**
- Tasks 4 + 5-6 can run in parallel (different files)
- Tasks 10-11 + 13-14 can run in parallel (different API routes)
- Tasks 18-21 (ABS sidecar) are fully independent of frontend work
- Tasks 23-25 (security) can run anytime after all API routes exist
