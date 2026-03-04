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
  const warnings: string[] = [];

  if (!type || type === "MOVIE" || type === "TV_SHOW") {
    if (!process.env.TMDB_API_KEY) {
      warnings.push("Movie & TV results unavailable (TMDB not configured).");
    } else {
      try {
        const tmdbResults = await searchTmdb(query);
        const filtered = type ? tmdbResults.filter((r) => r.mediaType === type) : tmdbResults;
        results.push(...filtered);
      } catch (err) {
        console.error("TMDB search error:", err);
        warnings.push("Movie & TV search failed.");
      }
    }
  }

  if (!type || type === "VIDEO_GAME") {
    if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_CLIENT_SECRET) {
      warnings.push("Video game results unavailable (IGDB not configured).");
    } else {
      try {
        const igdbResults = await searchIgdb(query);
        results.push(...igdbResults);
      } catch (err) {
        console.error("IGDB search error:", err);
        warnings.push("Video game search failed.");
      }
    }
  }

  const wantsBooks = !type || type === "BOOK";
  const wantsAudio = !type || type === "AUDIOBOOK";

  if (wantsBooks || wantsAudio) {
    if (!process.env.HARDCOVER_API_KEY) {
      const label = wantsBooks && wantsAudio ? "Book & audiobook" : wantsAudio ? "Audiobook" : "Book";
      warnings.push(`${label} results unavailable (Hardcover not configured).`);
    } else {
      try {
        if (wantsBooks) {
          const bookResults = await searchHardcover(query, false);
          results.push(...bookResults);
        }
        if (wantsAudio) {
          const audioResults = await searchHardcover(query, true);
          if (type === "AUDIOBOOK") {
            results.push(...audioResults);
          } else {
            // In all-types mode include an AUDIOBOOK entry only for books that actually have audio
            results.push(...audioResults.filter((r) => (r as { hasAudio?: boolean }).hasAudio));
          }
        }
      } catch (err) {
        console.error("Hardcover search error:", err);
        warnings.push("Book/audiobook search failed.");
      }
    }
  }

  return NextResponse.json({ results, warnings });
}
