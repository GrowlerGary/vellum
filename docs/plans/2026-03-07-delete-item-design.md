# Delete Item from Detail Page — Design

**Date:** 2026-03-07
**Status:** Approved

## Problem

Users have no way to remove an item from their library via the item detail page. The underlying `DELETE /api/entries/[id]` endpoint only removes the MediaEntry, leaving the MediaItem record as an orphan.

## Decision

Delete the full MediaItem (and all dependent records) so the database stays clean. Re-adding the item later is always possible via search — external provider data (Hardcover, TMDB, IGDB) is not lost.

## UI — Inline Confirmation (Option B)

Added at the bottom of `ItemDetailClient.tsx`, below the Fix Match section.

**Default state:** small destructive outline button labelled "Delete item".

**Confirm state** (after first click): the button is replaced inline by two buttons:
```
[ ✕ Cancel ]  [ 🗑 Delete "The Hard Line"? ]
```
- Cancel: resets to default state, no network call
- Confirm (red): labelled with the item title (truncated), triggers deletion
- While deleting: both buttons disabled, confirm shows "Deleting…"

**After success:** navigate to `/dashboard` via `router.push`.

## Backend — `DELETE /api/media-items/[id]`

New route. Authorization: session required; requesting user must own a `MediaEntry` for the given `mediaItemId`.

Deletion order (respects FK constraints, no cascade from MediaItem except SimilarItemCache):
1. `AiSuggestion.deleteMany({ where: { mediaItemId } })`
2. `ListItem.deleteMany({ where: { mediaItemId } })`
3. `MediaEntry.deleteMany({ where: { mediaItemId } })` — cascades to `ListeningProgress`
4. `MediaItem.delete({ where: { id } })` — cascades to `SimilarItemCache`

Returns `204 No Content` on success.

## What Is Not Changed

- `DELETE /api/entries/[id]` is untouched (used by dashboard/other list management flows).
- No new UI dependencies — no dialog component needed.
