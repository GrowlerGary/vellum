import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const session = await auth();

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isProfilePublic: true,
      createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = session?.user.id === user.id;

  if (!user.isProfilePublic && !isOwner) {
    return NextResponse.json({ error: "Profile is private" }, { status: 403 });
  }

  const entries = await db.mediaEntry.findMany({
    where: {
      userId: user.id,
      ...(isOwner ? {} : { isPublic: true }),
    },
    include: { mediaItem: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ user, entries, isOwner });
}
