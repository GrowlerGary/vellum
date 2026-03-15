const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes'

/**
 * Fetch the average rating from Google Books for a book by title + optional authors.
 * Returns a rating on a 0-5 scale or null if unavailable.
 */
export async function fetchGoogleBooksRating(
  title: string,
  authors?: string[]
): Promise<number | null> {
  try {
    let query = `intitle:${title}`
    if (authors?.length) {
      query += `+inauthor:${authors[0]}`
    }

    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(query)}&maxResults=1`
    )
    if (!res.ok) return null

    const data = await res.json() as GoogleBooksResponse
    const volume = data.items?.[0]
    if (!volume?.volumeInfo?.averageRating) return null

    return volume.volumeInfo.averageRating
  } catch (err) {
    console.error('[GoogleBooks] fetchGoogleBooksRating failed:', err)
    return null
  }
}

interface GoogleBooksResponse {
  items?: Array<{
    volumeInfo?: {
      averageRating?: number
    }
  }>
}
