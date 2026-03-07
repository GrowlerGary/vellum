# Vellum — Claude Session Memory

Last updated: 2026-03-07

## What This Project Is

Vellum is a self-hosted media tracking PWA (Next.js 15 + PostgreSQL + Prisma 5) for tracking movies, TV shows, books, audiobooks, and video games across statuses: Want, In Progress, Completed, Dropped. Deployed via Docker Compose. Repo: https://github.com/TwoBitLab/vellum

## Current Branch

`thoughtfactory/4-create-more-visual-separation-organizati`

This branch has the design doc and implementation plan committed but NO implementation work started yet.

## Recent Fixes (Already Merged to main)

- `prisma/schema.prisma`: Added `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to fix Alpine Docker Prisma engine error
- `Dockerfile`: Added `RUN apk add --no-cache openssl` to runner stage; added `--chown=nextjs:nodejs` to all Prisma COPY lines (fixes "Can't write to @prisma/engines" error)

## Approved Design

Full design doc: `docs/plans/2026-03-07-media-tracking-enhancements-design.md`

Four feature areas approved by user:

### Feature 1: Drag-and-Drop Queue Ordering
- Replace "Next Up" toggle with full per-type drag-and-drop reordering of Want queue
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- `MediaEntry.sortOrder` (already exists) used as dense rank within each type's Want queue
- New `User.categoryOrder String[]` field for user-configurable dashboard category order
- Dashboard: **collapsible card-stack pattern** — collapsed shows top 1-2 items + "+N more" stacked indicator
- Desktop: **2-column grid** of categories; expanded category spans full width below its row neighbor (neighbor stays put)
- Category order configurable in Settings via drag-and-drop list

### Feature 2: Real-Time ABS Progress Tracking
- **Sidecar service** (`abs-listener/`) — separate Node.js/TypeScript Docker container
- Connects to Audiobookshelf via Socket.IO (`user_item_progress_updated` event)
- ABS credentials (ABS_URL, ABS_USERNAME, ABS_PASSWORD) are env vars only
- **Multi-strategy item matching** (priority order):
  1. ABS `libraryItemId` → `MediaItem WHERE source=AUDIOBOOKSHELF AND externalId=<libraryItemId>`
  2. Title+Author fuzzy match (for dedup with manually-added items)
  3. Create new MediaItem from ABS REST API metadata (no ASIN required)
- New `AUDIOBOOKSHELF` enum value in `MetadataSource`
- New `ListeningProgress` model (progress %, currentTime, duration, currentChapter)
- New `MediaItem.absLibraryItemId String?` (preserves ABS link after Fix Match)
- Auto-status: 0%=WANT, 0-100%=IN_PROGRESS, 100%=COMPLETED
- Dashboard: audiobook cards show progress bar + chapter name

### Feature 2b: Plex-Style Fix Match
- Inline on item detail page (NOT a modal)
- Search on Hardcover/TMDB/IGDB → pick match → side-by-side merge preview with per-field toggles
- "Update All" shortcut; dismiss = cancel
- After match: `MediaItem.source` + `externalId` updated; `absLibraryItemId` preserved
- New API: `PATCH /api/media-items/[id]/match`
- Invalidates `SimilarItemCache` on match

### Feature 3: Similar Items + Discover Recommendations
**Item detail page (similar items):**
- Cascading resolution: external API → title search fallback → AI fallback → inline Fix Match prompt
- New `SimilarItemCache` model (7-day TTL)
- Metadata APIs: TMDB `similar`, IGDB `similar_games`, Hardcover related

**Dashboard Discover section:**
- Free, no API key required baseline: aggregate "similar" from metadata APIs for user's top-rated (≥4.0) entries
- Deduplicate, rank by frequency × similarity score, filter out library items
- Optional AI enhancement if provider configured (shows "AI pick" badge)
- Only shows for types with ≥3 rated entries

### Feature 4: Full Item Detail Page
- Item detail becomes `/item/[id]` full page (replaces modal)
- Sections: header (poster + metadata), status/rating, overview, Fix Match (inline), Similar Items, Listening Progress (audiobooks only)
- No nested modals — Fix Match opens inline on same page

### Security (Cross-Cutting)
- Zod validation on all API route bodies
- In-memory rate limiting on auth endpoints
- `.env.example` with placeholders; `.env` in `.gitignore`
- ABS credentials: env vars only, never in DB
- No `NEXT_PUBLIC_` on sensitive keys
- `npm audit` in CI

## Implementation Plan

Full plan: `docs/plans/2026-03-07-media-tracking-enhancements.md`

25 tasks across 9 phases:

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Foundation | Task 1 (Vitest), Task 2 (schema migration), Task 3 (@dnd-kit) | ❌ Not started |
| 2. Item Detail Page | Task 4 (/item/[id] page) | ❌ Not started |
| 3. Dashboard Layout | Task 5 (CollapsibleCategory), Task 6 (dashboard refactor), Task 7 (category settings) | ❌ Not started |
| 4. Drag-and-Drop | Task 8 (reorder API), Task 9 (sortable UI) | ❌ Not started |
| 5. Similar Items | Task 10 (metadata similar endpoints), Task 11 (similar API + cache), Task 12 (similar UI) | ❌ Not started |
| 6. Fix Match | Task 13 (metadata details API), Task 14 (match API), Task 15 (Fix Match UI) | ❌ Not started |
| 7. Discover | Task 16 (algorithm), Task 17 (dashboard section) | ❌ Not started |
| 8. ABS Sidecar | Task 18 (scaffold), Task 19 (Socket.IO), Task 20 (sync), Task 21 (docker-compose), Task 22 (progress display) | ❌ Not started |
| 9. Security | Task 23 (Zod audit), Task 24 (rate limiting), Task 25 (secrets audit) | ❌ Not started |

## Key Decisions & Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| DnD library | @dnd-kit | Modern, lightweight, best React DnD library |
| ABS architecture | Sidecar service | Long-lived Socket.IO connection unsuitable for Next.js server |
| ABS item matching | ABS libraryItemId as primary key | No ASIN required — solves main ABStoMT pain point |
| Similar items source | Hybrid: metadata API primary, AI fallback | Free baseline with optional AI enhancement |
| Free discovery | Metadata aggregation from top-rated | No API key required, works by default |
| AI for similar | Falls back to AI if metadata fails | Keeps costs low, metadata preferred |
| Item detail | Full page /item/[id] | Avoids modal-on-modal UX problem |
| Fix Match prompt | Inline on detail page | No nested modals |
| Category grid | 2-col desktop, single mobile | Real estate efficient without losing context |
| Expand behavior | Neighbor stays, expanded spans full width below | Stable layout, no disorientation |

## Tech Stack (Existing)

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **DB:** PostgreSQL 16 via Prisma 5
- **Auth:** NextAuth v5 (beta.30), bcryptjs, JWT sessions
- **UI:** Tailwind CSS 4 + Radix UI + Lucide React
- **AI:** Pluggable: Anthropic (claude-sonnet-4-6), OpenAI (gpt-4o), Ollama
- **Metadata:** TMDB (movies/TV), IGDB (games), Hardcover (books/audiobooks)
- **Scrobble:** Trakt, Audiobookshelf, Stremio (all webhook-based with HMAC)
- **Deployment:** Docker Compose; GHCR image publishing via GitHub Actions
- **Path alias:** `@/*` → `./*`
- **Zod version:** v4 (import from `'zod/v4'`)

## Key File Paths

```
app/(app)/dashboard/page.tsx          — main dashboard server component
app/(app)/dashboard/suggestions/      — existing AI suggestions page
app/(app)/settings/page.tsx           — user settings + webhook URLs
app/api/entries/route.ts              — GET/POST entries (reference for patterns)
app/api/entries/[id]/route.ts         — PUT/DELETE entry
app/api/scrobble/audiobookshelf/      — existing ABS webhook handler
lib/metadata/tmdb.ts                  — TMDB API calls (reference pattern)
lib/metadata/igdb.ts                  — IGDB API calls
lib/metadata/hardcover.ts             — Hardcover GraphQL calls
lib/ai/index.ts                       — AI provider abstraction
lib/utils.ts                          — cn(), MEDIA_TYPE_LABELS, etc.
lib/db.ts                             — Prisma singleton
prisma/schema.prisma                  — full data model
components/media/MediaCard.tsx        — reusable card
components/media/AddEntryDialog.tsx   — add/edit entry dialog
docs/plans/                           — design doc + implementation plan
```

## GitHub Project

ThoughtFactory project board: https://github.com/orgs/TwoBitLab/projects/1/views/1

"Target Repo" field on issues is a free-text field (type: TEXT). Type the repo name manually (e.g. `vellum`).

## How to Resume Implementation

1. `cd /Users/marco/repos/TwoBitLab/vellum`
2. `git checkout thoughtfactory/4-create-more-visual-separation-organizati`
3. Read `docs/plans/2026-03-07-media-tracking-enhancements.md` for the full task list
4. Use `superpowers:executing-plans` skill to execute tasks
5. Start with Task 1 (Vitest setup) — no code exists yet, everything is planned

## Related Repos

- **ABStoMT** (https://github.com/marcousa/ABStoMT) — User's existing Python Socket.IO ABS→MediaTracker bridge. Reference implementation for the sidecar service (translated to Node.js/TypeScript in this plan).
- **ThoughtFactory/broker** (`/Users/marco/Projects/ThoughtFactory/broker`) — Uses better-sqlite3, separate project.

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
