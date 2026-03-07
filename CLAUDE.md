# Vellum — Claude Session Memory

Last updated: 2026-03-07

## What This Project Is

Vellum is a self-hosted media tracking PWA (Next.js 15 + PostgreSQL + Prisma 5) for tracking movies, TV shows, books, audiobooks, and video games across statuses: Want, In Progress, Completed, Dropped. Deployed via Docker Compose. Repo: https://github.com/TwoBitLab/vellum

## Current Branch & PR

`thoughtfactory/4-create-more-visual-separation-organizati`

**PR #6 is open:** https://github.com/TwoBitLab/vellum/pull/6

All 25 implementation tasks are **complete and committed** on this branch. The branch is ahead of main with 25+ feature commits. Ready for review and merge.

## Implementation Status — All 25 Tasks Complete ✅

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

## Recent Fixes (Already Merged to main Before This Branch)

- `prisma/schema.prisma`: Added `binaryTargets = [\"native\", \"linux-musl-openssl-3.0.x\"]` to fix Alpine Docker Prisma engine error
- `Dockerfile`: Added `RUN apk add --no-cache openssl` to runner stage; added `--chown=nextjs:nodejs` to all Prisma COPY lines (fixes "Can't write to @prisma/engines" error)

## Features Implemented in This Branch

### Feature 1: Drag-and-Drop Queue Ordering
- Replaced "Next Up" toggle with full per-type drag-and-drop reordering of Want queue
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- `MediaEntry.sortOrder` used as dense rank within each type's Want queue
- `User.categoryOrder String[]` field for user-configurable dashboard category order
- Dashboard: **collapsible card-stack pattern** — collapsed shows top 1-2 items + "+N more" stacked indicator
- Desktop: **2-column grid** of categories; expanded category spans full width below its row neighbor
- Category order configurable in Settings via drag-and-drop list

### Feature 2: Real-Time ABS Progress Tracking
- **Sidecar service** (`abs-listener/`) — separate Node.js/TypeScript Docker container
- Connects to Audiobookshelf via Socket.IO (`user_item_progress_updated` event)
- ABS credentials (ABS_URL, ABS_USERNAME, ABS_PASSWORD) are env vars only
- **Multi-strategy item matching** (priority order):
  1. ABS `libraryItemId` → `MediaItem WHERE source=AUDIOBOOKSHELF AND externalId=<libraryItemId>`
  2. Title+Author fuzzy match (case-insensitive) — backfills `absLibraryItemId` on match
  3. Auto-create new `AUDIOBOOKSHELF` MediaItem from ABS REST API metadata
- Auto-status: 0%=WANT, 0-100%=IN_PROGRESS, 100%=COMPLETED (no status downgrade)
- Dashboard: audiobook cards show progress bar + current chapter name

### Feature 2b: Plex-Style Fix Match
- Inline on item detail page (NOT a modal)
- Search on Hardcover/TMDB/IGDB → pick match → side-by-side merge preview with per-field toggles
- "Update All" shortcut; dismiss = cancel
- After match: `MediaItem.source` + `externalId` updated; `absLibraryItemId` preserved
- `PATCH /api/media-items/[id]/match`
- Invalidates `SimilarItemCache` on match

### Feature 3: Similar Items + Discover Recommendations
**Item detail page (similar items):**
- Cascading resolution: external API → title search fallback → AI fallback → inline Fix Match prompt
- `SimilarItemCache` model (7-day TTL)
- Metadata APIs: TMDB `similar`, IGDB `similar_games`, Hardcover related

**Dashboard Discover section:**
- Free, no API key required baseline: aggregate "similar" from metadata APIs for user's top-rated (≥4.0) entries
- Requires ≥3 rated entries per type to show
- Deduplicate, rank by frequency × similarity score, filter out library items
- Optional AI enhancement if provider configured (shows "AI pick" badge)
- Frequency badge shown on cards (sparkle + "3×")

### Feature 4: Full Item Detail Page
- Item detail is `/item/[id]` full page (replaces modal)
- Sections: header (poster + metadata), status/rating, overview, Fix Match (inline), Similar Items, Listening Progress (audiobooks only)
- No nested modals

