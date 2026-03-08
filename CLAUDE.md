# Vellum — Claude Session Memory

Last updated: 2026-03-07 (session 2)

## What This Project Is

Vellum is a self-hosted media tracking PWA (Next.js 15 + PostgreSQL + Prisma 5) for tracking movies, TV shows, books, audiobooks, and video games across statuses: Want, In Progress, Completed, Dropped. Deployed via Docker Compose. Repo: https://github.com/TwoBitLab/vellum

## Current Branch & Status

All work is on **`main`**. PR #6 was merged 2026-03-07. All subsequent fixes went directly to main.

Latest commit: `825a09e` — `debug: log raw ABS progress event shape`

**⚠️ PENDING**: `abs-listener/src/sync.ts` has a temporary `console.log` of the raw ABS progress event. Waiting for user to share the log output to fix the event field mapping. Remove the log line once the event shape is confirmed and the fix is applied.

## All 25 Original Tasks — Complete ✅

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Foundation | Task 1 (Vitest), Task 2 (schema migration), Task 3 (@dnd-kit) | ✅ Done |
| 2. Item Detail Page | Task 4 (/item/[id] page) | ✅ Done |
| 3. Dashboard Layout | Task 5 (CollapsibleCategory), Task 6 (dashboard refactor), Task 7 (category settings) | ✅ Done |
| 4. Drag-and-Drop | Task 8 (reorder API), Task 9 (sortable UI) | ✅ Done |
| 5. Similar Items | Task 10 (metadata similar endpoints), Task 11 (similar API + cache), Task 12 (similar UI) | ✅ Done |
| 6. Fix Match | Task 13 (metadata details API), Task 14 (match API), Task 15 (Fix Match UI) | ✅ Done |
| 7. Discover | Task 16 (algorithm), Task 17 (dashboard section) | ✅ Done |
| 8. ABS Sidecar | Task 18 (scaffold), Task 19 (Socket.IO), Task 20 (sync), Task 21 (docker-compose), Task 22 (progress display) | ✅ Done |
| 9. Security | Task 23 (Zod audit), Task 24 (rate limiting), Task 25 (secrets audit) | ✅ Done |

## Post-Merge Fixes (All on main)

### CI / Docker
- `docker-publish.yml`: Added parallel `build-and-push-abs-listener` job → pushes `ghcr.io/twobitlab/vellum-abs-listener:latest`
- `docker-compose.yml`: Replaced `build: context/dockerfile` with `image:` for both `app` and `abs-listener`
- `abs-listener/package-lock.json`: Added (was missing — caused `npm ci` to fail in Docker build)
- `.gitignore`: Added `/abs-listener/node_modules`
- `abs-listener/Dockerfile`: Added `RUN apk add --no-cache openssl` (same fix as main app — Alpine needs it for Prisma)

### ABS Authentication (multiple iterations)
- **Removed** `ABS_USERNAME` + `ABS_PASSWORD`
- **Tried** `ABS_API_KEY` (Settings → API Keys) → rejected by socket auth
- **Renamed** to `ABS_TOKEN` — accepts either API key or personal user token
- **Fixed**: `GET /api/me` called first to exchange API key → JWT; JWT used for socket auth
  - ABS socket `auth` event only validates user JWTs, not new API keys
  - `/api/me` returns flat User object: `{ id, token, username, ... }` (NOT `{ user: { ... } }`)
  - Bug fixed: was accessing `me.user?.token` (undefined) instead of `me.token`

### ABS Event Shape (in progress)
- First attempt: assumed `event.mediaProgress.episodeId` (nested) → crash
- Fixed to: flat destructure from `event` directly
- Current bug: `progress`, `currentTime`, `duration` still undefined → Prisma validation error
- **Diagnostic logging added** (`console.log('[ABS] Raw progress event:', JSON.stringify(rawEvent, null, 2))`)
- Waiting on user to share log output to confirm actual wire format

### UI Fixes
- `components/media/StackedCards.tsx`: Wrapped each card slot in `w-[150px] shrink-0` — cards were expanding to fill the full category container width, making Movie/TV Show/etc. categories different heights
- `app/(app)/dashboard/DashboardClient.tsx`: Lifted `isExpanded` out of `SortableWantCategory` into parent `DashboardSection` — the sortable category never got `md:col-span-2` on expand, so its inner DnD grid (`lg:grid-cols-6`) was crammed into a half-width column making cards smaller when "expanded"

## ABS Sidecar — Known Gotchas

### Authentication
- `ABS_TOKEN` env var: accepts an API key from Settings → API Keys OR the personal legacy token
- On startup: `GET /api/me` with `Authorization: Bearer <ABS_TOKEN>` → extract `me.token` (flat, top-level field) → use that JWT for socket `emit('auth', jwt)`
- New API keys (Settings → API Keys) work for HTTP REST but NOT for socket `emit('auth')` — socket auth only checks user JWT tokens
- `GET /api/me` response is **flat** (`{ id, token, username, ... }`), NOT `{ user: { ... } }`

