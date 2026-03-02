import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

/**
 * Audiobookshelf webhook receiver.
 *
 * Setup: In Audiobookshelf → Settings → Notifications, add a webhook:
 *   URL: https://yourdomain.com/api/scrobble/audiobookshelf?userId=<userId>
 *   Events: media_progress_updated
 *
 * Reference: https://api.audiobookshelf.org/#webhooks
 */

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

interface AbsMediaItem {
  metadata?: {
    title?: string;
    authorName?: string;
    publishedYear?: string;
  };
  media?: {
    metadata?: {
      title?: string;
      authorName?: string;
      publishedYear?: string;
    };
  };
}

interface AbsPayload {
  event?: string;
  mediaProgress?: {
    isFinished?: boolean;
    progress?: number;
    currentTime?: number;
    duration?: number;
  };
  libraryItem?: AbsMediaItem;
  mediaItem?: AbsMediaItem;
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-abs-signature") ?? "";

  const config = await db.scrobbleConfig.findUnique({
    where: { userId_source: { userId, source: "AUDIOBOOKSHELF" } },
  });

  if (!config?.isEnabled) {
    return NextResponse.json({ error: "Scrobble not configured" }, { status: 403 });
  }

  if (config.webhookSecret && signature) {
    if (!verifySignature(rawBody, signature, config.webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: AbsPayload;
  try {
    payload = JSON.parse(rawBody) as AbsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event;
  if (event !== "media_progress_updated") {
    return NextResponse.json({ status: "ignored", event });
  }

  const progress = payload.mediaProgress;
  const isFinished = progress?.isFinished ?? false;
  const progressPct = progress?.progress ?? 0;

  const item = payload.libraryItem ?? payload.mediaItem;
  const meta = item?.metadata ?? item?.media?.metadata;
  const title = meta?.title ?? "Unknown";
  const year = meta?.publishedYear ? parseInt(meta.publishedYear, 10) : null;

  const externalId = `abs-${userId}-${encodeURIComponent(title)}`;

  const mediaItem = await db.mediaItem.upsert({
    where: { source_externalId: { source: "MANUAL", externalId } },
    create: {
      type: "AUDIOBOOK",
      externalId,
      source: "MANUAL",
      title,
      year: isNaN(year ?? NaN) ? null : year,
      genres: [],
      overview: "",
      metadata: { absAuthor: meta?.authorName },
    },
    update: {},
  });

  const status = isFinished ? "COMPLETED" : progressPct > 0 ? "IN_PROGRESS" : "WANT";

  await db.mediaEntry.upsert({
    where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
    create: {
      userId,
      mediaItemId: mediaItem.id,
      status,
      isPublic: true,
      startedAt: progressPct > 0 ? new Date() : null,
      completedAt: isFinished ? new Date() : null,
    },
    update: {
      status,
      completedAt: isFinished ? new Date() : undefined,
    },
  });

  return NextResponse.json({ status: "ok", title, finished: isFinished });
}
