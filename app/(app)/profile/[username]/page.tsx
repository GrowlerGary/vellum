import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { MediaCard } from "@/components/media/MediaCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from "@/lib/utils";

interface Props { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const MEDIA_TYPES = ["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"];

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const session = await auth();

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, displayName: true,
      avatarUrl: true, bio: true, isProfilePublic: true, createdAt: true,
    },
  });

  if (!user) notFound();

  const isOwner = session?.user.id === user.id;
  if (!user.isProfilePublic && !isOwner) notFound();

  const entries = await db.mediaEntry.findMany({
    where: {
      userId: user.id,
      ...(isOwner ? {} : { isPublic: true }),
    },
    include: { mediaItem: true },
    orderBy: { updatedAt: "desc" },
  });

  const completedCount = entries.filter((e) => e.status === "COMPLETED").length;
  const ratedEntries = entries.filter((e) => e.rating != null);
  const avgRating = ratedEntries.length
    ? ratedEntries.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedEntries.length
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Profile header */}
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt={user.username} width={80} height={80} className="object-cover" />
          ) : (
            user.username[0].toUpperCase()
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-900">{user.displayName ?? user.username}</h1>
          <p className="text-zinc-500">@{user.username}</p>
          {user.bio && <p className="text-sm text-zinc-700 mt-1">{user.bio}</p>}
          <div className="flex gap-4 mt-2 text-sm text-zinc-500">
            <span><strong className="text-zinc-900">{entries.length}</strong> tracked</span>
            <span><strong className="text-zinc-900">{completedCount}</strong> completed</span>
            {avgRating && <span>Avg <strong className="text-zinc-900">{avgRating.toFixed(1)}</strong> ★</span>}
          </div>
        </div>
      </div>

      {/* Media by type */}
      <Tabs defaultValue="all">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
          {MEDIA_TYPES.map((type) => {
            const count = entries.filter((e) => e.mediaItem.type === type).length;
            if (count === 0) return null;
            return (
              <TabsTrigger key={type} value={type}>
                {MEDIA_TYPE_ICONS[type]} {MEDIA_TYPE_LABELS[type]} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {["all", ...MEDIA_TYPES].map((type) => {
          const filtered = type === "all"
            ? entries
            : entries.filter((e) => e.mediaItem.type === type);
          return (
            <TabsContent key={type} value={type}>
              {filtered.length === 0 ? (
                <p className="text-zinc-400 py-8 text-center">Nothing here yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {filtered.map((entry) => (
                    <MediaCard
                      key={entry.id}
                      id={entry.mediaItem.id}
                      title={entry.mediaItem.title}
                      year={entry.mediaItem.year}
                      posterUrl={entry.mediaItem.posterUrl}
                      mediaType={entry.mediaItem.type}
                      status={entry.status ?? undefined}
                      rating={entry.rating}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
