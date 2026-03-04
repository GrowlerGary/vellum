"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaDetailDialog } from "@/components/media/MediaDetailDialog";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/utils";

const STATUS_ORDER = ["IN_PROGRESS", "WANT", "COMPLETED", "DROPPED"] as const;

interface MediaItemRef {
  id: string;
  externalId: string;
  source: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  type: string;
}

interface LibraryEntry {
  id: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  isPublic: boolean;
  mediaItem: MediaItemRef;
}

interface LibraryClientProps {
  entries: LibraryEntry[];
}

interface Selected {
  source: string;
  externalId: string;
  type: string;
  initialItem: { title: string; year: number | null; posterUrl: string | null; overview: string | null; genres: string[] };
  initialEntry: { id: string; status: string; rating: number | null; reviewText: string | null; isPublic: boolean };
}

export function LibraryClient({ entries }: LibraryClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Selected | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-zinc-500">Nothing tracked here yet.</p>
        <Link href="/search">
          <Button><Plus className="h-4 w-4 mr-1" />Add something</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-10">
        {STATUS_ORDER.map((status) => {
          const statusEntries = entries.filter((e) => e.status === status);
          if (!statusEntries.length) return null;
          return (
            <section key={status}>
              <h2 className="text-lg font-semibold text-zinc-900 mb-3">
                {STATUS_LABELS[status]}
                <span className="ml-2 text-sm font-normal text-zinc-400">{statusEntries.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {statusEntries.map((entry) => (
                  <MediaCard
                    key={entry.id}
                    id={entry.mediaItem.id}
                    title={entry.mediaItem.title}
                    year={entry.mediaItem.year}
                    posterUrl={entry.mediaItem.posterUrl}
                    mediaType={entry.mediaItem.type}
                    status={entry.status}
                    rating={entry.rating}
                    onClick={() =>
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
                        },
                        initialEntry: {
                          id: entry.id,
                          status: entry.status,
                          rating: entry.rating,
                          reviewText: entry.reviewText,
                          isPublic: entry.isPublic,
                        },
                      })
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

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
