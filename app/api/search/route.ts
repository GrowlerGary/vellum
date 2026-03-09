import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTmdb } from "@/lib/metadata/tmdb";
import { searchIgdb } from "@/lib/metadata/igdb";
import { searchHardcover } from "@/lib/metadata/hardcover";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 30 searches per minute per user
  if (!rateLimit(`search:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

    if (type === "BOOK") {
      // Explicit book filter: return all results as BOOK regardless of audio
      results.push(...(await searchHardcover(query, false)));
    } else if (type === "AUDIOBOOK") {
      // Explicit audiobook filter: only items that actually have audio
      results.push(...(await searchHardcover(query, true)).filter((r) => r.hasAudio));
    } else if (!type) {
      // All types: single Hardcover call with preferAudio=true so items with
      // audio surface as AUDIOBOOK and items without audio surface as BOOK.
      // One call avoids showing the same title twice as both BOOK and AUDIOBOOK.
      results.push(...(await searchHardcover(query, true)));
    }
    // For MOVIE / TV_SHOW / VIDEO_GAME filters, Hardcover is not queried.
  } catch (err) {
    console.error("Search error:", err);
  }

  return NextResponse.json({ results });
}
