const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

function getHeaders() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export interface TmdbResult {
  id: number;
  mediaType: "MOVIE" | "TV_SHOW";
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  genres: string[];
  externalId: string;
  source: "TMDB";
  metadata: Record<string, unknown>;
}

interface TmdbSearchItem {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  genre_ids?: number[];
}

// Similar endpoint returns items without media_type — type is known from the caller
interface TmdbSimilarItem {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genre_ids?: number[];
}

interface TmdbCastMember {
  name: string;
  character: string;
  order: number;
}

interface TmdbCrewMember {
  name: string;
  job: string;
  department: string;
}

interface TmdbDetail {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  runtime?: number;
  episode_run_time?: number[];
  status?: string;
  tagline?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  credits?: {
    cast?: TmdbCastMember[];
    crew?: TmdbCrewMember[];
  };
}

function mapItem(item: TmdbSearchItem): TmdbResult | null {
  if (item.media_type !== "movie" && item.media_type !== "tv") return null;
  const isMovie = item.media_type === "movie";
  const rawYear = isMovie ? item.release_date : item.first_air_date;
  return {
    id: item.id,
    mediaType: isMovie ? "MOVIE" : "TV_SHOW",
    title: isMovie ? (item.title ?? "") : (item.name ?? ""),
    year: rawYear ? new Date(rawYear).getFullYear() : null,
    posterUrl: item.poster_path
      ? `${TMDB_IMAGE}/w500${item.poster_path}`
      : null,
    backdropUrl: item.backdrop_path
      ? `${TMDB_IMAGE}/w1280${item.backdrop_path}`
      : null,
    overview: item.overview ?? "",
    genres: [],
    externalId: String(item.id),
    source: "TMDB",
    metadata: { tmdbId: item.id, mediaType: item.media_type },
  };
}

function mapSimilarItem(item: TmdbSimilarItem, mediaType: "MOVIE" | "TV_SHOW"): TmdbResult {
  const isMovie = mediaType === "MOVIE";
  const rawYear = isMovie ? item.release_date : item.first_air_date;
  return {
    id: item.id,
    mediaType,
    title: isMovie ? (item.title ?? "") : (item.name ?? ""),
    year: rawYear ? new Date(rawYear).getFullYear() : null,
    posterUrl: item.poster_path ? `${TMDB_IMAGE}/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${TMDB_IMAGE}/w1280${item.backdrop_path}` : null,
    overview: item.overview ?? "",
    genres: [],
    externalId: String(item.id),
    source: "TMDB",
    metadata: { tmdbId: item.id, mediaType: isMovie ? "movie" : "tv" },
  };
}

export async function getSimilarTmdb(
  externalId: string,
  mediaType: "movie" | "tv"
): Promise<TmdbResult[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/${mediaType}/${externalId}/similar?language=en-US&page=1`,
      { headers: getHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json() as { results: TmdbSimilarItem[] };
    const appType: "MOVIE" | "TV_SHOW" = mediaType === "movie" ? "MOVIE" : "TV_SHOW";
    return (data.results ?? []).slice(0, 8).map((item) => mapSimilarItem(item, appType));
  } catch {
    return [];
  }
}

export async function searchTmdb(query: string): Promise<TmdbResult[]> {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&include_adult=false`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) return [];
  const data = await res.json() as { results: TmdbSearchItem[] };
  return (data.results ?? [])
    .map(mapItem)
    .filter((x): x is TmdbResult => x !== null)
    .slice(0, 10);
}

export async function getTmdbDetail(
  id: string,
  type: "movie" | "tv"
): Promise<TmdbResult | null> {
  const url = `${TMDB_BASE}/${type}/${id}?append_to_response=credits`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) return null;
  const item = await res.json() as TmdbDetail;
  const isMovie = type === "movie";
  const rawYear = isMovie ? item.release_date : item.first_air_date;

  const director = item.credits?.crew?.find((c) => c.job === "Director")?.name ?? null;
  const cast = (item.credits?.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.name);

  return {
    id: item.id,
    mediaType: isMovie ? "MOVIE" : "TV_SHOW",
    title: isMovie ? (item.title ?? "") : (item.name ?? ""),
    year: rawYear ? new Date(rawYear).getFullYear() : null,
    posterUrl: item.poster_path
      ? `${TMDB_IMAGE}/w500${item.poster_path}`
      : null,
    backdropUrl: item.backdrop_path
      ? `${TMDB_IMAGE}/w1280${item.backdrop_path}`
      : null,
    overview: item.overview ?? "",
    genres: (item.genres ?? []).map((g) => g.name),
    externalId: String(item.id),
    source: "TMDB",
    metadata: {
      tmdbId: item.id,
      voteAverage: item.vote_average,
      runtime: item.runtime,
      status: item.status,
      tagline: item.tagline,
      numberOfSeasons: item.number_of_seasons,
      numberOfEpisodes: item.number_of_episodes,
      director,
      cast,
      lastAirDate: item.last_air_date ?? null,
      episodeRunTime: item.episode_run_time?.[0] ?? null,
    },
  };
}
