import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lists = await db.mediaList.findMany({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { mediaItem: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const list = await db.mediaList.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isPublic: parsed.data.isPublic ?? true,
    },
    include: { items: true },
  });

  return NextResponse.json(list, { status: 201 });
}