### Docker / Build
- Build context must be repo root (`.`) so Dockerfile can `COPY prisma/` from root
- `abs-listener/` excluded from root `tsconfig.json` (`socket.io-client` not in root node_modules)
- `abs-listener/Dockerfile` must have `RUN apk add --no-cache openssl` (Alpine + Prisma)
- `abs-listener/package-lock.json` must be committed (required by `npm ci`)
- Graceful no-op when `ABS_URL` is empty: `isEnabled()` guard → `process.exit(0)` → no crash-loop

### Event Shape (PENDING CONFIRMATION)
- Event name: `user_item_progress_updated`
- **Current interface assumes flat** but `progress`/`currentTime`/`duration` are coming back undefined
- Debug log in `sync.ts` line 102 will reveal actual structure on next deploy + progress event
- After confirming: update `ABSProgressEvent` interface + remove the debug log

## Features Implemented

### Feature 1: Drag-and-Drop Queue Ordering
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- `MediaEntry.sortOrder` used as dense rank within each type's Want queue
- `User.categoryOrder String[]` for user-configurable dashboard category order
- Dashboard: collapsible card-stack (collapsed = top 2 + "+N more"); expanded = full DnD grid spanning 2 columns
- Category order configurable in Settings

### Feature 2: Real-Time ABS Progress Tracking
- Sidecar service (`abs-listener/`) — separate Node.js/TypeScript Docker container
- Connects to ABS via Socket.IO (`user_item_progress_updated` event)
- Multi-strategy item matching: ID → title fuzzy match (backfills absLibraryItemId) → auto-create
- Auto-status: 0%=WANT, >0%=IN_PROGRESS, 100%/isFinished=COMPLETED (no status downgrade)
- Dashboard: audiobook cards show indigo progress bar + current chapter name

### Feature 2b: Plex-Style Fix Match
- Inline on item detail page; search → pick → side-by-side merge preview with per-field toggles
- `PATCH /api/media-items/[id]/match`; invalidates `SimilarItemCache` on match

### Feature 3: Similar Items + Discover Recommendations
- `SimilarItemCache` (7-day TTL); cascading resolution: metadata API → title fallback → AI → Fix Match prompt
- Discover: aggregates "similar" from top-rated entries; requires ≥3 rated per type; frequency badge

### Feature 4: Full Item Detail Page
- `/item/[id]` full page (replaced modal); sections: header, status/rating, Fix Match, Similar Items, Listening Progress

### Security
- Zod validation on all API route bodies; rate limiting (search 30/min, metadata 60/min)
- HMAC `timingSafeEqual` in try-catch; no NEXT_PUBLIC_ on sensitive keys

## Key Decisions & Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| DnD library | @dnd-kit | Modern, lightweight, best React DnD library |
| ABS architecture | Sidecar service | Long-lived Socket.IO connection unsuitable for Next.js server |
| ABS auth | `ABS_TOKEN` + `/api/me` exchange | New API keys work for HTTP but not socket auth |
| ABS item matching | Multi-strategy (ID → fuzzy → create) | No ASIN required |
| Similar items | Hybrid: metadata API primary, AI fallback | Free baseline |
| Item detail | Full page /item/[id] | Avoids modal-on-modal UX |
| Category grid | 2-col desktop, single mobile | Real estate efficient |
| Expand behavior | `md:col-span-2` on expanded category | Stable layout, no disorientation |
| ABS Dockerfile context | Root `.` context | Allows `COPY prisma/` from repo root |
| tsconfig exclude | `abs-listener/` excluded | `socket.io-client` not in root node_modules |
| ABS graceful disable | `isEnabled()` + `process.exit(0)` | Prevents crash-loop when ABS_URL empty |
| Card width | `w-[150px] shrink-0` in StackedCards | Consistent size regardless of container width |
| Sortable expand state | Lifted to DashboardSection | Needed for `md:col-span-2` to work |

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **DB:** PostgreSQL 16 via Prisma 5
- **Auth:** NextAuth v5 (beta.30), bcryptjs, JWT sessions
- **UI:** Tailwind CSS 4 + Radix UI + Lucide React
- **AI:** Pluggable: Anthropic (claude-sonnet-4-6), OpenAI (gpt-4o), Ollama
- **Metadata:** TMDB (movies/TV), IGDB (games), Hardcover (books/audiobooks)
- **Scrobble:** Trakt, Audiobookshelf, Stremio (all webhook-based with HMAC)
- **DnD:** @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- **Tests:** Vitest + @testing-library/react (21 tests passing)
- **Deployment:** Docker Compose; GHCR image publishing via GitHub Actions
- **Path alias:** `@/*` → `./*`
- **Zod version:** v4 — import as `import { z } from 'zod'` (NOT `'zod/v4'`)

## Critical Coding Patterns

