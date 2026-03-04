"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { MediaDetailDialog } from "@/components/media/MediaDetailDialog";
import { STATUS_LABELS } from "@/lib/utils";
import type { HardcoverSeriesResult, HardcoverSeriesBook } from "@/lib/metadata/hardcover";

interface LibraryEntry {
  id: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  isPublic: boolean;
}

interface PageData {
  series: HardcoverSeriesResult;
  libraryMap: Record<string, LibraryEntry | null>;
}

interface Selected {
  externalId: string;
  book: HardcoverSeriesBook;
  entry: LibraryEntry | null;
}

export default function BookSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    params.then((p) => setSeriesId(p.id));
  }, [params]);

  useEffect(() => {
    if (!seriesId) return;
    setLoading(true);
    fetch(`/api/series/books/${seriesId}`)
      .then((r) => r.json() as Promise<PageData & { error?: string }>)
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load series."))
      .finally(() => setLoading(false));
  }, [seriesId]);

  function handleSuccess() {
    setSelected(null);
    if (!seriesId) return;
    // Refresh library map
    fetch(`/api/series/books/${seriesId}`)
      .then((r) => r.json() as Promise<PageData>)
      .then((d) => setData(d))
      .catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="py-10 text-center text-sm text-red-600">{error || "Not found."}</div>;
  }

  const { series, libraryMap } = data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">{series.name}</h1>
      <p className="text-sm text-zinc-500">{series.books.length} book{series.books.length !== 1 ? "s" : ""}</p>

      <div className="flex flex-col gap-3">
        {series.books.map((book) => {
          const externalId = String(book.id);
          const entry = libraryMap[externalId] ?? null;
          return (
            <button
              key={book.id}
              onClick={() => setSelected({ externalId, book, entry })}
              className="flex items-start gap-4 p-3 rounded-xl border border-zinc-200 bg-white hover:border-indigo-200 hover:shadow-sm transition-all text-left"
            >
              <div className="flex-shrink-0 w-14 aspect-[2/3] relative rounded overflow-hidden bg-zinc-100">
                {book.posterUrl ? (
                  <Image src={book.posterUrl} alt={book.title} fill className="object-cover" sizes="56px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-zinc-300">📚</div>
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {book.position != null && (
                      <span className="text-xs text-zinc-400 mr-1">#{book.position}</span>
                    )}
                    <span className="font-medium text-zinc-900">{book.title}</span>
                  </div>
                  {entry && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {STATUS_LABELS[entry.status as keyof typeof STATUS_LABELS] ?? entry.status}
                    </span>
                  )}
                </div>
                {book.authors.length > 0 && (
                  <p className="text-sm text-zinc-500">{book.authors.join(", ")}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  {book.year && <span>{book.year}</span>}
                  {book.hasAudio && <span>· Audiobook available</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <MediaDetailDialog
          key={`HARDCOVER-${selected.externalId}`}
          source="HARDCOVER"
          externalId={selected.externalId}
          type={selected.book.hasAudio ? "AUDIOBOOK" : "BOOK"}
          initialItem={{
            title: selected.book.title,
            year: selected.book.year,
            posterUrl: selected.book.posterUrl,
            genres: [],
            metadata: {},
          }}
          initialEntry={selected.entry ?? undefined}
          open={!!selected}
          onClose={() => setSelected(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
