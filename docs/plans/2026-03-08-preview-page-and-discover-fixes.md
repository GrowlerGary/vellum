# Preview Page, Similar Items Filter & Discover Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a non-library item preview page (`/media/[id]`), filter Similar Items to the parent's media type, and fix the Discover section's expand-to-full-width layout bug.

**Architecture:** The `POST /api/entries/open` endpoint is changed to only upsert the MediaItem (no entry creation). It returns `{ itemId, entryId? }`. Callers navigate to `/item/[entryId]` if the user already owns it, or to `/media/[itemId]` if not. The preview page mirrors the item detail layout but replaces status/rating controls with an "Add to library" section — clicking any status button or star creates the entry and redirects. Similar Items are filtered client-side by parent `mediaType`. The Discover expand bug is fixed by lifting expansion state and applying `col-span-full` to expanded grid cells.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), TypeScript, Tailwind CSS, shadcn/ui Button, lucide-react icons, Zod.

---

### Task 1: Update `POST /api/entries/open` — upsert MediaItem only, no entry creation

**Files:**
- Modify: `app/api/entries/open/route.ts`

**Step 1: Update the route to not create an entry**

Replace the bottom half of the POST handler (after the MediaItem upsert) with:

```typescript
  // Check if user already has an entry for this item
  const existing = await db.mediaEntry.findUnique({
    where: { userId_mediaItemId: { userId: session.user.id, mediaItemId: mediaItem.id } },
    select: { id: true },
  })

  return NextResponse.json({
    itemId: mediaItem.id,
    entryId: existing?.id ?? null,
  })
```

The response shape changes from `{ entryId: string }` (always) to `{ itemId: string, entryId: string | null }`.

**Step 2: Run TypeScript check**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors in `DiscoverSection.tsx` and `SimilarItemsSection.tsx` (callers that still expect `entryId` — fix in Task 2).

**Step 3: Commit**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && git add app/api/entries/open/route.ts && git commit -m "feat: open endpoint returns itemId + optional entryId without creating entry"
```

---

### Task 2: Update `DiscoverSection.tsx` and `SimilarItemsSection.tsx` click handlers

**Files:**
- Modify: `components/media/DiscoverSection.tsx`
- Modify: `components/media/SimilarItemsSection.tsx`

Both files have an `openItem` async function that currently does:
```typescript
const data = await res.json() as { entryId: string }
router.push(`/item/${data.entryId}`)
```

**Step 1: Update `openItem` in `DiscoverSection.tsx`**

Change the response type and navigation logic:
```typescript
const data = await res.json() as { itemId: string; entryId: string | null }
router.push(data.entryId ? `/item/${data.entryId}` : `/media/${data.itemId}`)
```

**Step 2: Update `openItem` in `SimilarItemsSection.tsx`**

Same change — find the `openItem` function and apply:
```typescript
const data = await res.json() as { itemId: string; entryId: string | null }
router.push(data.entryId ? `/item/${data.entryId}` : `/media/${data.itemId}`)
```

**Step 3: Run TypeScript check**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

**Step 4: Commit**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && git add components/media/DiscoverSection.tsx components/media/SimilarItemsSection.tsx && git commit -m "feat: navigate to preview page for unowned items"
```

---

### Task 3: Create `app/(app)/media/[id]/page.tsx` — server component

**Files:**
- Create: `app/(app)/media/[id]/page.tsx`

This is the server component for the preview page. It fetches the MediaItem by DB ID and checks whether the current user already has an entry (in case they just added it). If they do have an entry, it redirects to `/item/[entryId]`.

```typescript
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import MediaPreviewClient from './MediaPreviewClient'

export default async function MediaPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const mediaItem = await db.mediaItem.findUnique({
    where: { id },
  })

  if (!mediaItem) notFound()

  // If user already has an entry, send them to the full detail page
  const entry = await db.mediaEntry.findUnique({
    where: { userId_mediaItemId: { userId: session.user.id, mediaItemId: id } },
    select: { id: true },
  })
  if (entry) redirect(`/item/${entry.id}`)

  return <MediaPreviewClient mediaItem={JSON.parse(JSON.stringify(mediaItem))} />
}
```

