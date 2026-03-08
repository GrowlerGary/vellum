# Delete Item from Detail Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users delete a media item (and its full DB record) directly from the item detail page, with a lightweight inline confirmation step.

**Architecture:** New `DELETE /api/media-items/[id]` route deletes all dependent records in the correct FK order then removes the MediaItem. The detail page client component adds a two-stage inline button (delete → confirm/cancel) with no modal or new dependencies. On success, the user is navigated to `/dashboard`.

**Tech Stack:** Next.js 15 App Router, Prisma, Radix UI / Tailwind (existing), Vitest (tests run with `npm test`)

---

### Task 1: Backend — `DELETE /api/media-items/[id]/route.ts`

**Files:**
- Create: `app/api/media-items/[id]/route.ts`
  _(note: `match/route.ts` already exists inside this `[id]` directory — add `route.ts` at the `[id]` level)_

**Step 1: Create the route file**

```typescript
// app/api/media-items/[id]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Authorization: requesting user must own an entry for this item
  const entry = await db.mediaEntry.findFirst({
    where: { mediaItemId: id, userId: session.user.id },
  })
  if (!entry)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete in FK-safe order.
  // AiSuggestion and ListItem have no onDelete cascade from MediaItem,
  // so they must be removed first. MediaEntry cascades to ListeningProgress.
  // MediaItem cascades to SimilarItemCache.
  await db.aiSuggestion.deleteMany({ where: { mediaItemId: id } })
  await db.listItem.deleteMany({ where: { mediaItemId: id } })
  await db.mediaEntry.deleteMany({ where: { mediaItemId: id } })
  await db.mediaItem.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
```

**Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: no errors (or no new errors vs baseline).

**Step 3: Smoke-test the endpoint manually**

Start the dev server (`npm run dev`), open an item detail page, and in the browser console run:
```js
await fetch('/api/media-items/<item-id>', { method: 'DELETE' }).then(r => r.status)
// Expected: 204
```
Confirm the item is gone from the dashboard.

**Step 4: Commit**

```bash
git add app/api/media-items/[id]/route.ts
git commit -m "feat: add DELETE /api/media-items/[id] endpoint"
```

---

### Task 2: Frontend — Inline delete UI in `ItemDetailClient.tsx`

**Files:**
- Modify: `app/(app)/item/[id]/ItemDetailClient.tsx`

**Step 1: Add `Trash2` to the lucide-react import and add state**

Find the existing lucide import:
```typescript
import { ArrowLeft } from 'lucide-react'
```
Replace with:
```typescript
import { ArrowLeft, Trash2 } from 'lucide-react'
```

Inside `ItemDetailClient`, after the existing state declarations (`status`, `rating`, `reviewText`), add:
```typescript
const [deleteStage, setDeleteStage] = useState<'idle' | 'confirm' | 'deleting'>('idle')
```

**Step 2: Add the `handleDelete` function**

After `handleReviewBlur`, add:
```typescript
const handleDelete = async () => {
  setDeleteStage('deleting')
  const res = await fetch(`/api/media-items/${item.id}`, { method: 'DELETE' })
  if (res.ok) {
    router.push('/dashboard')
  } else {
    // Reset on error so the user can try again
    setDeleteStage('idle')
  }
}
```

**Step 3: Add the delete UI at the bottom of the page**

The rendered JSX ends with `</div>` (closing the outer `max-w-4xl` div). Add a new section just before that closing tag, after the `<FixMatchSection … />` block:

```tsx
{/* Danger zone */}
<section className="pt-4 border-t border-zinc-100">
  {deleteStage === 'idle' && (
    <Button
      variant="outline"
      size="sm"
      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
      onClick={() => setDeleteStage('confirm')}
    >
      <Trash2 className="h-4 w-4" /> Delete item
    </Button>
  )}

  {(deleteStage === 'confirm' || deleteStage === 'deleting') && (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDeleteStage('idle')}
        disabled={deleteStage === 'deleting'}
      >
        <X className="h-4 w-4" /> Cancel
      </Button>
      <Button
        size="sm"
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={handleDelete}
        disabled={deleteStage === 'deleting'}
      >
        <Trash2 className="h-4 w-4" />
        {deleteStage === 'deleting'
          ? 'Deleting…'
          : `Delete "${item.title.length > 30 ? item.title.slice(0, 30) + '…' : item.title}"?`}
      </Button>
    </div>
  )}
</section>
```

Note: `X` is already imported from lucide-react — no new import needed.

**Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Smoke-test the full flow**

1. Navigate to an item detail page.
2. Scroll to the bottom — confirm "Delete item" button appears with red text, no red background.
3. Click "Delete item" — confirm it transitions to Cancel + red confirm button showing the item title.
4. Click Cancel — confirm it resets to the plain delete button.
5. Click "Delete item" again, then click the red confirm — confirm you are redirected to `/dashboard` and the item is gone.

**Step 6: Commit**

```bash
git add app/\(app\)/item/\[id\]/ItemDetailClient.tsx
git commit -m "feat: add inline delete confirmation to item detail page"
```

---

## Done

Both tasks complete. The feature is fully implemented with no new dependencies.
