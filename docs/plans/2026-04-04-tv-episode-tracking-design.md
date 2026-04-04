# TV Episode Tracking Design

**Date:** 2026-04-04
**Status:** Approved

## Overview

Extend Vellum's TV show tracking from a single flat entry per show to granular per-episode watched/unwatched tracking. Users can see which episodes they've seen and which remain, with progress synced automatically from Trakt scrobbles. Show status (Want / In Progress / Completed) is derived automatically from episode completion rather than set manually.

---

## Data Model

Two new Prisma models added to `prisma/schema.prisma`.

### `SeasonCache`

Stores TMDB episode data per show. Mirrors the existing `SimilarItemCache` pattern.

```prisma
model SeasonCache {
  id          String    @id @default(cuid())
  mediaItemId String    @unique
  data        Json      // { seasons: [{ number, name, episodeCount, episodes: [{ number, title, airDate, overview }] }] }
  fetchedAt   DateTime
  mediaItem   MediaItem @relation(fields: [mediaItemId], references: [id], onDelete: Cascade)
}
```

Cache TTL: **24 hours**, except for shows with `MediaItem.metadata.status === "Ended"` which never expire.

### `EpisodeWatch`

Flat table — one row per watched episode per user.

```prisma
model EpisodeWatch {
  id          String    @id @default(cuid())
  userId      String
  mediaItemId String
  season      Int
  episode     Int
  watchedAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  mediaItem   MediaItem @relation(fields: [mediaItemId], references: [id], onDelete: Cascade)

  @@unique([userId, mediaItemId, season, episode])
}
```

### Show Status Derivation

`MediaEntry.status` for TV shows is computed, not manually set:

| Condition | Derived Status |
|---|---|
| 0 `EpisodeWatch` rows | `null` |
| Any `EpisodeWatch` rows | `IN_PROGRESS` |
| Watches = total aired episodes | `COMPLETED` |

Movies, books, audiobooks, and video games are unaffected.

---

## API Routes

### `GET /api/media-items/[id]/seasons?season=N`

Returns season/episode list. Checks `SeasonCache` first; fetches from TMDB and caches if missing or stale. Response annotates each episode with `watchedAt: string | null` for the requesting user.

### `POST /api/media-items/[id]/episodes/watch`

Body: `{ season: number, episode: number, markUpTo: boolean }`

If `markUpTo: true`, marks all episodes in that season up to and including the given episode. Upsert-safe.

### `DELETE /api/media-items/[id]/episodes/watch`

Body: `{ season: number, episode: number }` — removes a single `EpisodeWatch` row.

### Trakt Webhook (extended — not new)

`POST /api/scrobble/trakt` extended to extract `season`/`episode` from the payload and call the same upsert logic. If the show is not yet in the user's library, a `MediaEntry` is created automatically first.

### Existing entry endpoints (updated)

`GET /api/entries` and `GET /api/entries/[id]` compute TV show status on the fly by comparing `EpisodeWatch` count against `SeasonCache` aired episode count.

---

## UI/UX

### Season Accordions (`ItemDetailClient.tsx`)

New `SeasonSection` component below the metadata section, TV_SHOW items only:

- Fetches lazily per season on expand
- One collapsible accordion per season; first unwatched season expanded by default
- Season header: name, `watched / total` count, progress bar

### Episode Row

- Episode number + title + air date
- Watched toggle (checkbox) on the right
- Future episodes (air date > today): greyed out, toggle disabled

### "Mark up to here" Action

Long-press (mobile) or `...` menu (desktop) on any episode → **"Mark all up to here as seen"** → `POST .../episodes/watch` with `markUpTo: true`.

### Show Status Display

Manual status buttons become read-only for TV shows, replaced with: *"Status is tracked automatically via episodes."* Rating widget remains manually settable.

### Dashboard Card

No changes to `MediaCard` — derived status displays via existing status badge.

---

## TMDB Integration & Caching

New functions in `lib/metadata/tmdb.ts`:

- `getTmdbSeasons(tmdbId)` — season list from existing show detail endpoint (no extra API call)
- `getTmdbSeason(tmdbId, seasonNumber)` — full episode list: `air_date`, `episode_number`, `name`, `overview`

**Cache flow:**
1. User expands season N → `GET /api/media-items/[id]/seasons?season=N`
2. If season N present and fresh → return full cache
3. If missing or stale → fetch from TMDB, merge into `SeasonCache.data`, update `fetchedAt`
4. Return all seasons fetched so far

Seasons are fetched lazily — no unnecessary API calls for long-running shows. Ended shows never re-fetch.

---

## Out of Scope

- Per-episode ratings or reviews
- Push notifications for new episode air dates
- Stremio scrobble episode tracking (follow-up)
