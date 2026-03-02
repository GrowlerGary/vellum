import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      isProfilePublic: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await db.user.findFirst({
    where: {
      OR: [
        { email: parsed.data.email },
        { username: parsed.data.username },
      ],
    },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Username or email already taken" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await db.user.create({
    data: {
      username: parsed.data.username,
      email: parsed.data.email,
      passwordHash,
      displayName: parsed.data.displayName ?? null,
      role: parsed.data.role ?? "USER",
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
