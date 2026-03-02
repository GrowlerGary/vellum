const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTwitchToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("IGDB credentials not set");

  const res = await fetch(
    `${TWITCH_TOKEN_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Failed to get Twitch token");
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface IgdbResult {
  id: number;
  mediaType: "VIDEO_GAME";
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  genres: string[];
  externalId: string;
  source: "IGDB";
  metadata: Record<string, unknown>;
}

interface IgdbGame {
  id: number;
  name?: string;
  summary?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  screenshots?: Array<{ image_id?: string }>;
  genres?: Array<{ name?: string }>;
  rating?: number;
  involved_companies?: Array<{
    company?: { name?: string };
    developer?: boolean;
  }>;
}

function coverUrl(imageId: string, size = "cover_big"): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

function mapGame(game: IgdbGame): IgdbResult {
  const ts = game.first_release_date;
  return {
    id: game.id,
    mediaType: "VIDEO_GAME",
    title: game.name ?? "",
    year: ts ? new Date(ts * 1000).getFullYear() : null,
    posterUrl: game.cover?.image_id ? coverUrl(game.cover.image_id) : null,
    backdropUrl:
      game.screenshots?.[0]?.image_id
        ? coverUrl(game.screenshots[0].image_id, "screenshot_big")
        : null,
    overview: game.summary ?? "",
    genres: (game.genres ?? []).map((g) => g.name ?? "").filter(Boolean),
    externalId: String(game.id),
    source: "IGDB",
    metadata: {
      igdbId: game.id,
      rating: game.rating,
      developers: (game.involved_companies ?? [])
        .filter((c) => c.developer)
        .map((c) => c.company?.name ?? ""),
    },
  };
}

async function igdbPost(endpoint: string, body: string): Promise<IgdbGame[]> {
  const clientId = process.env.IGDB_CLIENT_ID;
  if (!clientId) throw new Error("IGDB_CLIENT_ID not set");
  const token = await getTwitchToken();
  const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) return [];
  return res.json() as Promise<IgdbGame[]>;
}

export async function searchIgdb(query: string): Promise<IgdbResult[]> {
  const body = `search "${query}"; fields name,summary,first_release_date,cover.image_id,screenshots.image_id,genres.name,rating; limit 10;`;
  const games = await igdbPost("games", body);
  return games.map(mapGame);
}

export async function getIgdbDetail(id: string): Promise<IgdbResult | null> {
  const body = `where id = ${id}; fields name,summary,first_release_date,cover.image_id,screenshots.image_id,genres.name,rating,involved_companies.company.name,involved_companies.developer; limit 1;`;
  const games = await igdbPost("games", body);
  return games[0] ? mapGame(games[0]) : null;
}
