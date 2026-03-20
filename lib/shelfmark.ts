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
    const res = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
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

    // Cache for 55 minutes (typical Flask session is 60 min)
    cookieExpiry = Date.now() + 55 * 60 * 1000
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

export async function searchShelfmark(query: string): Promise<ShelfmarkSearchResult> {
  try {
    const res = await shelfmarkFetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })

    if (!res) return { releases: [], error: 'Shelfmark authentication failed' }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[Shelfmark] search failed: ${res.status}`, errBody)
      return { releases: [], error: `Shelfmark returned ${res.status}` }
    }

    const data = await res.json() as { releases?: unknown[]; results?: unknown[] }
    const rawReleases = data.releases ?? data.results ?? []

    const releases: ShelfmarkRelease[] = (rawReleases as Record<string, unknown>[]).map((r) => ({
      id: String(r.id ?? ''),
      source: String(r.source ?? ''),
      sourceId: String(r.source_id ?? r.sourceId ?? ''),
      title: String(r.title ?? ''),
      author: r.author ? String(r.author) : undefined,
      format: r.format ? String(r.format) : undefined,
      size: r.size ? String(r.size) : r.file_size ? String(r.file_size) : undefined,
      seeders: typeof r.seeders === 'number' ? r.seeders : undefined,
      metadata: typeof r === 'object' ? (r as Record<string, unknown>) : undefined,
    }))

    console.log(`[Shelfmark] search returned ${releases.length} releases`)
    return { releases }
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
    const res = await shelfmarkFetch('/api/releases/download', {
      method: 'POST',
      body: JSON.stringify({
        source: release.source,
        source_id: release.sourceId,
        title: release.title,
        format: release.format,
        metadata: release.metadata,
      }),
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
