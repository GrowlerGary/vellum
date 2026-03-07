import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await db.mediaEntry.findUnique({
    where: { id },
    include: { mediaItem: true },
  });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find the minimum sortOrder among WANT entries of the same media type for this user
  const minResult = await db.mediaEntry.aggregate({
    where: {
      userId: session.user.id,
      status: "WANT",
      mediaItem: { type: entry.mediaItem.type },
      id: { not: id },
    },
    _min: { sortOrder: true },
  });

  const currentMin = minResult._min.sortOrder ?? 0;
  const newSortOrder = currentMin - 1;

  const updated = await db.mediaEntry.update({
    where: { id },
    data: { sortOrder: newSortOrder },
    include: { mediaItem: true },
  });

  return NextResponse.json(updated);
}
