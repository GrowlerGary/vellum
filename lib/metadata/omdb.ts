const OMDB_BASE = 'https://www.omdbapi.com'

/**
 * Fetch the Rotten Tomatoes audience score from OMDB for a given IMDB ID.
 * Returns a percentage (0-100) or null if unavailable.
 */
export async function fetchRottenTomatoesScore(imdbId: string): Promise<number | null> {
  const key = process.env.OMDB_API_KEY
  if (!key) return null

  try {
    const res = await fetch(`${OMDB_BASE}/?i=${encodeURIComponent(imdbId)}&apikey=${key}`)
    if (!res.ok) return null

    const data = await res.json() as OmdbResponse
    if (data.Response === 'False') return null

    const rt = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')
    if (!rt?.Value) return null

    // Value format: "85%"
    const score = parseInt(rt.Value.replace('%', ''), 10)
    return isNaN(score) ? null : score
  } catch (err) {
    console.error('[OMDB] fetchRottenTomatoesScore failed:', err)
    return null
  }
}

interface OmdbRating {
  Source: string
  Value: string
}

interface OmdbResponse {
  Response: string
  Ratings?: OmdbRating[]
}
