import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getTmdbShowSeasons, getTmdbDetail } from "@/lib/metadata/tmdb";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [show, seasons] = await Promise.all([
    getTmdbDetail(id, "tv"),
    getTmdbShowSeasons(id),
  ]);

  if (!show) return Response.json({ error: "Not found" }, { status: 404 });

  const watchedEpisodeIds = await db.episodeWatch
    .findMany({ where: { userId: session.user.id, showExternalId: id } })
    .then((rows) => rows.map((r) => r.episodeId));

  return Response.json({ show, seasons, watchedEpisodeIds });
}
