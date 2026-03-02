import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["WANT", "IN_PROGRESS", "COMPLETED", "DROPPED"]).optional(),
  rating: z.number().min(0.5).max(5).nullable().optional(),
  reviewText: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await db.mediaEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db.mediaEntry.update({
    where: { id },
    data: {
      ...parsed.data,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : undefined,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : undefined,
    },
    include: { mediaItem: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await db.mediaEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.mediaEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
