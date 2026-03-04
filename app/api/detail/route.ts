import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTmdbDetail } from "@/lib/metadata/tmdb";
import { getIgdbDetail } from "@/lib/metadata/igdb";
import { getHardcoverDetail } from "@/lib/metadata/hardcover";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source");
  const externalId = searchParams.get("id");
  const type = searchParams.get("type");

  if (!source || !externalId || !type) {
    return Response.json({ error: "Missing required params: source, id, type" }, { status: 400 });
  }

  let item = null;
  try {
    if (source === "TMDB") {
      const tmdbType = type === "MOVIE" ? "movie" : "tv";
      item = await getTmdbDetail(externalId, tmdbType);
    } else if (source === "IGDB") {
      item = await getIgdbDetail(externalId);
    } else if (source === "HARDCOVER") {
      item = await getHardcoverDetail(externalId, type === "AUDIOBOOK");
    }
  } catch (err) {
    console.error(`Detail fetch error [${source}/${externalId}]:`, err);
    return Response.json({ error: "Failed to fetch metadata" }, { status: 502 });
  }

  if (!item) {
    console.warn(`Detail not found [${source}/${externalId}] type=${type}`);
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Check for an existing user entry (best-effort — skip if not authenticated)
  let entry = null;
  const session = await auth();
  if (session?.user?.id) {
    const mediaItem = await db.mediaItem.findFirst({
      where: { externalId, source: source as "TMDB" | "IGDB" | "HARDCOVER" },
    });
    if (mediaItem) {
      const dbEntry = await db.mediaEntry.findFirst({
        where: { userId: session.user.id, mediaItemId: mediaItem.id },
      });
      if (dbEntry) {
        entry = {
          id: dbEntry.id,
          status: dbEntry.status as string,
          rating: dbEntry.rating ? Number(dbEntry.rating) : null,
          reviewText: dbEntry.reviewText,
          isPublic: dbEntry.isPublic,
        };
      }
    }
  }

  // Normalize mediaType → type for the dialog (all result objects use mediaType internally)
  const normalizedItem = {
    ...item,
    type: (item as { mediaType?: string }).mediaType ?? type,
    genres: Array.isArray((item as { genres?: unknown }).genres)
      ? (item as { genres: string[] }).genres
      : [],
  };

  return Response.json({ item: normalizedItem, entry });
}
