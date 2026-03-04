import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from "@/lib/utils";
import { LibraryClient } from "./LibraryClient";

const VALID_TYPES = ["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"] as const;
type ValidType = (typeof VALID_TYPES)[number];

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return { title: MEDIA_TYPE_LABELS[type] ?? "Library" };
}

export default async function LibraryPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!VALID_TYPES.includes(type as ValidType)) notFound();

  const session = await auth();
  if (!session) return null;

  const entries = await db.mediaEntry.findMany({
    where: { userId: session.user.id, mediaItem: { type: type as ValidType } },
    include: { mediaItem: true },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = entries.map((e) => ({
    id: e.id,
    status: e.status as string,
    rating: e.rating ? Number(e.rating) : null,
    reviewText: e.reviewText,
    isPublic: e.isPublic,
    mediaItem: {
      id: e.mediaItem.id,
      externalId: e.mediaItem.externalId,
      source: e.mediaItem.source as string,
      title: e.mediaItem.title,
      year: e.mediaItem.year,
      posterUrl: e.mediaItem.posterUrl,
      overview: e.mediaItem.overview,
      genres: e.mediaItem.genres,
      type: e.mediaItem.type as string,
      metadata: e.mediaItem.metadata as Record<string, unknown>,
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{MEDIA_TYPE_ICONS[type]}</span>
        <h1 className="text-2xl font-bold text-zinc-900">{MEDIA_TYPE_LABELS[type]}</h1>
      </div>
      <LibraryClient entries={serialized} />
    </div>
  );
}