- **Prisma client:** use `db` (not `prisma`) — imported from `@/lib/db`
- **Prisma JSON fields:** double-cast required: `field as unknown as T`
- **Zod import:** `import { z } from 'zod'` — NOT `'zod/v4'`
- **Zod record:** `z.record(z.string(), z.unknown())` requires 2 args in v4
- **Rate limit:** `if (!rateLimit(\`search:${session.user.id}\`, 30, 60_000))` returns 429
- **DB not prisma:** always `db.mediaItem.findMany(...)` not `prisma.mediaItem.findMany(...)`
- **ABS /api/me response:** flat — `me.token` NOT `me.user?.token`

## Key File Paths

```
app/(app)/dashboard/page.tsx                  — main dashboard server component
app/(app)/dashboard/DashboardClient.tsx        — client dashboard with DnD + collapsible categories
app/(app)/item/[id]/page.tsx                  — full item detail page
app/(app)/settings/page.tsx                   — user settings + category order + webhook URLs

app/api/entries/reorder/route.ts              — PATCH reorder Want queue (Zod-validated)
app/api/media-items/[id]/similar/route.ts     — GET similar items (cached, cascading)
app/api/media-items/[id]/match/route.ts       — PATCH Fix Match
app/api/discover/route.ts                     — GET discover recommendations
app/api/metadata/details/route.ts             — GET metadata detail (rate-limited)
app/api/search/route.ts                       — GET search (rate-limited, 30/min)
app/api/scrobble/audiobookshelf/route.ts      — ABS webhook (Zod-validated)
app/api/scrobble/trakt/route.ts               — Trakt webhook (Zod + HMAC try-catch fixed)
app/api/scrobble/stremio/route.ts             — Stremio webhook (Zod-validated)

lib/discover.ts                               — aggregateAndRank() + getDiscoverRecommendations()
lib/similar.ts                                — fetchSimilarItems() with cascading resolution
lib/rate-limit.ts                             — token-bucket in-memory rate limiter
lib/db.ts                                     — Prisma singleton (export name: `db`)

components/media/MediaCard.tsx                — reusable card (has listeningProgress prop)
components/media/CollapsibleCategory.tsx      — collapsible card-stack (non-sortable sections)
components/media/StackedCards.tsx             — collapsed stack; cards fixed at w-[150px]
components/media/DiscoverSection.tsx          — discover recommendations dashboard section
components/media/SimilarItemsSection.tsx      — similar items on item detail page
components/media/FixMatchSection.tsx          — inline Fix Match on item detail page

abs-listener/src/index.ts                     — sidecar entry point (isEnabled guard)
abs-listener/src/config.ts                    — config: DATABASE_URL, ABS_URL, ABS_TOKEN
abs-listener/src/abs-client.ts               — ABSClient: /api/me exchange → Socket.IO
abs-listener/src/sync.ts                     — syncProgress() — ⚠️ debug log on line 102
abs-listener/Dockerfile                       — build from repo root context; has openssl
abs-listener/package.json                     — socket.io-client, @prisma/client, tsx
abs-listener/package-lock.json               — required for npm ci in Docker build

.github/workflows/docker-publish.yml         — builds both vellum and vellum-abs-listener images
docker-compose.yml                            — uses ghcr.io image refs (no build: context)
prisma/schema.prisma                          — full data model
```

## Schema Changes (Added in PR #6)

- `User.categoryOrder String[]` — user's preferred dashboard category display order
- `MediaItem.absLibraryItemId String?` — ABS link preserved through Fix Match
- `MetadataSource.AUDIOBOOKSHELF` — new enum value
- `ListeningProgress` model — `progress`, `currentTime`, `duration`, `currentChapter`, `mediaEntryId`
- `SimilarItemCache` model — `mediaItemId`, `similarItems Json`, `expiresAt` (7-day TTL)

## GitHub Project

ThoughtFactory project board: https://github.com/orgs/TwoBitLab/projects/1/views/1

## Security Audit Notes

### npm audit findings
- 7 vulnerabilities in `@ducanh2912/next-pwa` build toolchain (build-time only, no runtime exposure)
- Track for upstream fix in `@ducanh2912/next-pwa` > 10.2.9

### Zod validation coverage
- All scrobble webhooks, entries reorder, suggestions type param, search/metadata rate-limited ✅

## How to Resume Work

```bash
cd /Users/marco/repos/TwoBitLab/vellum
git pull origin main
npm test          # 21 tests should pass
node_modules/.bin/tsc --noEmit
```

**Next action:** Wait for user to share `[ABS] Raw progress event:` log output, then:
1. Fix `ABSProgressEvent` interface and destructuring in `abs-listener/src/sync.ts`
2. Remove the `console.log` debug line
3. Commit and push

## Related Repos

- **ABStoMT** (https://github.com/marcousa/ABStoMT) — User's existing Python Socket.IO ABS→MediaTracker bridge. Reference for the sidecar.
- **ThoughtFactory/broker** (`/Users/marco/Projects/ThoughtFactory/broker`) — Uses better-sqlite3, separate project.
