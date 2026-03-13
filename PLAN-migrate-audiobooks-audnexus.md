# Plan: Migrate Audiobook Metadata from Hardcover to Audnexus

## Context

The Hardcover integration for audiobooks has been persistently unreliable — the `audio_books` GQL field doesn't exist, `audio_seconds` is often 0 even for real audiobooks, editions-based detection is fragile, and batch GQL fetches frequently return empty data due to silent GraphQL errors. This migration replaces Hardcover entirely as the audiobook metadata provider with **Audnexus** (public API, no key needed) using **Audible catalog search** for ASIN discovery.

Books (non-audio) continue using Hardcover. Existing audiobook MediaItems with `source=HARDCOVER` are left as-is — users can Fix Match to re-link to Audnexus if desired.

## Architecture: Two-Step Flow

1. **ASIN Discovery (Audible):** `GET https://api.audible.com/1.0/catalog/products?title={t}&num_results=10&products_sort_by=Relevance` — returns product listings; we **only extract the ASIN** from each result (no other metadata used from Audible)
2. **Full Metadata (Audnexus):** `GET https://api.audnex.us/books/{ASIN}?region=us` — **all metadata comes from here**: title, authors, narrators, summary, image, genres, series, runtimeLengthMin, releaseDate, similar products (ASINs)

The ASIN becomes the `externalId` for all AUDNEXUS-sourced items. Audible is purely the ASIN lookup layer; Audnexus is the metadata source of truth.

---

## Step 1: Add `AUDNEXUS` to MetadataSource enum

**File:** `prisma/schema.prisma`

- Add `AUDNEXUS` to the `MetadataSource` enum
- Run `npx prisma migrate dev --name add-audnexus-source`

---

## Step 2: Create `lib/metadata/audnexus.ts`

**New file** following the existing provider pattern (3 exported functions + result interface).

### Interface

```typescript
export interface AudnexusResult {
  id: number
  mediaType: 'AUDIOBOOK'
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: null
  overview: string
  genres: string[]
  externalId: string          // ASIN
  source: 'AUDNEXUS'
  metadata: {
    asin: string
    authors: string[]
    narrators: string[]
    series: string[]
    runtimeMinutes: number | null
    subtitle: string | null
    publisherName: string | null
    language: string | null
  }
}
```

### `searchAudibleForAsins(query: string): Promise<string[]>` (internal helper)

1. Call Audible catalog search: `GET https://api.audible.com/1.0/catalog/products?num_results=10&products_sort_by=Relevance&title=${encodeURIComponent(query)}`
   - Response includes `products[]` array — we only extract the `asin` field from each product
2. Return array of ASINs (up to 10)
3. On error: `console.error("[Audible] search failed:", err)`, return `[]`

### `searchAudnexus(query: string): Promise<AudnexusResult[]>`

