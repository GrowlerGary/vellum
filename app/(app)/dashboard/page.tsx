import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from "@/lib/utils";
import { DashboardClient } from "./DashboardClient";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

const DEFAULT_CATEGORY_ORDER = ["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"];

async function fetchEntries(userId: string) {
  return db.mediaEntry.findMany({
    where: { userId },
    include: { mediaItem: true },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });
}

async function fetchCategoryOrder(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { categoryOrder: true },
  });
  return user?.categoryOrder?.length ? user.categoryOrder : DEFAULT_CATEGORY_ORDER;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [entries, categoryOrder] = await Promise.all([
    fetchEntries(session.user.id),
    fetchCategoryOrder(session.user.id),
  ]);

  const inProgress = entries.filter((e) => e.status === "IN_PROGRESS");
  const wantEntries = entries.filter((e) => e.status === "WANT");
  const recentCompleted = entries
    .filter((e) => e.status === "COMPLETED")
    .slice(0, 12);

  const statsByType = DEFAULT_CATEGORY_ORDER.map((type) => {
    const typeEntries = entries.filter((e) => e.mediaItem.type === type);
    return {
      type,
      label: MEDIA_TYPE_LABELS[type] ?? type,
      icon: MEDIA_TYPE_ICONS[type] ?? "📦",
      total: typeEntries.length,
      completed: typeEntries.filter((e) => e.status === "COMPLETED").length,
      inProgress: typeEntries.filter((e) => e.status === "IN_PROGRESS").length,
      want: typeEntries.filter((e) => e.status === "WANT").length,
    };
  });

  // Serialize for client — strip Prisma internals, convert Dates to strings
  const serialize = (arr: typeof entries) =>
    JSON.parse(JSON.stringify(arr)) as {
      id: string;
      status: string;
      rating: number | null;
      sortOrder: number;
      mediaItem: {
        id: string;
        type: string;
        title: string;
        year: number | null;
        posterUrl: string | null;
      };
    }[];

  return (
    <DashboardClient
      userName={session.user.name}
      inProgress={serialize(inProgress)}
      wantEntries={serialize(wantEntries)}
      recentCompleted={serialize(recentCompleted)}
      statsByType={statsByType}
      categoryOrder={categoryOrder}
      isEmpty={entries.length === 0}
    />
  );
}