**Step 1: Run TypeScript check**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npx tsc --noEmit 2>&1 | head -30
```

Expected: error about missing `MediaPreviewClient` — fine, implementing in Task 4.

**Step 2: Commit (with –allow-empty guard — skip if TS errors)**

Wait for Task 4 before committing.

---

### Task 4: Create `app/(app)/media/[id]/MediaPreviewClient.tsx` — client component

**Files:**
- Create: `app/(app)/media/[id]/MediaPreviewClient.tsx`

This is a client component that mirrors `ItemDetailClient` layout but replaces status/rating controls with an "Add to my library" section.

**Key behaviors:**
- Clicking any status button → calls `POST /api/entries` with status + full mediaItem data → navigates to `/item/[newEntryId]`
- Clicking a star rating → calls `POST /api/entries` with `status: 'COMPLETED'` + the chosen rating → navigates to `/item/[newEntryId]`
- No review text box (nothing to save to yet)
- Shows SimilarItemsSection with `parentMediaType={mediaItem.type}`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MediaItem } from '@prisma/client'
import { RatingWidget } from '@/components/media/RatingWidget'
import { Button } from '@/components/ui/button'
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS, STATUS_LABELS } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { SimilarItemsSection } from '@/components/media/SimilarItemsSection'

export default function MediaPreviewClient({ mediaItem }: { mediaItem: MediaItem }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  const icon = MEDIA_TYPE_ICONS[mediaItem.type] ?? '📦'
  const typeLabel = MEDIA_TYPE_LABELS[mediaItem.type] ?? mediaItem.type

  const addToLibrary = async (status: string, rating?: number) => {
    if (adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaItem: {
            externalId: mediaItem.externalId,
            source: mediaItem.source,
            type: mediaItem.type,
            title: mediaItem.title,
            year: mediaItem.year,
            posterUrl: mediaItem.posterUrl,
            overview: mediaItem.overview,
            genres: mediaItem.genres,
          },
          status,
          rating: rating ?? null,
        }),
      })
      if (res.ok) {
        const entry = await res.json() as { id: string }
        router.push(`/item/${entry.id}`)
      }
    } finally {
      setAdding(false)
    }
  }

  const handleRating = (rating: number | null) => {
    if (rating != null) addToLibrary('COMPLETED', rating)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Header: poster + metadata */}
      <div className="flex flex-col sm:flex-row gap-6">
        {mediaItem.posterUrl ? (
          <div className="relative w-[180px] h-[270px] flex-shrink-0">
            <Image
              src={mediaItem.posterUrl}
              alt={mediaItem.title}
              fill
              className="rounded-xl shadow-md object-cover"
              sizes="180px"
            />
          </div>
        ) : (
          <div className="w-[180px] h-[270px] flex-shrink-0 bg-zinc-100 rounded-xl flex items-center justify-center text-5xl">
            {icon}
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{mediaItem.title}</h1>
            <p className="text-zinc-500 mt-1">
              {typeLabel}
              {mediaItem.year ? ` · ${mediaItem.year}` : ''}
              {' · '}
              <span className="text-xs uppercase tracking-wide text-zinc-400">{mediaItem.source}</span>
            </p>
          </div>

          {mediaItem.genres && mediaItem.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {mediaItem.genres.map((g) => (
                <span key={g} className="px-2 py-1 bg-zinc-100 rounded-md text-xs text-zinc-600">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Add to library section */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-zinc-600">Add to my library</p>
            <div className="flex gap-2 flex-wrap">
              {(['WANT', 'IN_PROGRESS', 'COMPLETED', 'DROPPED'] as const).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={adding}
                  onClick={() => addToLibrary(s)}
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">Or rate it (adds as Completed):</span>
              <RatingWidget value={null} onChange={handleRating} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Overview */}
      {mediaItem.overview && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Overview</h2>
          <p className="text-zinc-700 leading-relaxed">{mediaItem.overview}</p>
        </section>
      )}

      {/* Similar Items */}
      <SimilarItemsSection
        mediaItemId={mediaItem.id}
        mediaSource={mediaItem.source}
        parentMediaType={mediaItem.type}
      />
    </div>
  )
}
```

**Note:** `SimilarItemsSection` will need the `parentMediaType` prop added in Task 5 — TypeScript will error until then, which is expected.

**Step 1: Run TypeScript check**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `parentMediaType` on `SimilarItemsSection` (fixed in Task 5).

