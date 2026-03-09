import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { z } from "zod";

/**
 * Trakt scrobble webhook receiver.
 *
 * Setup: In your Trakt app settings, add a webhook pointing to:
 *   https://yourdomain.com/api/scrobble/trakt?userId=<userId>
 *
 * Trakt sends events when you start/pause/stop watching content.
 * Reference: https://trakt.docs.apiary.io/#reference/scrobble
 */

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    // timingSafeEqual throws if buffer lengths differ
    return false;
  }
}

const traktIdsSchema = z.object({ tmdb: z.number().optional() }).passthrough()
const traktPayloadSchema = z.object({
  action: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  movie: z.object({
    ids: traktIdsSchema.optional(),
    title: z.string().optional(),
    year: z.number().optional(),
  }).passthrough().optional(),
  episode: z.object({
    ids: traktIdsSchema.optional(),
    title: z.string().optional(),
    season: z.number().optional(),
    number: z.number().optional(),
  }).passthrough().optional(),
  show: z.object({
    ids: traktIdsSchema.optional(),
    title: z.string().optional(),
    year: z.number().optional(),
  }).passthrough().optional(),
}).passthrough()

type TraktPayload = z.infer<typeof traktPayloadSchema>

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-trakt-signature") ?? "";

  // Verify webhook signature
  const config = await db.scrobbleConfig.findUnique({
    where: { userId_source: { userId, source: "TRAKT" } },
  });

  if (!config?.isEnabled) {
    return NextResponse.json({ error: "Scrobble not configured" }, { status: 403 });
  }

  if (config.webhookSecret && signature) {
    if (!verifySignature(rawBody, signature, config.webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = traktPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const payload: TraktPayload = parsed.data;

  const action = payload.action;
  // Only process "scrobble" events (completed watches)
  if (action !== "scrobble") {
    return NextResponse.json({ status: "ignored", action });
  }

  const isMovie = !!payload.movie;
  const tmdbId = isMovie ? payload.movie?.ids?.tmdb : payload.show?.ids?.tmdb;
  const title = isMovie ? (payload.movie?.title ?? "") : (payload.show?.title ?? "");
  const year = isMovie ? payload.movie?.year : payload.show?.year;

  if (!tmdbId) return NextResponse.json({ status: "no_tmdb_id" });

  const externalId = String(tmdbId);
  const mediaType = isMovie ? "MOVIE" : "TV_SHOW";

  // Upsert media item
  const mediaItem = await db.mediaItem.upsert({
    where: { source_externalId_type: { source: "TMDB", externalId, type: mediaType } },
    create: {
      type: mediaType,
      externalId,
      source: "TMDB",
      title,
      year: year ?? null,
      genres: [],
      overview: "",
      metadata: { tmdbId },
    },
    update: {},
  });

  // Create/update entry as COMPLETED
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
