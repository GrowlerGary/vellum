import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createEntrySchema = z.object({
  mediaItem: z.object({
    externalId: z.string(),
    source: z.enum(["TMDB", "IGDB", "HARDCOVER", "MANUAL"]),
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

  // Upsert media item
  const mediaItem = await db.mediaItem.upsert({
    where: {
      source_externalId: {
        source: itemData.source,
        externalId: itemData.externalId,
      },
    },
    create: {
      ...itemData,
      genres: itemData.genres ?? [],
      overview: itemData.overview ?? "",
      metadata: (itemData.metadata ?? {}) as object,
    },
    update: {
      title: itemData.title,
      posterUrl: itemData.posterUrl,
      backdropUrl: itemData.backdropUrl,
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