1. Call `searchAudibleForAsins(query)` to get ASINs matching the search query
2. For each ASIN, call `getAudnexusDetail(asin)` in parallel via `Promise.allSettled` to get full metadata from Audnexus
3. Filter out nulls (ASINs that Audnexus doesn't have data for)
4. Return mapped results
5. On error: `console.error("[Audnexus] search failed:", err)`, return `[]`

### `getAudnexusDetail(asin: string): Promise<AudnexusResult | null>`

1. Call Audnexus: `GET https://api.audnex.us/books/${asin.toUpperCase()}?region=us`
   - Response includes: `asin`, `title`, `subtitle`, `authors[].name`, `narrators[].name`, `image`, `summary` (HTML), `genres[].name`, `seriesPrimary.name`, `releaseDate`, `runtimeLengthMin`, `publisherName`, `language`, `rating`
2. Map to `AudnexusResult` — strip HTML from `summary` for overview
3. On error or 404: return `null`

### `getSimilarAudnexus(asin: string): Promise<AudnexusResult[]>`

1. Call Audnexus: `GET https://api.audnex.us/books/${asin.toUpperCase()}?region=us`
2. Extract `similarProducts` array (list of ASINs) from response
3. For each similar ASIN (cap at 8), call `getAudnexusDetail(similarAsin)` — run in parallel with `Promise.allSettled`
4. Return fulfilled results, filter out nulls
5. On error: return `[]`

### Rate Limiting

Add a simple fetch wrapper with 150ms minimum between requests to Audnexus (matching Audiobookshelf's approach). Use a simple timestamp-based throttle, no external dependency needed.

---

## Step 3: Update search route

**File:** `app/api/search/route.ts`

- Add import: `import { searchAudnexus } from '@/lib/metadata/audnexus'`
- Change `type === 'AUDIOBOOK'` case: replace `searchHardcover(query, true).filter(...)` with `searchAudnexus(query)`
- Change `!type` (All types) case: run `searchHardcover(query, false)` (books only, no preferAudio) **and** `searchAudnexus(query)` in parallel, combine results
- Remove `preferAudio` usage from all Hardcover calls

---

## Step 4: Update metadata details route

**File:** `app/api/metadata/details/route.ts`

- Add import: `import { getAudnexusDetail } from '@/lib/metadata/audnexus'`
- Add case to switch:
  ```typescript
  case 'AUDNEXUS':
    detail = await getAudnexusDetail(id)
    break
  ```

---

## Step 5: Update similar items

**File:** `lib/similar.ts`

- Add import: `import { getSimilarAudnexus } from '@/lib/metadata/audnexus'`
- Add `AUDNEXUS` case to `fetchFromSource()`:
  ```typescript
  case 'AUDNEXUS': {
    const results = await getSimilarAudnexus(externalId)
    return results.map((r) => ({
      externalId: r.externalId,
      source: 'AUDNEXUS',
      mediaType: 'AUDIOBOOK',
      title: r.title,
      year: r.year,
      posterUrl: r.posterUrl,
      overview: r.overview,
      genres: r.genres,
    }))
  }
  ```
- Update `fetchByTitleFallback()`: for `AUDIOBOOK` type, use `searchAudnexus(title)` instead of `getSimilarHardcover(title)`. Keep `BOOK` using Hardcover.

---

## Step 6: Update Fix Match section

**File:** `components/media/FixMatchSection.tsx`

- Add `AUDNEXUS` to `ALL_SOURCES` array: `{ value: 'AUDNEXUS', label: 'Audnexus (Audiobooks)' }`
- Update `defaultSource()`: `AUDIOBOOK` → return `'AUDNEXUS'` instead of `'HARDCOVER'`
- Remove the special-case search type conversion (`searchType = source === 'HARDCOVER' && type === 'AUDIOBOOK' ? 'BOOK' : type`) — no longer needed since AUDNEXUS searches are always audiobooks

---

## Step 7: Clean up Hardcover audiobook code

**File:** `lib/metadata/hardcover.ts`

- Remove `preferAudio` parameter from `searchHardcover()` — always returns `BOOK` type
- Remove `preferAudio` parameter from `mapBook()` — always sets `mediaType: 'BOOK'`
- Remove `hasAudio` field from `HardcoverResult` interface and `mapBook()` return
- Remove `editions` fetching from all GQL queries (no longer needed for audio detection)
- Remove `audio_seconds` from GQL queries (no longer needed)
- Remove the batch-fetch block in `searchHardcover()` (lines 135-180) that was only for audio detection
- Remove `audio_books { id }` from `getSimilarHardcover` and `getHardcoverDetail` GQL queries (this was already a known bug — the field doesn't exist)
- Remove `preferAudio` parameter from `getHardcoverDetail()`
- Clean up logging that references audiobook detection

**File:** `app/api/metadata/details/route.ts`
- Remove `mediaType === 'AUDIOBOOK'` param from `getHardcoverDetail()` call

**File:** `app/api/search/route.ts`
- Remove `preferAudio` from Hardcover calls (already handled in Step 3)

---

## Files Changed Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `AUDNEXUS` to MetadataSource enum |
| `lib/metadata/audnexus.ts` | **NEW** — Audible search + Audnexus detail provider |
| `app/api/search/route.ts` | Route AUDIOBOOK to Audnexus; "All" combines both |
| `app/api/metadata/details/route.ts` | Add AUDNEXUS case; remove preferAudio from HARDCOVER |
| `lib/similar.ts` | Add AUDNEXUS case; update AUDIOBOOK fallback |
| `components/media/FixMatchSection.tsx` | Add AUDNEXUS source; default AUDIOBOOK to it |
| `lib/metadata/hardcover.ts` | Remove all audiobook/audio detection code |

## Files NOT Changed (no changes needed)

- `components/media/MediaSearch.tsx` — generic, uses search route
- `components/media/SimilarItemsSection.tsx` — generic, filters by parentMediaType
- `components/media/DiscoverSection.tsx` — generic, uses similar items
- `lib/discover.ts` — generic, aggregates from similar items cache
- `app/api/entries/open/route.ts` — generic, upserts by source/externalId/type
- `app/(app)/media/[id]/MediaPreviewClient.tsx` — generic
- `app/(app)/item/[id]/ItemDetailClient.tsx` — generic
- `abs-listener/` — ABS sidecar is separate (uses AUDIOBOOKSHELF source)

---

## Verification

1. **Prisma migration:** `npx prisma migrate dev` succeeds
2. **TypeScript:** `npx tsc --noEmit` passes
3. **Tests:** `npm test` — 21 existing tests still pass
4. **Manual search test:** Search for "Project Hail Mary" with type=AUDIOBOOK → should return Audnexus results with ASIN as externalId, cover image, narrators in metadata
5. **All-types search:** Search without type filter → audiobooks appear from Audnexus, books from Hardcover, no duplicates
6. **Detail page:** Click an Audnexus audiobook result → preview page shows full metadata (authors, narrators, genres, description, cover)
7. **Similar items:** Audiobook detail page shows similar audiobooks fetched via Audnexus similarProducts
8. **Fix Match:** On an audiobook, Fix Match defaults to Audnexus source and can search/re-link
9. **Book search unchanged:** Search for a book → still uses Hardcover, no audio detection overhead