### Security (Cross-Cutting)
- Zod validation on all API route bodies (scrobble webhooks, entries, match, reorder)
- In-memory rate limiting on search (30/min) and metadata/details (60/min) endpoints
- `.env.example` with ABS sidecar vars added
- ABS credentials: env vars only, never in DB
- No `NEXT_PUBLIC_` on sensitive keys ✅
- HMAC `timingSafeEqual` wrapped in try-catch (handles length-mismatch throw)

## Key Decisions & Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| DnD library | @dnd-kit | Modern, lightweight, best React DnD library |
| ABS architecture | Sidecar service | Long-lived Socket.IO connection unsuitable for Next.js server |
| ABS item matching | Multi-strategy (ID → fuzzy → create) | No ASIN required — solves main ABStoMT pain point |
| Similar items source | Hybrid: metadata API primary, AI fallback | Free baseline with optional AI enhancement |
| Free discovery | Metadata aggregation from top-rated | No API key required, works by default |
| AI for similar | Falls back to AI if metadata fails | Keeps costs low, metadata preferred |
| Item detail | Full page /item/[id] | Avoids modal-on-modal UX problem |
| Fix Match prompt | Inline on detail page | No nested modals |
| Category grid | 2-col desktop, single mobile | Real estate efficient without losing context |
| Expand behavior | Neighbor stays, expanded spans full width below | Stable layout, no disorientation |
| ABS Dockerfile context | Root `.` context | Allows `COPY prisma/` from repo root |
| tsconfig exclude | `abs-listener/` excluded from root | `socket.io-client` not in root node_modules |
| ABS graceful disable | `isEnabled()` guard + `process.exit(0)` | Prevents crash-loop in Docker Compose when ABS_URL empty |

## Tech Stack (Existing)

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

## Key File Paths

```
app/(app)/dashboard/page.tsx                  — main dashboard server component
app/(app)/dashboard/DashboardClient.tsx        — client dashboard with DnD + collapsible categories
app/(app)/item/[id]/page.tsx                  — full item detail page (replaced modal)
app/(app)/settings/page.tsx                   — user settings + category order + webhook URLs
app/(app)/dashboard/suggestions/page.tsx       — existing AI suggestions page

app/api/entries/route.ts                      — GET/POST entries (reference for patterns)
app/api/entries/[id]/route.ts                 — PUT/DELETE entry
app/api/entries/reorder/route.ts              — PATCH reorder Want queue (Zod-validated)
app/api/entries/reorder/validation.ts         — Zod schema for reorder
app/api/media-items/[id]/similar/route.ts     — GET similar items (cached, cascading)
app/api/media-items/[id]/match/route.ts       — PATCH Fix Match (updates source/externalId)
app/api/discover/route.ts                     — GET discover recommendations
app/api/metadata/details/route.ts             — GET metadata detail for Fix Match (rate-limited)
app/api/search/route.ts                       — GET search (rate-limited, 30/min)
app/api/suggestions/route.ts                  — GET AI suggestions (type-validated)
app/api/users/category-order/route.ts         — PUT category order
app/api/scrobble/audiobookshelf/route.ts      — ABS webhook (Zod-validated)
app/api/scrobble/trakt/route.ts               — Trakt webhook (Zod + HMAC try-catch fixed)
app/api/scrobble/stremio/route.ts             — Stremio webhook (Zod-validated)

lib/discover.ts                               — aggregateAndRank() + getDiscoverRecommendations()
lib/similar.ts                                — fetchSimilarItems() with cascading resolution
lib/rate-limit.ts                             — token-bucket in-memory rate limiter
lib/metadata/tmdb.ts                          — TMDB API calls (reference pattern)
lib/metadata/igdb.ts                          — IGDB API calls
lib/metadata/hardcover.ts                     — Hardcover GraphQL calls
lib/ai/index.ts                               — AI provider abstraction
lib/utils.ts                                  — cn(), MEDIA_TYPE_LABELS, etc.
lib/db.ts                                     — Prisma singleton (export name: `db`)
lib/__tests__/discover.test.ts                — 5 tests for aggregateAndRank
lib/__tests__/utils.test.ts                   — utils smoke tests

components/media/MediaCard.tsx                — reusable card (now has listeningProgress prop)
components/media/CollapsibleCategory.tsx      — collapsible card-stack with DnD
components/media/SortableMediaCard.tsx        — DnD-enabled card wrapper
components/media/StackedCards.tsx             — collapsed stack indicator
components/media/DiscoverSection.tsx          — discover recommendations dashboard section
components/media/SimilarItemsSection.tsx      — similar items on item detail page
components/media/FixMatchSection.tsx          — inline Fix Match on item detail page
components/media/AddEntryDialog.tsx           — add/edit entry dialog

abs-listener/src/index.ts                     — sidecar entry point (isEnabled guard)
abs-listener/src/config.ts                    — config validation + isEnabled()
abs-listener/src/abs-client.ts               — ABSClient: login → token → Socket.IO
abs-listener/src/sync.ts                     — syncProgress() with 3-strategy matching
abs-listener/Dockerfile                       — build from repo root context
abs-listener/package.json                     — socket.io-client, @prisma/client, tsx

prisma/schema.prisma                          — full data model
docs/plans/2026-03-07-media-tracking-enhancements-design.md  — design doc
docs/plans/2026-03-07-media-tracking-enhancements.md         — implementation plan
```

