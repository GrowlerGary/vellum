/**
 * Shelfmark API client — server-side only.
 *
 * Handles authentication (username/password → session cookie), search, and
 * fire-and-forget download requests against a self-hosted Shelfmark instance.
 *
 * Credentials are stored in env vars (never exposed to the browser).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShelfmarkRelease {
  id: string
  source: string
  sourceId: string
  title: string
  author?: string
  format?: string        // epub, mp3, m4b, etc.
  size?: string          // human-readable file size
  seeders?: number       // if torrent source
  metadata?: Record<string, unknown>
}

export interface ShelfmarkSearchResult {
  releases: ShelfmarkRelease[]
  error?: string
}

// ── Config helpers ────────────────────────────────────────────────────────────

export function isShelfmarkEnabled(): boolean {
  return Boolean(process.env.SHELFMARK_URL?.trim())
}

function getConfig() {
  return {
    url: process.env.SHELFMARK_URL?.replace(/\/+$/, '') ?? '',
    username: process.env.SHELFMARK_USERNAME ?? '',
    password: process.env.SHELFMARK_PASSWORD ?? '',
  }
}

// ── Session management ────────────────────────────────────────────────────────

let cachedCookies: string | null = null
let cookieExpiry = 0

async function authenticate(): Promise<string | null> {
  const { url, username, password } = getConfig()

  try {
    console.log('[Shelfmark] authenticating…')
    const res = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, remember_me: true }),
      redirect: 'manual',
    })

    if (!res.ok) {
      console.error(`[Shelfmark] auth failed: ${res.status} ${res.statusText}`)
      return null
    }

    // Extract set-cookie header(s)
    const setCookies = res.headers.getSetCookie?.() ?? []
    if (setCookies.length > 0) {
      cachedCookies = setCookies.map((c) => c.split(';')[0]).join('; ')
    } else {
      // Some setups return a JSON token instead of cookies
      const body = await res.json().catch(() => null) as { token?: string } | null
      if (body?.token) {
        cachedCookies = `session=${body.token}`
      }
    }

    // Cache for 6 days (remember_me=true gives a 7-day Flask session)
    cookieExpiry = Date.now() + 6 * 24 * 60 * 60 * 1000
    console.log('[Shelfmark] authenticated successfully')
    return cachedCookies
  } catch (err) {
    console.error('[Shelfmark] auth error:', err)
    return null
  }
}

async function getSession(): Promise<string | null> {
  if (cachedCookies && Date.now() < cookieExpiry) return cachedCookies
  return authenticate()
}

/** Make an authenticated request to Shelfmark; retry auth once on 401 */
async function shelfmarkFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const { url } = getConfig()
  const cookies = await getSession()
  if (!cookies) return null

  const doFetch = (cookie: string) =>
    fetch(`${url}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...(init.headers as Record<string, string> | undefined),
      },
    })

  let res = await doFetch(cookies)

  // If 401, re-auth once then retry
  if (res.status === 401) {
    console.log('[Shelfmark] session expired, re-authenticating…')
    cachedCookies = null
    const newCookies = await authenticate()
    if (!newCookies) return null
    res = await doFetch(newCookies)
  }

  return res
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchShelfmark(
  query: string,
  contentType: 'ebook' | 'audiobook' = 'ebook',
): Promise<ShelfmarkSearchResult> {
  try {
    return searchShelfmarkUniversal(query, contentType)
  } catch (err) {
    console.error('[Shelfmark] search error:', err)
    return { releases: [], error: 'Shelfmark is unreachable' }
  }
}

/** Universal mode: metadata search → releases for each book result. */
async function searchShelfmarkUniversal(
  query: string,
  contentType: 'ebook' | 'audiobook',
): Promise<ShelfmarkSearchResult> {
  const searchParams = new URLSearchParams({
    query,
    limit: '20',
    sort: 'relevance',
    content_type: contentType,
  })
  const metaRes = await shelfmarkFetch(`/api/metadata/search?${searchParams}`, {
    method: 'GET',
  })

  if (!metaRes) return { releases: [], error: 'Shelfmark authentication failed' }

  if (!metaRes.ok) {
    const errBody = await metaRes.text().catch(() => '')
    console.error(`[Shelfmark] metadata search failed: ${metaRes.status}`, errBody)
    return { releases: [], error: `Shelfmark returned ${metaRes.status}` }
  }

  const metaData = await metaRes.json() as { books?: unknown[]; results?: unknown[] }
  const books = metaData.books ?? metaData.results ?? []

  console.log(`[Shelfmark] metadata search returned ${books.length} books`)

  if (books.length === 0) {
    return { releases: [] }
  }

  const allReleases: ShelfmarkRelease[] = []
  // For audiobooks (Prowlarr), only check the top result — Prowlarr searches by
  // title/author so multiple Hardcover IDs would produce duplicate results.
  // For ebooks (direct_download), check top 3 since each Hardcover ID may have
  // different editions with unique direct links.
  const maxBooks = contentType === 'audiobook' ? 1 : 3
  const booksToCheck = (books as Record<string, unknown>[]).slice(0, maxBooks)

  for (const book of booksToCheck) {
    const bookId = String(book.provider_id ?? book.id ?? '')
    const provider = String(book.provider ?? '')
    const bookTitle = String(book.title ?? '')
    const authors = Array.isArray(book.authors) ? book.authors.map(String) : []
    const bookAuthor = authors.length > 0 ? authors[0] : (book.author ? String(book.author) : undefined)

    if (!bookId || !provider) continue

    const relParams = new URLSearchParams({ provider, book_id: bookId, content_type: contentType })
    // For audiobooks, filter to Prowlarr source — direct_download only returns ebooks
    if (contentType === 'audiobook') relParams.set('source', 'prowlarr')
    if (bookTitle) relParams.set('title', bookTitle)
    if (bookAuthor) relParams.set('author', bookAuthor)

    console.log(`[Shelfmark] fetching releases: /api/releases?${relParams}`)
    const abortCtrl = new AbortController()
    // Prowlarr queries external indexers — give it more time than direct_download
    const timeoutMs = contentType === 'audiobook' ? 30_000 : 15_000
    const timeout = setTimeout(() => abortCtrl.abort(), timeoutMs)
    let relRes: Response | null
    try {
      relRes = await shelfmarkFetch(`/api/releases?${relParams}`, {
        method: 'GET',
        signal: abortCtrl.signal,
      })
    } catch {
      console.log(`[Shelfmark] release fetch timed out for book ${bookId}`)
      continue
    } finally {
      clearTimeout(timeout)
    }
    if (!relRes || !relRes.ok) {
      console.log(`[Shelfmark] release fetch failed: ${relRes?.status ?? 'null'}`)
      continue
    }

    const relData = await relRes.json() as { releases?: unknown[]; results?: unknown[] }
    const rawReleases = relData.releases ?? relData.results ?? []
    console.log(`[Shelfmark] book ${bookId}: ${rawReleases.length} releases found`)

    allReleases.push(...parseReleases(rawReleases as Record<string, unknown>[], bookAuthor))
  }

  logReleaseBreakdown(allReleases)
  return { releases: allReleases }
}

/** Map raw Shelfmark release objects to our ShelfmarkRelease type. */
function parseReleases(
  raw: Record<string, unknown>[],
  fallbackAuthor?: string,
): ShelfmarkRelease[] {
  return raw.map((r) => ({
    id: String(r.id ?? r.guid ?? ''),
    source: String(r.source ?? r.indexer ?? ''),
    sourceId: String(r.source_id ?? r.sourceId ?? r.id ?? ''),
    title: String(r.title ?? ''),
    author: r.author ? String(r.author) : fallbackAuthor,
    format: r.format ? String(r.format) : undefined,
    size: r.size ? String(r.size) : r.file_size ? String(r.file_size) : undefined,
    seeders: typeof r.seeders === 'number' ? r.seeders : undefined,
    metadata: typeof r === 'object' ? (r as Record<string, unknown>) : undefined,
  }))
}

function logReleaseBreakdown(releases: ShelfmarkRelease[]) {
  const sourceCounts: Record<string, number> = {}
  const formatCounts: Record<string, number> = {}
  for (const r of releases) {
    sourceCounts[r.source || 'unknown'] = (sourceCounts[r.source || 'unknown'] ?? 0) + 1
    formatCounts[r.format || 'none'] = (formatCounts[r.format || 'none'] ?? 0) + 1
  }
  console.log(`[Shelfmark] total: ${releases.length} releases`)
  console.log(`[Shelfmark] by source:`, JSON.stringify(sourceCounts))
  console.log(`[Shelfmark] by format:`, JSON.stringify(formatCounts))
}

// ── Download ──────────────────────────────────────────────────────────────────

export async function downloadFromShelfmark(
  release: Pick<ShelfmarkRelease, 'source' | 'sourceId' | 'title' | 'format' | 'metadata'>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Shelfmark expects the full release object as the POST body
    // (the frontend sends the entire release record it received from /api/releases)
    const payload = release.metadata ?? {
      source: release.source,
      source_id: release.sourceId,
      title: release.title,
      format: release.format,
    }
    const res = await shelfmarkFetch('/api/releases/download', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (!res) return { success: false, error: 'Shelfmark authentication failed' }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[Shelfmark] download failed: ${res.status}`, errBody)
      return { success: false, error: `Shelfmark returned ${res.status}` }
    }

    console.log(`[Shelfmark] download queued: ${release.title}`)
    return { success: true }
  } catch (err) {
    console.error('[Shelfmark] download error:', err)
    return { success: false, error: 'Shelfmark is unreachable' }
  }
}
