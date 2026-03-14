import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { getTmdbDetail } from "@/lib/metadata/tmdb";
import { getHardcoverDetail } from "@/lib/metadata/hardcover";
import { getAudnexusDetail } from "@/lib/metadata/audnexus";
import { getIgdbDetail } from "@/lib/metadata/igdb";

const createEntrySchema = z.object({
  mediaItem: z.object({
    externalId: z.string(),
    source: z.enum(["TMDB", "IGDB", "HARDCOVER", "MANUAL", "AUDNEXUS"]),
    type: z.enum(["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"]),
    title: z.string(),
    year: z.number().nullable().optional(),
    posterUrl: z.string().nullable().optional(),
    backdropUrl: z.string().nullable().optional(),
    overview: z.string().optional(),
    genres: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  status: z.enum(["WANT", "IN_PROGRESS", "COMPLETED", "DROPPED"]),
  rating: z.number().min(0.5).max(5).nullable().optional(),
  reviewText: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  const entries = await db.mediaEntry.findMany({
    where: {
      userId: session.user.id,
      ...(type ? { mediaItem: { type: type as never } } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: { mediaItem: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { mediaItem: itemData, ...entryData } = parsed.data;

  // Fetch rich metadata from the provider if not already provided
  let metadata = itemData.metadata ?? {};
  const hasRichMetadata = Object.keys(metadata).length > 2; // more than just an ID field
  if (!hasRichMetadata) {
    try {
      let detail;
      switch (itemData.source) {
        case "TMDB": {
          const tmdbType = itemData.type === "TV_SHOW" ? "tv" : "movie";
          detail = await getTmdbDetail(itemData.externalId, tmdbType);
          break;
        }
        case "HARDCOVER":
          detail = await getHardcoverDetail(itemData.externalId);
          break;
        case "AUDNEXUS":
          detail = await getAudnexusDetail(itemData.externalId);
          break;
        case "IGDB":
          detail = await getIgdbDetail(itemData.externalId);
          break;
      }
      if (detail) {
        metadata = detail.metadata as Record<string, unknown>;
      }
    } catch (err) {
      console.error("[entries] metadata enrichment failed:", err);
    }
  }

  // Upsert media item
  const mediaItem = await db.mediaItem.upsert({
    where: {
      source_externalId_type: {
        source: itemData.source,
        externalId: itemData.externalId,
        type: itemData.type,
      },
    },
    create: {
      ...itemData,
      genres: itemData.genres ?? [],
      overview: itemData.overview ?? "",
      metadata: metadata as object,
    },
    update: {
      title: itemData.title,
      posterUrl: itemData.posterUrl,
      backdropUrl: itemData.backdropUrl,
      metadata: metadata as object,
    },
  });

  // Upsert entry
  const entry = await db.mediaEntry.upsert({
    where: { userId_mediaItemId: { userId: session.user.id, mediaItemId: mediaItem.id } },
    create: {
      userId: session.user.id,
      mediaItemId: mediaItem.id,
      status: entryData.status,
      rating: entryData.rating ?? null,
      reviewText: entryData.reviewText ?? null,
      isPublic: entryData.isPublic ?? true,
      startedAt: entryData.startedAt ? new Date(entryData.startedAt) : null,
      completedAt: entryData.completedAt ? new Date(entryData.completedAt) : null,
    },
    update: {
      status: entryData.status,
      rating: entryData.rating ?? null,
      reviewText: entryData.reviewText ?? null,
      isPublic: entryData.isPublic ?? true,
      startedAt: entryData.startedAt ? new Date(entryData.startedAt) : null,
      completedAt: entryData.completedAt ? new Date(entryData.completedAt) : null,
    },
    include: { mediaItem: true },
  });

  return NextResponse.json(entry, { status: 201 });
}
