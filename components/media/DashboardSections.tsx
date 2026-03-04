"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaDetailDialog } from "@/components/media/MediaDetailDialog";

interface DashboardEntry {
  id: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  isPublic: boolean;
  mediaItem: {
    id: string;
    externalId: string;
    source: string;
    title: string;
    year: number | null;
    posterUrl: string | null;
    overview: string | null;
    genres: string[];
    type: string;
    metadata: Record<string, unknown>;
  };
}

interface Selected {
  source: string;
  externalId: string;
  type: string;
  initialItem: { title: string; year: number | null; posterUrl: string | null; overview: string | null; genres: string[]; metadata: Record<string, unknown> };
  initialEntry: { id: string; status: string; rating: number | null; reviewText: string | null; isPublic: boolean };
}

interface DashboardSectionsProps {
  inProgress: DashboardEntry[];
  recentCompleted: DashboardEntry[];
}

export function DashboardSections({ inProgress, recentCompleted }: DashboardSectionsProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Selected | null>(null);

  function select(entry: DashboardEntry) {
    setSelected({
      source: entry.mediaItem.source,
      externalId: entry.mediaItem.externalId,
      type: entry.mediaItem.type,
      initialItem: {
        title: entry.mediaItem.title,
        year: entry.mediaItem.year,
        posterUrl: entry.mediaItem.posterUrl,
        overview: entry.mediaItem.overview,
        genres: entry.mediaItem.genres,
        metadata: entry.mediaItem.metadata,
      },
      initialEntry: {
        id: entry.id,
        status: entry.status,
        rating: entry.rating,
        reviewText: entry.reviewText,
        isPublic: entry.isPublic,
      },
    });
  }

  function renderGrid(entries: DashboardEntry[]) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map((entry) => (
          <MediaCard
            key={entry.id}
            id={entry.mediaItem.id}
            title={entry.mediaItem.title}
            year={entry.mediaItem.year}
            posterUrl={entry.mediaItem.posterUrl}
            mediaType={entry.mediaItem.type}
            status={entry.status}
            rating={entry.rating}
            onClick={() => select(entry)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {inProgress.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Currently consuming</h2>
          {renderGrid(inProgress)}
        </section>
      )}

      {recentCompleted.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Recently completed</h2>
          {renderGrid(recentCompleted)}
        </section>
      )}

      {selected && (
        <MediaDetailDialog
          key={`${selected.source}-${selected.externalId}`}
          source={selected.source}
          externalId={selected.externalId}
          type={selected.type}
          initialItem={selected.initialItem}
          initialEntry={selected.initialEntry}
          open={!!selected}
          onClose={() => setSelected(null)}
          onSuccess={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
