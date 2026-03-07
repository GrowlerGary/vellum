import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSuggestions } from "@/lib/ai/index";

const CACHE_HOURS = 24;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const rawType = searchParams.get("type") ?? "MOVIE";
  const VALID_TYPES = ["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"] as const;
  if (!VALID_TYPES.includes(rawType as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const mediaType = rawType;
  const refresh = searchParams.get("refresh") === "true";

  // Check cache
  if (!refresh) {
    const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000);
    const cached = await db.aiSuggestion.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gt: cutoff },
        mediaItem: { type: mediaType as never },
      },
      include: { mediaItem: true },
      orderBy: { score: "desc" },
      take: 10,
    });
    if (cached.length > 0) {
      return NextResponse.json({ suggestions: cached, cached: true });
    }
  }

  // Build context from user's entries
  const entries = await db.mediaEntry.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["COMPLETED", "IN_PROGRESS"] },
    },
    include: { mediaItem: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const consumed = entries.map((e) => ({
    title: e.mediaItem.title,
    type: e.mediaItem.type,
    rating: e.rating,
    status: e.status,
  }));

  const suggestions = await getSuggestions(consumed, mediaType);

  // Persist suggestions (upsert MediaItems then AiSuggestions)
  const saved = await Promise.all(
    suggestions.map(async (s) => {
      const mediaItem = await db.mediaItem.upsert({
        where: {
          source_externalId: { source: "MANUAL", externalId: `ai-${slugify(s.title)}-${s.year ?? 0}` },
        },
        create: {
          type: mediaType as never,
          externalId: `ai-${slugify(s.title)}-${s.year ?? 0}`,
          source: "MANUAL",
          title: s.title,
          year: s.year ?? null,
          overview: s.reason,
          genres: [],
          metadata: {},
        },
        update: {},
      });

      const suggestion = await db.aiSuggestion.create({
        data: {
          userId: session.user.id,
          mediaItemId: mediaItem.id,
          reason: s.reason,
          score: s.score,
        },
        include: { mediaItem: true },
      });

      return suggestion;
    })
  );

  return NextResponse.json({ suggestions: saved, cached: false });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
