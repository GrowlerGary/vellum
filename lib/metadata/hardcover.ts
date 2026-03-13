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
  mediaType: "BOOK";
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: null;
  overview: string;
  genres: string[];
  externalId: string;
  source: "HARDCOVER";
  metadata: Record<string, unknown>;
}

interface HardcoverBook {
  id: number;
  title?: string;
  release_year?: number;
  image?: { url?: string };
  description?: string;
  book_series?: Array<{ series?: { name?: string } }>;
  contributions?: Array<{ author?: { name?: string } }>;
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

function mapBook(book: HardcoverBook): HardcoverResult {
  return {
    id: book.id,
    mediaType: "BOOK",
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
    },
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
    console.error("[Hardcover] GQL errors:", JSON.stringify(json.errors));
  }
  return json;
}

export async function searchHardcover(query: string): Promise<HardcoverResult[]> {
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
    return hits
      .map((h) => h.document)
      .filter((b): b is HardcoverBook => !!b)
      .map((b) => mapBook(b));
  } catch (err) {
    console.error("[Hardcover] searchHardcover failed:", err);
    return [];
  }
}

export async function getSimilarHardcover(externalId: string): Promise<HardcoverResult[]> {
  // Hardcover has no native "similar books" endpoint.
  // Strategy: fetch the book's primary author, search for books by that author,
  // then batch-fetch full book details to get cover images.
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

export async function getHardcoverDetail(id: string): Promise<HardcoverResult | null> {
  const q = `
    query BookDetail($id: Int!) {
      books(where: { id: { _eq: $id } }, limit: 1) {
        id title release_year description
        image { url }
        cached_tags
        contributions { author { name } }
        book_series { series { name } }
      }
    }
  `;
  try {
    const data = await gql<HardcoverDetailResponse>(q, { id: parseInt(id, 10) });
    const book = data.data?.books?.[0];
    return book ? mapBook(book) : null;
  } catch {
    return null;
  }
}
