"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MediaCard } from "@/components/media/MediaCard";
import { EntryDetailDialog, type EntryWithMedia } from "@/components/media/EntryDetailDialog";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/utils";

const STATUS_ORDER = ["IN_PROGRESS", "WANT", "COMPLETED", "DROPPED"] as const;

interface LibraryClientProps {
  entries: EntryWithMedia[];
}

export function LibraryClient({ entries }: LibraryClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<EntryWithMedia | null>(null);

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
                    onClick={() => setSelected(entry)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <EntryDetailDialog
          key={selected.id}
          entry={selected}
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
