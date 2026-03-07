# Vellum Media Tracking Enhancements Design

**Date:** 2026-03-07
**Status:** Approved

## Overview

Enhance Vellum's media tracking capabilities with four key features: drag-and-drop queue ordering, real-time Audiobookshelf progress tracking, similar-item recommendations, and free metadata-driven discovery. All features follow OWASP security best practices.

## Feature 1: Drag-and-Drop Queue Ordering

### What

Replace the current "Next Up" toggle with full per-media-type drag-and-drop reordering of the "Want to Consume" queue.

### Data Model

No schema changes for reordering itself. `MediaEntry.sortOrder` (existing Int field) is used as a dense rank (0, 1, 2, 3...) within each type's Want queue.

New field on `User` for configurable category display order:

```prisma
categoryOrder String[] @default(["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"])
```

### Frontend

- Library: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- Each media type's Want queue renders inside a `<SortableContext>`
- Items become `<SortableItem>` components with a drag handle (grip icon)
- Mobile: long-press to drag (built into @dnd-kit's touch sensor)
- Item at `sortOrder=0` gets a "Next Up" badge automatically

### Dashboard Layout

**Collapsible card-stack pattern** applied to all three dashboard sections (Currently Consuming, Want to Consume, Recently Consumed):

- Categories collapsed by default showing top 1-2 items
- Remaining items shown as stacked card indicator ("+N more")
- Clicking expands to show all items; expanded section spans full width
- Drag-and-drop available in expanded Want sections

**Responsive grid:**

- Mobile (< 768px): single column, categories stack vertically
- Desktop (>= 768px): 2-column grid, categories sit side by side
- When a category expands: neighbor stays collapsed in place, expanded content drops below the row spanning full width

**Category order:** Users can reorder media type categories (Movies, TV, Books, Audiobooks, Games) in Settings via drag-and-drop. Dashboard renders categories in the user's preferred order.

### API

`PATCH /api/entries/reorder`
- Body: `{ entries: [{ id: string, sortOrder: number }] }`
- Validates all entries belong to the current user
- Prisma transaction for atomic sort order updates
- New items added to "Want" get `sortOrder = MAX + 1` (end of queue)

## Feature 2: Real-Time Audiobookshelf Progress Tracking

### Architecture

Sidecar Node.js/TypeScript service (`vellum-abs-listener`) running alongside the Next.js app in docker-compose. Adapts the pattern from the existing ABStoMT Python project.

### How It Works

1. Connects to ABS via `socket.io-client`
2. Authenticates: HTTP POST `/login` -> token -> Socket.IO `auth` event
3. Listens for `user_item_progress_updated` events
4. On each event: fetches item details via ABS REST API (`GET /api/items/{libraryItemId}`)
5. Writes directly to Vellum's PostgreSQL via shared Prisma client

### Data Model

New enum value:

```prisma
enum MetadataSource {
  TMDB
  IGDB
  HARDCOVER
  AUDIOBOOKSHELF  // NEW
  MANUAL
}
```

New model:

```prisma
model ListeningProgress {
  id              String   @id @default(cuid())
  mediaEntryId    String   @unique
  progress        Float    // 0.0 to 1.0
  currentTime     Float    // seconds
  duration        Float    // seconds
  currentChapter  String?
  lastSyncedAt    DateTime @default(now())

  mediaEntry      MediaEntry @relation(fields: [mediaEntryId], references: [id], onDelete: Cascade)
}
```

New optional field on MediaItem for preserving ABS link after Fix Match:

```prisma
model MediaItem {
  // ... existing fields
  absLibraryItemId String?  // preserves ABS link even after source changes via Fix Match
}
```

### Multi-Strategy Item Matching

Priority order for matching ABS items to Vellum:

1. **ABS Library Item ID** (primary): `MediaItem WHERE source=AUDIOBOOKSHELF AND externalId=<libraryItemId>`. Always works, no ambiguity.
2. **Title+Author fuzzy match** (dedup): If user manually added a book via Hardcover, detect the duplicate and link the ABS item to the existing `MediaItem`.
3. **Create new**: If neither matches, create a new `MediaItem` with `source=AUDIOBOOKSHELF` using metadata from the ABS REST API (title, author, narrator, cover, description, ASIN if available).

### Auto-Status Detection

- progress = 0: WANT
- 0 < progress < 1.0: IN_PROGRESS (sets startedAt on first progress)
- progress = 1.0: COMPLETED (sets completedAt)

### Dashboard Display

Audiobook cards in "Currently Consuming" show:
- Progress bar (% complete)
- Current chapter name
- Near-real-time updates (sidecar writes to DB, dashboard fetches on load)

### Docker Compose

```yaml
abs-listener:
  build:
    context: ./abs-listener
    dockerfile: Dockerfile
  restart: unless-stopped
  depends_on:
    db:
      condition: service_healthy
  environment:
    DATABASE_URL: postgresql://vellum:vellum@db:5432/vellum
    ABS_URL: ""         # http://your-abs-instance:13378
    ABS_USERNAME: ""
    ABS_PASSWORD: ""
```

### Security

- ABS credentials: environment variables only, never in code or database
- Socket.IO auth: token-based (acquired via HTTP login, not stored persistently)
- Sidecar: no exposed ports, internal network only, DB access via DATABASE_URL

## Feature 2b: Plex-Style Fix Match & Metadata Editing

### What

Any MediaItem gets a "Fix Match" action to search external providers and selectively update metadata fields.

### Flow

1. User clicks "Fix Match" on an item's detail page (inline, not modal)
2. Search panel: pre-filled with item's title, source selector (Hardcover / TMDB / IGDB)
3. Results list: cover, title, year, author/director, description for each match
4. User picks the correct match
5. Merge preview: side-by-side current vs. external metadata, field-by-field toggles (Keep current / Use external)
6. "Update All" shortcut at top; dismissing the panel = cancel (no "Update None" button needed)
7. Confirmed fields get overwritten; `MediaItem.source` and `externalId` update; `absLibraryItemId` preserved if applicable

### API

- `GET /api/metadata/search?query=<title>&source=<provider>` (existing federated search)
- `GET /api/metadata/details?source=<provider>&id=<externalId>` (fetch full details)
- `PATCH /api/media-items/:id/match` (apply match with selected field overrides)

## Feature 3: Similar Items & Recommendations

### 3a: Similar Items (Item Detail Page)

Shown at the bottom of the item detail page (`/item/[id]`) as a horizontal scrollable card row.

**Cascading resolution:**

1. Has external source (TMDB/IGDB/Hardcover)? -> Fetch similar from that API
2. No external source? Try title-based search on relevant API -> use best match for similar lookup
3. AI provider configured? -> AI-generated similar items from title/genre/description
4. Nothing works? -> Inline prompt: "We couldn't find a match. [Search & Match]" which opens Fix Match inline on the same page; after matching, similar items load automatically

**Caching:**

```prisma
model SimilarItemCache {
  id          String   @id @default(cuid())
  mediaItemId String   @unique
  results     Json     // array of similar item objects
  fetchedAt   DateTime @default(now())

  mediaItem   MediaItem @relation(fields: [mediaItemId], references: [id], onDelete: Cascade)
}
```

7-day TTL. Re-fetched on demand or when source changes via Fix Match.

### 3b: Free Dashboard Recommendations ("Discover")

A "Discover" section on the dashboard, per media type.

**Algorithm (no API key required):**

1. Get user's top-rated entries (rating >= 4.0) grouped by type
2. For each top-rated item with an external source, fetch "similar" items from metadata API
3. Aggregate, deduplicate, count frequency (how many favorites each appears as "similar" to)
4. Rank by frequency x similarity score
5. Filter out items already in user's library
6. Display top 5-8 per type

**AI enhancement (optional):**

If an AI provider is configured, also run the existing AI suggestion system. Merge with metadata-based results, deduplicate. AI suggestions get a badge ("AI pick").

**UI:** Same collapsible card-stack pattern as other dashboard sections. Only shows for media types with enough rated entries (>= 3 rated items).

## Feature 4: Full Item Detail Page

### What

Replace the current item detail modal with a full page at `/item/[id]`.

### Page Sections

1. **Header**: poster/cover, title, year, genres, external source badge
2. **Status & Rating**: status selector, rating widget, review text, started/completed dates
3. **Metadata**: full description, author/director/developer, additional metadata fields
4. **Fix Match** (inline): search & match controls, merge preview
5. **Similar Items**: horizontal card row (cascading resolution as described above)
6. **Listening Progress** (audiobooks only): progress bar, chapter, duration

All interactions are inline on this page. No nested modals.

## Security (Cross-Cutting)

Applied to all features per OWASP guidelines.

### Already In Place
- Bcrypt password hashing
- HMAC-SHA256 webhook verification
- JWT session strategy (NextAuth v5)
- Server-side auth checks on protected routes
- Prisma parameterized queries (SQL injection prevention)
- React output escaping (XSS prevention)

### Added/Audited
1. **Input validation**: Zod schema validation on all API route request bodies
2. **Rate limiting**: Middleware on auth endpoints and public API routes
3. **CSRF protection**: Session token verification on custom API routes (scrobble, reorder, match)
4. **Secrets management**: All credentials as env vars only; `.env.example` without real values; `.env` in `.gitignore`
5. **API key exposure audit**: Verify no `NEXT_PUBLIC_` prefix on sensitive keys; all API calls server-side only
6. **Dependency audit**: `npm audit` in CI pipeline
7. **ABS sidecar security**: No exposed ports, token-based auth, internal network only
