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

type HardcoverTag = string | { tag?: string; tagSlug?: string; category?: string; categorySlug?: string; spoilerRatio?: number; count?: number };

interface HardcoverBook {
  id: number;
  title?: string;
  release_year?: number;
  release_date?: string;
  image?: { url?: string };
  description?: string;
  book_series?: Array<{ series?: { id?: number; name?: string }; position?: number }>;
  contributions?: Array<{ author?: { name?: string }; contribution?: string }>;
  editions?: Array<{ reading_format_id?: number; contributions?: Array<{ author?: { name?: string }; contribution?: string }> }>;
  audio_books?: Array<{ id: number }>;
  has_audiobook?: boolean;
  cached_tags?: { Genre?: HardcoverTag[] };
  rating?: number;
  ratings_count?: number;
  pages?: number;
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
  const hasAudio = book.has_audiobook === true || (book.audio_books?.length ?? 0) > 0;
  const effectiveType = preferAudio ? "AUDIOBOOK" : "BOOK";
  const contributions = book.contributions ?? [];
  const authors = contributions
    .filter((c) => {
      const role = (c.contribution ?? "").toLowerCase();
      return !role || role.includes("author") || role.includes("writer");
    })
    .map((c) => c.author?.name ?? "")
    .filter(Boolean);
  const NARRATOR_TERMS = ["narrator", "read by", "reader", "performed by"];
  const isNarratorRole = (role: string) => NARRATOR_TERMS.some((t) => role.includes(t));
  const bookNarrators = contributions
    .filter((c) => isNarratorRole((c.contribution ?? "").toLowerCase()))
    .map((c) => c.author?.name ?? "")
    .filter(Boolean);
  // reading_format_id=2 is audio; narrators are on edition contributions
  const audioEditions = (book.editions ?? []).filter((e) => e.reading_format_id === 2);
  const editionNarrators = audioEditions
    .flatMap((e) => e.contributions ?? [])
    .filter((c) => isNarratorRole((c.contribution ?? "").toLowerCase()))
    .map((c) => c.author?.name ?? "")
    .filter(Boolean);
  const narrators = [...new Set([...bookNarrators, ...editionNarrators])];
  const allContributors = contributions.map((c) => c.author?.name ?? "").filter(Boolean);
  return {
    id: book.id,
    mediaType: effectiveType,
    title: book.title ?? "",
    year: book.release_year ?? null,
    posterUrl: book.image?.url ?? null,
    backdropUrl: null,
    overview: book.description ?? "",
    genres: (book.cached_tags?.Genre ?? []).map((g) =>
      typeof g === "string" ? g : (g.tag ?? "")
    ).filter(Boolean),
    externalId: String(book.id),
    source: "HARDCOVER",
    metadata: {
      hardcoverId: book.id,
      authors: authors.length > 0 ? authors : allContributors,
      narrators,
      series: (book.book_series ?? []).map((s) => {
        const name = s.series?.name ?? "";
        if (!name) return "";
        return s.position != null ? `${name} #${s.position}` : name;
      }).filter(Boolean),
      seriesData: (book.book_series ?? [])
        .filter((s) => s.series?.id && s.series?.name)
        .map((s) => ({ id: s.series!.id, name: s.series!.name, position: s.position ?? null })),
      hasAudio,
      pages: book.pages ?? null,
      rating: book.rating ?? null,
      ratingsCount: book.ratings_count ?? null,
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
        id title release_year description pages rating ratings_count
        image { url }
        cached_tags
        contributions { author { name } contribution }
        book_series { series { id name } position }
        editions(where: { reading_format_id: { _eq: 2 } }, limit: 5) {
          reading_format_id
          contributions { author { name } contribution }
        }
      }
    }
  `;
  try {
    const data = await gql<HardcoverDetailResponse>(q, { id: parseInt(id, 10) });
    const book = data.data?.books?.[0];
    return book ? mapBook(book, preferAudio) : null;
  } catch (err) {
    console.error("Hardcover detail error:", err);
    return null;
  }
}

export interface HardcoverSeriesBook {
  id: number;
  title: string;
  position: number | null;
  year: number | null;
  posterUrl: string | null;
  authors: string[];
  hasAudio: boolean;
}

export interface HardcoverSeriesResult {
  id: number;
  name: string;
  books: HardcoverSeriesBook[];
}

interface HardcoverSeriesResponse {
  data?: {
    series?: Array<{
      id: number;
      name: string;
      book_series?: Array<{
        position?: number;
        book?: {
          id: number;
          title?: string;
          release_year?: number;
          image?: { url?: string };
          contributions?: Array<{ author?: { name?: string }; contribution?: string }>;
          editions?: Array<{ reading_format_id?: number }>;
        };
      }>;
    }>;
  };
}

export async function getHardcoverSeries(id: number): Promise<HardcoverSeriesResult | null> {
  const q = `
    query SeriesDetail($id: Int!) {
      series(where: { id: { _eq: $id } }, limit: 1) {
        id name
        book_series(order_by: { position: asc }) {
          position
          book {
            id title release_year
            image { url }
            contributions { author { name } contribution }
            editions(where: { reading_format_id: { _eq: 2 } }, limit: 1) { reading_format_id }
          }
        }
      }
    }
  `;
  try {
    const data = await gql<HardcoverSeriesResponse>(q, { id });
    const series = data.data?.series?.[0];
    if (!series) return null;
    const books: HardcoverSeriesBook[] = (series.book_series ?? [])
      .filter((bs) => bs.book)
      .map((bs) => {
        const b = bs.book!;
        const contribs = b.contributions ?? [];
        const authors = contribs
          .filter((c) => { const r = (c.contribution ?? "").toLowerCase(); return !r || r.includes("author") || r.includes("writer"); })
          .map((c) => c.author?.name ?? "")
          .filter(Boolean);
        return {
          id: b.id,
          title: b.title ?? "",
          position: bs.position ?? null,
          year: b.release_year ?? null,
          posterUrl: b.image?.url ?? null,
          authors: authors.length > 0 ? authors : contribs.map((c) => c.author?.name ?? "").filter(Boolean),
          hasAudio: (b.editions?.length ?? 0) > 0,
        };
      });
    return { id: series.id, name: series.name, books };
  } catch (err) {
    console.error("Hardcover series error:", err);
    return null;
  }
}
