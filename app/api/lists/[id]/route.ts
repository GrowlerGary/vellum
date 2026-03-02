import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  addMediaItemId: z.string().optional(),
  removeMediaItemId: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const list = await db.mediaList.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, displayName: true } },
      items: {
        include: { mediaItem: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check visibility
  const session = await auth();
  if (!list.isPublic && list.userId !== session?.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(list);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const list = await db.mediaList.findUnique({ where: { id } });
  if (!list || list.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { addMediaItemId, removeMediaItemId, ...updateData } = parsed.data;

  const updated = await db.mediaList.update({
    where: { id },
    data: updateData,
    include: { items: { include: { mediaItem: true } } },
  });

  if (addMediaItemId) {
    const count = await db.listItem.count({ where: { listId: id } });
    await db.listItem.upsert({
      where: { listId_mediaItemId: { listId: id, mediaItemId: addMediaItemId } },
      create: { listId: id, mediaItemId: addMediaItemId, sortOrder: count },
      update: {},
    });
  }

  if (removeMediaItemId) {
    await db.listItem.deleteMany({
      where: { listId: id, mediaItemId: removeMediaItemId },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const list = await db.mediaList.findUnique({ where: { id } });
  if (!list || list.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.mediaList.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
