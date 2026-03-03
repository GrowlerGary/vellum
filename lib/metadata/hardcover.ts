const HARDCOVER_GRAPHQL = "https://api.hardcover.app/v1/graphql";

function getHeaders() {
  const key = process.env.HARDCOVER_API_KEY;
  if (!key) throw new Error("HARDCOVER_API_KEY not set");
  // The Hardcover settings page shows the token as "Bearer <token>".
  // Accept either the full string or just the raw token.
  const token = key.startsWith("Bearer ") ? key.slice(7) : key;
  return {
    Authorization: `Bearer ${token}`,
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
  audio_books?: Array<{ id: number }>;
  cached_tags?: { Genre?: string[] };
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
  const hasAudio = (book.audio_books?.length ?? 0) > 0;
  const effectiveType = preferAudio ? "AUDIOBOOK" : "BOOK";
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
  const json = await res.json() as { errors?: Array<{ message: string }> } & T;
  if (json.errors?.length) throw new Error(`Hardcover GraphQL error: ${json.errors[0].message}`);
  return json;
}

export async function searchHardcover(
  query: string,
  preferAudio = false
): Promise<HardcoverResult[]> {
  const q = `
    query Search($q: String!) {
      search(query: $q, query_type: "Book", per_page: 10) {
        results
      }
    }
  `;
  const data = await gql<HardcoverSearchResponse>(q, { q: query });
  const hits = data.data?.search?.results?.hits ?? [];
  return hits
    .map((h) => h.document)
    .filter((b): b is HardcoverBook => !!b)
    .map((b) => mapBook(b, preferAudio));
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
