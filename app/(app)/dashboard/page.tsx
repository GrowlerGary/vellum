import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { MediaCard } from "@/components/media/MediaCard";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const MEDIA_TYPES = ["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"];

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const entries = await db.mediaEntry.findMany({
    where: { userId: session.user.id },
    include: { mediaItem: true },
    orderBy: { updatedAt: "desc" },
  });

  const inProgress = entries.filter((e) => e.status === "IN_PROGRESS");
  const recentCompleted = entries
    .filter((e) => e.status === "COMPLETED")
    .slice(0, 10);

  const statsByType = MEDIA_TYPES.map((type) => {
    const typeEntries = entries.filter((e) => e.mediaItem.type === type);
    return {
      type,
      label: MEDIA_TYPE_LABELS[type],
      icon: MEDIA_TYPE_ICONS[type],
      total: typeEntries.length,
      completed: typeEntries.filter((e) => e.status === "COMPLETED").length,
      inProgress: typeEntries.filter((e) => e.status === "IN_PROGRESS").length,
      want: typeEntries.filter((e) => e.status === "WANT").length,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Welcome back, {session.user.name}
          </h1>
          <p className="text-zinc-500">Here&apos;s what you&apos;ve been up to</p>
        </div>
        <div className="flex gap-2">
          <Link href="/search">
            <Button>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </Link>
          <Link href="/dashboard/suggestions">
            <Button variant="outline">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Suggestions</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statsByType.map((s) => (
          <div key={s.type} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-sm font-medium text-zinc-700">{s.label}</div>
            <div className="text-2xl font-bold text-zinc-900">{s.total}</div>
            <div className="text-xs text-zinc-400 mt-1">
              {s.completed} done · {s.inProgress} in progress
            </div>
          </div>
        ))}
      </div>

      {/* In progress */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Currently consuming</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {inProgress.map((entry) => (
              <MediaCard
                key={entry.id}
                id={entry.mediaItem.id}
                title={entry.mediaItem.title}
                year={entry.mediaItem.year}
                posterUrl={entry.mediaItem.posterUrl}
                mediaType={entry.mediaItem.type}
                status={entry.status}
                rating={entry.rating}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent completed */}
      {recentCompleted.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Recently completed</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {recentCompleted.map((entry) => (
              <MediaCard
                key={entry.id}
                id={entry.mediaItem.id}
                title={entry.mediaItem.title}
                year={entry.mediaItem.year}
                posterUrl={entry.mediaItem.posterUrl}
                mediaType={entry.mediaItem.type}
                status={entry.status}
                rating={entry.rating}
              />
            ))}
          </div>
        </section>
      )}

      {entries.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="text-6xl">🎬</div>
          <h2 className="text-xl font-semibold text-zinc-700">Nothing tracked yet</h2>
          <p className="text-zinc-500 max-w-sm">
            Start by searching for a movie, book, game, or any other media you&apos;ve consumed.
          </p>
          <Link href="/search">
            <Button>
              <Plus className="h-4 w-4" />
              Add your first entry
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
