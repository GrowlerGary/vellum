import { db } from '@/lib/db'
import { getSimilarItems, SimilarItem } from '@/lib/similar'

// Minimum number of rated entries required before surfacing discover results
const MIN_RATED_ENTRIES = 3

// Maximum number of top-rated entries to seed recommendations from
const MAX_SEED_ENTRIES = 10

// Maximum discover results to return
const MAX_RESULTS = 20

export interface DiscoverItem extends SimilarItem {
  /** How many seeding items returned this recommendation */
  frequency: number
}

/**
 * Pure function: aggregate similar-item sets and rank by frequency.
 * Items in `existing` (keyed by externalId) are filtered out.
 */
export function aggregateAndRank(
  similarSets: Array<Array<{ title: string; externalId: string }>>,
  existing: Set<string>
): DiscoverItem[] {
  const freq = new Map<string, { item: { title: string; externalId: string }; count: number }>()

  for (const set of similarSets) {
    for (const item of set) {
      if (existing.has(item.externalId)) continue
      const entry = freq.get(item.externalId)
      if (entry) {
        entry.count += 1
      } else {
        freq.set(item.externalId, { item, count: 1 })
      }
    }
  }

  return Array.from(freq.values())
    .sort((a, b) => b.count - a.count)
    .map(({ item, count }) => ({
      // Fill required SimilarItem fields — the actual full data comes from the
      // individual similar-item fetches done by getSimilarItems() which returns
      // full SimilarItem objects. For the aggregation function we only need
      // externalId + title; we spread sensible defaults here and let the caller
      // replace them with the full SimilarItem data when enriching.
      externalId: item.externalId,
      source: '',
      mediaType: '',
      title: item.title,
      year: null,
      posterUrl: null,
      overview: '',
      genres: [],
      frequency: count,
    }))
}

/**
 * Returns a ranked list of Discover recommendations for `userId` filtered to
 * the given `mediaType`.
 *
 * Algorithm:
 * 1. Find the user's top-rated entries of the requested type
 * 2. For each seed, fetch similar items (uses cache where available)
 * 3. Aggregate & rank by frequency, excluding items the user already has
 * 4. Enrich the ranked list with full SimilarItem metadata
 */
export async function getDiscoverRecommendations(
  userId: string,
  mediaType: string
): Promise<DiscoverItem[]> {
  // Step 1 — need at least MIN_RATED_ENTRIES rated entries
  const ratedEntries = await db.mediaEntry.findMany({
    where: {
      userId,
      rating: { not: null },
      mediaItem: { type: mediaType as never },
    },
    orderBy: { rating: 'desc' },
    take: MAX_SEED_ENTRIES,
    include: { mediaItem: true },
  })

  if (ratedEntries.length < MIN_RATED_ENTRIES) {
    return []
  }

  // Step 2 — fetch similar items for each seed (parallel, ignore failures)
  const similarResults = await Promise.allSettled(
    ratedEntries.map((entry) => getSimilarItems(entry.mediaItemId))
  )

  const similarSets = similarResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getSimilarItems>>> =>
      r.status === 'fulfilled'
    )
    .map((r) => r.value.items)

  // Step 3 — build the set of externalIds the user already owns
  const allEntries = await db.mediaEntry.findMany({
    where: { userId },
    include: { mediaItem: { select: { externalId: true } } },
  })
  const existingIds = new Set(allEntries.map((e) => e.mediaItem.externalId))

  // Step 4 — aggregate & rank
  const ranked = aggregateAndRank(similarSets, existingIds)

  // Step 5 — enrich with full SimilarItem metadata from the similar sets
  // Build a lookup from externalId → full SimilarItem
  const lookup = new Map<string, SimilarItem>()
  for (const set of similarSets) {
    for (const item of set) {
      if (!lookup.has(item.externalId)) {
        lookup.set(item.externalId, item)
      }
    }
  }

  return ranked
    .slice(0, MAX_RESULTS)
    .map((r) => {
      const full = lookup.get(r.externalId)
      if (full) {
        return { ...full, frequency: r.frequency }
      }
      return r
    })
}
