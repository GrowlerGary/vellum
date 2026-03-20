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
    // Shelfmark search is a two-step process:
    // 1. GET /api/metadata/search — find books matching the query
    // 2. GET /api/releases — find downloadable releases for a specific book
    // We combine both steps: search metadata, then fetch releases for the top result.

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
    if (books.length > 0) {
      const sample = books[0] as Record<string, unknown>
      console.log('[Shelfmark] first book keys:', Object.keys(sample).join(', '))
      console.log('[Shelfmark] first book:', JSON.stringify(sample).slice(0, 500))
    }

    if (books.length === 0) {
      return { releases: [] }
    }

    // For each book result, try to fetch releases
    const allReleases: ShelfmarkRelease[] = []
    const booksToCheck = (books as Record<string, unknown>[]).slice(0, 5)

    for (const book of booksToCheck) {
      // Shelfmark BookMetadata uses provider_id (not id) and authors (List[str], not author)
      const bookId = String(book.provider_id ?? book.id ?? '')
      const provider = String(book.provider ?? '')
      const bookTitle = String(book.title ?? '')
      const authors = Array.isArray(book.authors) ? book.authors.map(String) : []
      const bookAuthor = authors.length > 0 ? authors[0] : (book.author ? String(book.author) : undefined)

      console.log(`[Shelfmark] book: provider_id=${bookId} provider=${provider} title=${bookTitle} authors=${authors.join(', ')}`)

      if (!bookId || !provider) {
        console.log('[Shelfmark] skipping book — missing provider_id or provider')
        continue
      }

      const relParams = new URLSearchParams({ provider, book_id: bookId, content_type: contentType })
      if (bookTitle) relParams.set('title', bookTitle)
      if (bookAuthor) relParams.set('author', bookAuthor)

      console.log(`[Shelfmark] fetching releases: /api/releases?${relParams}`)
      const abortCtrl = new AbortController()
      const timeout = setTimeout(() => abortCtrl.abort(), 15_000)
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

      for (const r of rawReleases as Record<string, unknown>[]) {
        allReleases.push({
          id: String(r.id ?? r.guid ?? ''),
          source: String(r.source ?? r.indexer ?? ''),
          sourceId: String(r.source_id ?? r.sourceId ?? r.id ?? ''),
          title: String(r.title ?? bookTitle),
          author: bookAuthor,
          format: r.format ? String(r.format) : undefined,
          size: r.size ? String(r.size) : r.file_size ? String(r.file_size) : undefined,
          seeders: typeof r.seeders === 'number' ? r.seeders : undefined,
          metadata: typeof r === 'object' ? (r as Record<string, unknown>) : undefined,
        })
      }
    }

    // Filter by format when searching for audiobooks — Shelfmark doesn't always
    // respect content_type on the releases endpoint
    const AUDIO_FORMATS = new Set(['mp3', 'm4b', 'm4a', 'aac', 'flac', 'ogg', 'wma', 'wav'])
    const filtered = contentType === 'audiobook'
      ? allReleases.filter((r) => {
          if (!r.format) return true // keep unknown-format releases (might be audio)
          return AUDIO_FORMATS.has(r.format.toLowerCase())
        })
      : allReleases

    console.log(`[Shelfmark] search returned ${allReleases.length} releases (${filtered.length} after format filter)`)
    return { releases: filtered }
  } catch (err) {
    console.error('[Shelfmark] search error:', err)
    return { releases: [], error: 'Shelfmark is unreachable' }
  }
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