**Step 2: Commit both files**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && git add "app/(app)/media/[id]/page.tsx" "app/(app)/media/[id]/MediaPreviewClient.tsx" && git commit -m "feat: add /media/[id] preview page for unowned items"
```

---

### Task 5: Add `parentMediaType` filter to `SimilarItemsSection`

Filter similar items to only show those matching the parent item's media type (e.g. viewing an Audiobook → only show Audiobook similar items).

**Files:**
- Modify: `components/media/SimilarItemsSection.tsx`
- Modify: `app/(app)/item/[id]/ItemDetailClient.tsx`

**Step 1: Update `SimilarItemsSectionProps` in `SimilarItemsSection.tsx`**

Add the new prop to the interface:
```typescript
interface SimilarItemsSectionProps {
  mediaItemId: string
  mediaSource: string
  parentMediaType: string   // ← add this
}
```

Update the function signature:
```typescript
export function SimilarItemsSection({ mediaItemId, mediaSource, parentMediaType }: SimilarItemsSectionProps) {
```

**Step 2: Apply the filter before rendering**

In the return block where `result.items.map(...)` is rendered, filter first:
```typescript
const filteredItems = result.items.filter((item) => item.mediaType === parentMediaType)
```

Use `filteredItems` in place of `result.items` for the map:
```typescript
{filteredItems.map((item) => (
  <SimilarCard ... />
))}
```

Also update the empty-state check: use `filteredItems.length === 0` instead of `result.items.length === 0` for the "no items" branch (but keep `result.items.length === 0` check for the initial `!result || result.items.length === 0` early return — split the logic: if `result.items.length > 0` but `filteredItems.length === 0`, show a filtered-empty message).

Updated empty state (replace the `if (!result || result.items.length === 0)` block):
```typescript
if (!result || result.items.length === 0) {
  const isManual = mediaSource === 'MANUAL' || mediaSource === 'AUDIOBOOKSHELF'
  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Similar Items</h2>
      {isManual ? (
        <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
          No similar items found. Try using{' '}
          <span className="font-medium text-zinc-700">Fix Match</span> below to link this item
          to an external source so we can find recommendations.
        </div>
      ) : (
        <p className="text-zinc-400 text-sm">No similar items found for this title.</p>
      )}
    </section>
  )
}

const filteredItems = result.items.filter((item) => item.mediaType === parentMediaType)

if (filteredItems.length === 0) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Similar Items</h2>
      <p className="text-zinc-400 text-sm">No similar items of this type found.</p>
    </section>
  )
}
```

Then use `filteredItems` in the final render map.

**Step 3: Update `ItemDetailClient.tsx` to pass `parentMediaType`**

Find the `<SimilarItemsSection>` usage:
```tsx
<SimilarItemsSection mediaItemId={item.id} mediaSource={item.source} />
```

Add the prop:
```tsx
<SimilarItemsSection
  mediaItemId={item.id}
  mediaSource={item.source}
  parentMediaType={item.type}
/>
```

**Step 4: Run TypeScript check**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

**Step 5: Run tests**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npm test 2>&1
```

Expected: all 21 tests pass.

**Step 6: Commit**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && git add components/media/SimilarItemsSection.tsx "app/(app)/item/[id]/ItemDetailClient.tsx" && git commit -m "feat: filter similar items to match parent media type"
```

---

### Task 6: Fix Discover section expand-to-full-width

When a Discover type section is expanded, it should span the full width of the 2-column grid rather than staying in one column.

**Files:**
- Modify: `components/media/DiscoverSection.tsx`

**Step 1: Lift `isExpanded` state into `DiscoverSection`**

Currently each `DiscoverTypeSection` manages its own `isExpanded` state. Change it so `DiscoverSection` manages a `Set<string>` of expanded types.

Add to `DiscoverSection`:
```typescript
const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

const toggleExpanded = (type: string) => {
  setExpandedTypes((prev) => {
    const next = new Set(prev)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    return next
  })
}
```

**Step 2: Update `DiscoverTypeSectionProps` and `DiscoverTypeSection`**

Add props for expansion control:
```typescript
interface DiscoverTypeSectionProps {
  mediaType: string
  items: DiscoverItem[]
  isExpanded: boolean
  onToggle: () => void
}
```

Remove `const [isExpanded, setIsExpanded] = useState(false)` from inside `DiscoverTypeSection`.

Replace the toggle button's `onClick`:
```tsx
<button
  onClick={onToggle}
  ...
>
```

**Step 3: Pass props from `DiscoverSection` to `DiscoverTypeSection`**

In the grid render:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {typesWithResults.map((type) => (
    <div
      key={type}
      className={expandedTypes.has(type) ? 'md:col-span-2' : ''}
    >
      <DiscoverTypeSection
        mediaType={type}
        items={results[type].items}
        isExpanded={expandedTypes.has(type)}
        onToggle={() => toggleExpanded(type)}
      />
    </div>
  ))}
</div>
```

**Step 4: Run TypeScript check**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

**Step 5: Run tests**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && npm test 2>&1
```

Expected: all 21 tests pass.

**Step 6: Commit**

```bash
cd /Users/marco/repos/TwoBitLab/vellum && git add components/media/DiscoverSection.tsx && git commit -m "fix: discover sections expand to full width when opened"
```

---

### Task 7: Push to main

```bash
cd /Users/marco/repos/TwoBitLab/vellum && git push origin main
```
