// Audnexus audiobook metadata provider.
//
// Two-step flow:
// 1. ASIN Discovery: Audible catalog search — extracts only the ASIN from each result
// 2. Full Metadata: Audnexus API — all metadata comes from here
//
// The ASIN is used as the externalId for all AUDNEXUS-sourced MediaItems.

export interface AudnexusResult {
  id: string
  mediaType: 'AUDIOBOOK'
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: null
  overview: string
  genres: string[]
  externalId: string // ASIN
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

// Simple timestamp-based throttle: ensure at least 150ms between Audnexus requests.
let lastAudnexusRequest = 0

async function throttledAudnexusFetch(url: string): Promise<Response> {
  const now = Date.now()
  const elapsed = now - lastAudnexusRequest
  if (elapsed < 150) {
    await new Promise((resolve) => setTimeout(resolve, 150 - elapsed))
  }
  lastAudnexusRequest = Date.now()
  return fetch(url)
}

// Strip HTML tags from a string (for Audnexus summary field which contains HTML).
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
}

interface AudibleProduct {
  asin: string
  [key: string]: unknown
}

interface AudibleCatalogResponse {
  products?: AudibleProduct[]
}

interface AudnexusAuthor {
  name?: string
}

interface AudnexusNarrator {
  name?: string
}

interface AudnexusGenre {
  name?: string
}

interface AudnexusSeries {
  name?: string
}

interface AudnexusSimilarProduct {
  asin?: string
}

interface AudnexusBookResponse {
  asin?: string
  title?: string
  subtitle?: string
  authors?: AudnexusAuthor[]
  narrators?: AudnexusNarrator[]
  image?: string
  summary?: string
  genres?: AudnexusGenre[]
  seriesPrimary?: AudnexusSeries
  releaseDate?: string
  runtimeLengthMin?: number
  publisherName?: string
  language?: string
  rating?: string
  similarProducts?: AudnexusSimilarProduct[]
}

async function searchAudibleForAsins(query: string): Promise<string[]> {
  try {
    const url = `https://api.audible.com/1.0/catalog/products?num_results=10&products_sort_by=Relevance&title=${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[Audible] search returned ${res.status}`)
      return []
    }
    const json = await res.json() as AudibleCatalogResponse
    return (json.products ?? []).map((p) => p.asin).filter(Boolean)
  } catch (err) {
    console.error('[Audible] search failed:', err)
    return []
  }
}

export async function getAudnexusDetail(asin: string): Promise<AudnexusResult | null> {
  try {
    const url = `https://api.audnex.us/books/${asin.toUpperCase()}?region=us`
    const res = await throttledAudnexusFetch(url)
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[Audnexus] detail fetch returned ${res.status} for ASIN ${asin}`)
      }
      return null
    }
    const book = await res.json() as AudnexusBookResponse
    if (!book.asin) return null

    const releaseYear = book.releaseDate
      ? new Date(book.releaseDate).getFullYear()
      : null

    const series: string[] = []
    if (book.seriesPrimary?.name) series.push(book.seriesPrimary.name)

    return {
      id: book.asin,
      mediaType: 'AUDIOBOOK',
      title: book.title ?? '',
      year: isNaN(releaseYear as number) ? null : releaseYear,
      posterUrl: book.image ?? null,
      backdropUrl: null,
      overview: book.summary ? stripHtml(book.summary) : '',
      genres: (book.genres ?? []).map((g) => g.name ?? '').filter(Boolean),
      externalId: book.asin,
      source: 'AUDNEXUS',
      metadata: {
        asin: book.asin,
        authors: (book.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
        narrators: (book.narrators ?? []).map((n) => n.name ?? '').filter(Boolean),
        series,
        runtimeMinutes: book.runtimeLengthMin ?? null,
        subtitle: book.subtitle ?? null,
        publisherName: book.publisherName ?? null,
        language: book.language ?? null,
      },
    }
  } catch (err) {
    console.error(`[Audnexus] getAudnexusDetail failed for ASIN ${asin}:`, err)
    return null
  }
}

export async function searchAudnexus(query: string): Promise<AudnexusResult[]> {
  try {
    const asins = await searchAudibleForAsins(query)
    if (asins.length === 0) return []

    const settled = await Promise.allSettled(asins.map((asin) => getAudnexusDetail(asin)))
    return settled
      .filter((r): r is PromiseFulfilledResult<AudnexusResult> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value)
  } catch (err) {
    console.error('[Audnexus] search failed:', err)
    return []
  }
}

export async function getSimilarAudnexus(asin: string): Promise<AudnexusResult[]> {
  try {
    const url = `https://api.audnex.us/books/${asin.toUpperCase()}?region=us`
    const res = await throttledAudnexusFetch(url)
    if (!res.ok) return []

    const book = await res.json() as AudnexusBookResponse
    const similarAsins = (book.similarProducts ?? [])
      .map((p) => p.asin)
      .filter((a): a is string => Boolean(a))
      .slice(0, 8)

    if (similarAsins.length === 0) return []

    const settled = await Promise.allSettled(similarAsins.map((a) => getAudnexusDetail(a)))
    return settled
      .filter((r): r is PromiseFulfilledResult<AudnexusResult> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value)
  } catch {
    return []
  }
}
