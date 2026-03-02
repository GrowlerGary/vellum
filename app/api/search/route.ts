import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTmdb } from "@/lib/metadata/tmdb";
import { searchIgdb } from "@/lib/metadata/igdb";
import { searchHardcover } from "@/lib/metadata/hardcover";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q")?.trim();
  const type = searchParams.get("type"); // MOVIE, TV_SHOW, BOOK, AUDIOBOOK, VIDEO_GAME, or null (all)

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: unknown[] = [];

  try {
    if (!type || type === "MOVIE" || type === "TV_SHOW") {
      const tmdbResults = await searchTmdb(query);
      const filtered = type
        ? tmdbResults.filter((r) => r.mediaType === type)
        : tmdbResults;
      results.push(...filtered);
    }

    if (!type || type === "VIDEO_GAME") {
      const igdbResults = await searchIgdb(query);
      results.push(...igdbResults);
    }

    if (!type || type === "BOOK") {
      const bookResults = await searchHardcover(query, false);
      results.push(...bookResults);
    }

    if (!type || type === "AUDIOBOOK") {
      const audioResults = await searchHardcover(query, true);
      // Only include books that have audio versions if filtering by AUDIOBOOK
      const filtered = type === "AUDIOBOOK"
        ? audioResults.filter((r) => r.hasAudio)
        : audioResults;
      // Avoid duplicates with book results
      if (type === "AUDIOBOOK") results.push(...filtered);
    }
  } catch (err) {
    console.error("Search error:", err);
  }

  return NextResponse.json({ results });
}
