const HARDCOVER_GRAPHQL = "https://api.hardcover.app/v1/graphql";

function getHeaders() {
  const key = process.env.HARDCOVER_API_KEY;
  if (!key) throw new Error("HARDCOVER_API_KEY not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export interface HardcoverResult {
  id: number;
  mediaType: "BOOK" | "AUDIOBOOK";
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: null;
  overview: string;
  genres: string[];
  externalId: string;
  source: "HARDCOVER";
  metadata: Record<string, unknown>;
  hasAudio: boolean;
}

interface HardcoverBook {
  id: number;
  title?: string;
  release_year?: number;
  image?: { url?: string };
  description?: string;
  book_series?: Array<{ series?: { name?: string } }>;
  contributions?: Array<{ author?: { name?: string } }>;
  // audio_seconds: total duration of the default audiobook edition (> 0 = has audio).
  // NOTE: Some books have audio_seconds = 0 at the book level even when an audiobook
  // edition exists (e.g. the edition is stored separately). Check `editions` as fallback.
  audio_seconds?: number;
  cached_tags?: { Genre?: string[] };
  // editions filtered to those with audio_seconds > 0 — reliable fallback when
  // book-level audio_seconds is 0 but an audiobook edition exists in the DB.
  editions?: Array<{ id: number; audio_seconds?: number }>;
}

interface HardcoverSearchResponse {
  data?: {
    search?: {
      results?: {
        hits?: Array<{ document?: HardcoverBook }>;
      };
    };
  };
}

interface HardcoverDetailResponse {
  data?: {
    books?: HardcoverBook[];
  };
}

function mapBook(
  book: HardcoverBook,
  preferAudio = false
): HardcoverResult {
  // Two signals for hasAudio:
  // 1. audio_seconds at book level (> 0 = book has a default audiobook edition)
  // 2. editions with audio_seconds > 0 — fallback for books like "Summer Frost"
  //    where book-level audio_seconds is 0 but a separate audiobook edition exists.
  // NOTE: audio_books is NOT a valid field in Hardcover's GQL API — do not use it.
  const hasAudioEditions = book.editions?.some((e) => (e.audio_seconds ?? 0) > 0) ?? false;
  const hasAudio = (book.audio_seconds ?? 0) > 0 || hasAudioEditions;
  const effectiveType = preferAudio && hasAudio ? "AUDIOBOOK" : "BOOK";
  return {
    id: book.id,
    mediaType: effectiveType,
    title: book.title ?? "",
    year: book.release_year ?? null,
    posterUrl: book.image?.url ?? null,
    backdropUrl: null,
    overview: book.description ?? "",
    genres: book.cached_tags?.Genre ?? [],
    externalId: String(book.id),
    source: "HARDCOVER",
    metadata: {
      hardcoverId: book.id,
      authors: (book.contributions ?? []).map((c) => c.author?.name ?? "").filter(Boolean),
      series: (book.book_series ?? []).map((s) => s.series?.name ?? "").filter(Boolean),
      hasAudio,
    },
    hasAudio,
  };
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(HARDCOVER_GRAPHQL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Hardcover API error: ${res.status}`);
  const json = await res.json() as T & { errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    // Log GQL-level errors (e.g. invalid query, permission denied) so they're
    // visible in server logs rather than silently returning empty data.
    console.error("[Hardcover] GQL errors:", JSON.stringify(json.errors));
  }
  return json;
}

export async function searchHardcover(
  query: string,
  preferAudio = false
): Promise<HardcoverResult[]> {
  // Note: `results` is a raw Typesense JSON scalar. Fields in hits depend on
  // what Hardcover indexes — audio_seconds is indexed and more reliable than
  // audio_books (which only covers service integrations like Libro.fm).
  const q = `
    query Search($q: String!) {
      search(query: $q, query_type: "Book", per_page: 10) {
        results
      }
    }
  `;
  try {
    const data = await gql<HardcoverSearchResponse>(q, { q: query });
    const hits = data.data?.search?.results?.hits ?? [];
    const searchResults = hits
      .map((h) => h.document)
      .filter((b): b is HardcoverBook => !!b)
      .map((b) => mapBook(b, preferAudio));

    // When searching for audiobooks, Typesense may not have accurate audio_seconds
    // for all books. Batch-fetch full GQL details to get reliable hasAudio data.
    // (Same pattern getSimilarHardcover uses to get cover images.)
    if (preferAudio && searchResults.length > 0) {
      const ids = searchResults.map((r) => parseInt(r.externalId, 10)).filter((id) => !isNaN(id));
      if (ids.length > 0) {
        // Editions are fetched without Hasura filtering (avoids potential permission
        // errors on _gt operators). We filter client-side for audio_seconds > 0.
        const detailQuery = `
          query AudioSearchDetails($ids: [Int!]!) {
            books(where: { id: { _in: $ids } }, limit: 10) {
              id title release_year description
              image { url }
              cached_tags
              contributions { author { name } }
              book_series { series { name } }
              audio_seconds
              editions(limit: 10) { id audio_seconds }
            }
          }
        `;
        console.log(`[Hardcover] batch fetch for ${ids.length} ids (audiobook search)`);
        const detailData = await gql<HardcoverDetailResponse>(detailQuery, { ids });
        const books = detailData.data?.books ?? [];
        console.log(`[Hardcover] batch fetch returned ${books.length} books`);
        // Log audio signals for every book so we can diagnose hasAudio detection issues
        for (const b of books) {
          const audioEditions = (b.editions ?? []).filter(e => (e.audio_seconds ?? 0) > 0);
          console.log(
            `[Hardcover] book=${b.id} title="${b.title}" audio_seconds=${b.audio_seconds ?? 0} editions_with_audio=${audioEditions.length}`
          );
        }
        if (books.length > 0) {
          // Return GQL results (accurate audio_seconds + cover images)
          // preserving the original Typesense result order where possible.
          // Use Typesense posterUrl as fallback if GQL doesn't return an image —
          // GQL may have null image.url for books that Typesense has cached.
          const byId = new Map(books.map((b) => [b.id, b]));
          return searchResults
            .map((r) => {
              const full = byId.get(parseInt(r.externalId, 10));
              if (!full) return r;
              const mapped = mapBook(full, preferAudio);
              return { ...mapped, posterUrl: mapped.posterUrl ?? r.posterUrl };
            })
            .filter((r) => r !== null) as HardcoverResult[];
        }
      }
    }

    return searchResults;
  } catch (err) {
    console.error("[Hardcover] searchHardcover failed:", err);
    return [];
  }
}

export async function getSimilarHardcover(externalId: string): Promise<HardcoverResult[]> {
  // Hardcover has no native "similar books" endpoint.
  // Strategy: fetch the book's primary author, search for books by that author,
  // then batch-fetch full book details to get cover images.
  // (The search API returns Typesense index results which omit image.url.)
  const authorQuery = `
    query BookAuthor($id: Int!) {
      books(where: { id: { _eq: $id } }, limit: 1) {
        id
        contributions { author { name } }
        cached_tags
      }
    }
  `;
  try {
    const data = await gql<HardcoverDetailResponse>(authorQuery, { id: parseInt(externalId, 10) });
    const book = data.data?.books?.[0];
    if (!book) return [];

    const firstAuthor = book.contributions?.[0]?.author?.name;
    if (!firstAuthor) return [];

    // Search by author name, exclude the source book, cap at 8
    const searchResults = await searchHardcover(firstAuthor);
    const candidateIds = searchResults
      .filter((r) => r.externalId !== externalId)
      .slice(0, 8)
      .map((r) => parseInt(r.externalId, 10));

    if (candidateIds.length === 0) return [];

    // Batch-fetch full details so we get image.url (absent from Typesense search results)
    const detailQuery = `
      query SimilarBooks($ids: [Int!]!) {
        books(where: { id: { _in: $ids } }, limit: 8) {
          id title release_year description
          image { url }
          cached_tags
          contributions { author { name } }
          book_series { series { name } }
          audio_books { id }
          audio_seconds
        }
      }
    `;
    const detailData = await gql<HardcoverDetailResponse>(detailQuery, { ids: candidateIds });
    const books = detailData.data?.books ?? [];
    return books.map((b) => mapBook(b));
  } catch {
    return [];
  }
}

export async function getHardcoverDetail(
  id: string,
  preferAudio = false
): Promise<HardcoverResult | null> {
  const q = `
    query BookDetail($id: Int!) {
      books(where: { id: { _eq: $id } }, limit: 1) {
        id title release_year description
        image { url }
        cached_tags
        contributions { author { name } }
        book_series { series { name } }
        audio_books { id }
        audio_seconds
        editions(limit: 10) { id audio_seconds }
      }
    }
  `;
  try {
    const data = await gql<HardcoverDetailResponse>(q, { id: parseInt(id, 10) });
    const book = data.data?.books?.[0];
    return book ? mapBook(book, preferAudio) : null;
  } catch {
    return null;
  }
}
