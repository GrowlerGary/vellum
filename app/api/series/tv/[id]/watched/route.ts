import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: showExternalId } = await params;
  const { episodeId, watched } = await req.json() as { episodeId: number; watched: boolean };

  if (watched) {
    await db.episodeWatch.upsert({
      where: { userId_episodeId: { userId: session.user.id, episodeId } },
      create: { userId: session.user.id, showExternalId, episodeId },
      update: {},
    });
  } else {
    await db.episodeWatch.deleteMany({
      where: { userId: session.user.id, episodeId },
    });
  }

  return Response.json({ ok: true });
}