## Schema Changes (Added in This Branch)

New Prisma models and fields:
- `User.categoryOrder String[]` — user's preferred dashboard category display order
- `MediaItem.absLibraryItemId String?` — ABS link preserved through Fix Match
- `MetadataSource.AUDIOBOOKSHELF` — new enum value
- `ListeningProgress` model — `progress`, `currentTime`, `duration`, `currentChapter`, `mediaItemId`
- `SimilarItemCache` model — `mediaItemId`, `similarItems Json`, `expiresAt` (7-day TTL)

## GitHub Project

ThoughtFactory project board: https://github.com/orgs/TwoBitLab/projects/1/views/1

"Target Repo" field on issues is a free-text field (type: TEXT). Type the repo name manually (e.g. `vellum`).

## Security Audit Notes (2026-03-07)

### npm audit findings
- 7 vulnerabilities (1 moderate, 6 high) all in `@ducanh2912/next-pwa` build toolchain
  - Root cause: `serialize-javascript` via `workbox-build` → `terser-webpack-plugin`
  - **Build-time only** — no runtime exposure
  - CVE: RCE via `RegExp.flags` and `Date.prototype.toISOString()` (affects build pipeline, not deployed app)
  - Fix requires `npm audit fix --force` which may break PWA service worker generation
  - **Action**: Track for upstream fix in `@ducanh2912/next-pwa` > 10.2.9

### NEXT_PUBLIC_ audit
- No sensitive API keys or secrets use the NEXT_PUBLIC_ prefix ✅

### .gitignore
- `.env`, `.env.local`, `.env.*.local` all excluded ✅
- `.env.example` committed with placeholder values only ✅

### Zod validation coverage
- All scrobble webhooks (ABS, Trakt, Stremio): Zod safeParse + HMAC ✅
- Entries reorder API: Zod schema in `validation.ts` ✅
- Suggestions route: enum validation on `type` query param ✅
- Search + metadata/details: rate limited (30/min, 60/min) ✅

## How to Resume Work (If Branch Not Yet Merged)

1. `cd /Users/marco/repos/TwoBitLab/vellum`
2. `git checkout thoughtfactory/4-create-more-visual-separation-organizati`
3. Review PR #6: https://github.com/TwoBitLab/vellum/pull/6
4. Run tests: `npm test` (21 tests should pass)
5. TypeScript check: `node_modules/.bin/tsc --noEmit`

## Related Repos

- **ABStoMT** (https://github.com/marcousa/ABStoMT) — User's existing Python Socket.IO ABS→MediaTracker bridge. Reference implementation for the sidecar service (translated to Node.js/TypeScript in this branch).
- **ThoughtFactory/broker** (`/Users/marco/Projects/ThoughtFactory/broker`) — Uses better-sqlite3, separate project.
