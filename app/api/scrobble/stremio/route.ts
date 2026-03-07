import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { z } from "zod";

/**
 * Stremio scrobble endpoint.
 *
 * Stremio does not have native webhook support. This endpoint is designed to
 * receive events from the community Stremio-to-Webhook addon or a custom
 * Stremio service-worker extension that POSTs play events.
 *
 * Alternatively, use Trakt scrobbling via the official Trakt Stremio addon
 * and configure the Trakt webhook here instead.
 *
 * Payload format expected (custom):
 * {
 *   "action": "watched",
 *   "type": "movie" | "series",
 *   "imdb_id": "tt1234567",
 *   "title": "...",
 *   "year": 2023,
 *   "season": 1,      // for series
 *   "episode": 3      // for series
 * }
 */

function verifyToken(secret: string, provided: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
  } catch {
    return false;
  }
}

const stremioPayloadSchema = z.object({
  action: z.string().optional(),
  type: z.string().optional(),
  imdb_id: z.string().optional(),
  title: z.string().optional(),
  year: z.number().optional(),
  season: z.number().optional(),
  episode: z.number().optional(),
}).passthrough()

type StremioPayload = z.infer<typeof stremioPayloadSchema>

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const config = await db.scrobbleConfig.findUnique({
    where: { userId_source: { userId, source: "STREMIO" } },
  });

  if (!config?.isEnabled) {
    return NextResponse.json({ error: "Scrobble not configured" }, { status: 403 });
  }

  // Token-based auth
  const token = req.headers.get("x-stremio-token") ?? searchParams.get("token") ?? "";
  if (config.webhookSecret && !verifyToken(config.webhookSecret, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = stremioPayloadSchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const payload: StremioPayload = parsedBody.data;

  if (payload.action !== "watched") {
    return NextResponse.json({ status: "ignored", action: payload.action });
  }

  const mediaType = payload.type === "series" ? "TV_SHOW" : "MOVIE";
  const title = payload.title ?? "Unknown";
  const externalId = payload.imdb_id ?? `stremio-${userId}-${encodeURIComponent(title)}`;
  const source = payload.imdb_id ? "TMDB" : "MANUAL";

  const mediaItem = await db.mediaItem.upsert({
    where: { source_externalId: { source, externalId } },
    create: {
      type: mediaType,
      externalId,
      source,
      title,
      year: payload.year ?? null,
      genres: [],
      overview: "",
      metadata: { imdbId: payload.imdb_id, season: payload.season, episode: payload.episode },
    },
    update: {},
  });

  await db.mediaEntry.upsert({
    where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
    create: {
      userId,
      mediaItemId: mediaItem.id,
      status: "COMPLETED",
      isPublic: true,
      completedAt: new Date(),
    },
    update: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ status: "ok", title, mediaType });
}
