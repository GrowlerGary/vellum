import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getHardcoverSeries } from "@/lib/metadata/hardcover";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const seriesId = parseInt(id, 10);
  if (isNaN(seriesId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const series = await getHardcoverSeries(seriesId);
  if (!series) return Response.json({ error: "Not found" }, { status: 404 });

  // Find which books the user has in their library
  const externalIds = series.books.map((b) => String(b.id));
  const libraryItems = await db.mediaItem.findMany({
    where: { source: "HARDCOVER", externalId: { in: externalIds } },
    include: {
      entries: { where: { userId: session.user.id }, take: 1 },
    },
  });

  const libraryMap = Object.fromEntries(
    libraryItems.map((item) => [item.externalId, item.entries[0] ?? null])
  );

  return Response.json({ series, libraryMap });
}
