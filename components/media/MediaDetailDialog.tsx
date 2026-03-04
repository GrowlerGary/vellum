"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { RatingWidget } from "./RatingWidget";
import { STATUS_LABELS, MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from "@/lib/utils";

interface DetailItem {
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  genres: string[];
  type: string;
  source: string;
  externalId: string;
  metadata: Record<string, unknown>;
}

interface DetailEntry {
  id: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  isPublic: boolean;
}

export interface InitialItem {
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl?: string | null;
  overview?: string | null;
  genres: string[];
  metadata?: Record<string, unknown>;
}

export interface InitialEntry {
  id: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  isPublic: boolean;
}

export interface MediaDetailDialogProps {
  source: string;
  externalId: string;
  type: string;
  /** Pre-filled display data shown immediately; enriched by the detail fetch */
  initialItem?: InitialItem;
  /** Pre-filled entry data (pass for library items where we already know the entry) */
  initialEntry?: InitialEntry;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MediaDetailDialog({
  source,
  externalId,
  type,
  initialItem,
  initialEntry,
  open,
  onClose,
  onSuccess,
}: MediaDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [item, setItem] = useState<DetailItem | null>(null);
  const [entry, setEntry] = useState<DetailEntry | null>(null);

  const [status, setStatus] = useState("WANT");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!open) return;

    setSaveError("");
    setFetchError("");

    // Show initial data immediately (no spinner) if we have it; otherwise show spinner
    if (initialItem) {
      setItem({
        title: initialItem.title,
        year: initialItem.year,
        posterUrl: initialItem.posterUrl,
        backdropUrl: initialItem.backdropUrl ?? null,
        overview: initialItem.overview ?? "",
        genres: initialItem.genres,
        type,
        source,
        externalId,
        metadata: initialItem.metadata ?? {},
      });
      setLoading(false);
    } else {
      setItem(null);
      setLoading(true);
    }

    // Apply initial entry state
    if (initialEntry) {
      setEntry(initialEntry);
      setStatus(initialEntry.status);
      setRating(initialEntry.rating);
      setReview(initialEntry.reviewText ?? "");
      setIsPublic(initialEntry.isPublic);
    } else {
      setEntry(null);
      setStatus("WANT");
      setRating(null);
      setReview("");
      setIsPublic(true);
    }

    // Fetch rich metadata in background to enrich the display
    fetch(
      `/api/detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(externalId)}&type=${encodeURIComponent(type)}`
    )
      .then((r) => r.json() as Promise<{ item?: DetailItem; entry?: DetailEntry; error?: string }>)
      .then((data) => {
        if (data.error) {
          // Only show error if we have no fallback data
          if (!initialItem) setFetchError("Failed to load details. Please try again.");
          return;
        }
        if (data.item) {
          // Ensure arrays are always arrays even if API returns unexpected shapes
          const safeItem = {
            ...data.item,
            genres: Array.isArray(data.item.genres) ? data.item.genres : [],
            metadata: data.item.metadata && typeof data.item.metadata === "object"
              ? data.item.metadata
              : {},
          };
          setItem(safeItem);
        }
        // Only update entry from fetch if we didn't get one from props
        if (!initialEntry) {
          if (data.entry) {
            setEntry(data.entry);
            setStatus(data.entry.status);
            setRating(data.entry.rating);
            setReview(data.entry.reviewText ?? "");
            setIsPublic(data.entry.isPublic);
          }
        }
      })
      .catch(() => {
        if (!initialItem) setFetchError("Failed to load details. Please try again.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, externalId, type]);

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    setSaveError("");
    try {
      if (entry) {
        const res = await fetch(`/api/entries/${entry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            rating,
            reviewText: review || null,
            isPublic,
            completedAt: status === "COMPLETED" ? new Date().toISOString() : null,
            startedAt:
              status === "IN_PROGRESS" || status === "COMPLETED"
                ? new Date().toISOString()
                : null,
          }),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaItem: {
              externalId: item.externalId,
              source: item.source,
              type: item.type,
              title: item.title,
              year: item.year,
              posterUrl: item.posterUrl,
              backdropUrl: item.backdropUrl,
              overview: item.overview,
              genres: item.genres,
              metadata: item.metadata,
            },
            status,
            rating,
            reviewText: review || null,
            isPublic,
            completedAt: status === "COMPLETED" ? new Date().toISOString() : null,
            startedAt:
              status === "IN_PROGRESS" || status === "COMPLETED"
                ? new Date().toISOString()
                : null,
          }),
        });
        if (!res.ok) throw new Error();
      }
      onSuccess?.();
      onClose();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onSuccess?.();
      onClose();
    } catch {
      setSaveError("Failed to remove entry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function renderMetadata(i: DetailItem) {
    const m = i.metadata;
    const rows: Array<{ label: string; value: string }> = [];

    if (i.type === "MOVIE") {
      if (m.voteAverage) rows.push({ label: "Rating", value: `★ ${(m.voteAverage as number).toFixed(1)} / 10` });
      if (m.runtime) rows.push({ label: "Runtime", value: `${m.runtime} min` });
      if (m.status) rows.push({ label: "Status", value: m.status as string });
    } else if (i.type === "TV_SHOW") {
      if (m.voteAverage) rows.push({ label: "Rating", value: `★ ${(m.voteAverage as number).toFixed(1)} / 10` });
      if (m.numberOfSeasons) rows.push({ label: "Seasons", value: String(m.numberOfSeasons) });
      if (m.numberOfEpisodes) rows.push({ label: "Episodes", value: String(m.numberOfEpisodes) });
      if (m.status) rows.push({ label: "Status", value: m.status as string });
    } else if (i.type === "VIDEO_GAME") {
      if (m.rating) rows.push({ label: "Rating", value: `${(m.rating as number).toFixed(0)} / 100` });
      const devs = m.developers as string[] | undefined;
      if (devs?.length) rows.push({ label: "Developer", value: devs.join(", ") });
    } else {
      const authors = m.authors as string[] | undefined;
      if (authors?.length) rows.push({ label: "Author", value: authors.join(", ") });
      const narrators = m.narrators as string[] | undefined;
      if (narrators?.length) rows.push({ label: "Narrator", value: narrators.join(", ") });
      const series = m.series as string[] | undefined;
      if (series?.length) rows.push({ label: "Series", value: series.join(", ") });
      if (m.pages) rows.push({ label: "Pages", value: String(m.pages) });
      if (m.rating) {
        const ratingStr = m.ratingsCount
          ? `★ ${(m.rating as number).toFixed(2)} (${(m.ratingsCount as number).toLocaleString()} ratings)`
          : `★ ${(m.rating as number).toFixed(2)}`;
        rows.push({ label: "Rating", value: ratingStr });
      }
    }

    if (!rows.length) return null;
    return (
      <div className="flex flex-col gap-1 text-xs text-zinc-500">
        {rows.map((r) => (
          <div key={r.label}>
            <span className="text-zinc-400">{r.label}: </span>
            <span className="text-zinc-600">{r.value}</span>
          </div>
        ))}
      </div>
    );
  }

  const icon = MEDIA_TYPE_ICONS[type] ?? "📦";
  const typeLabel = MEDIA_TYPE_LABELS[type] ?? type;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="py-10 text-center text-sm text-red-600">{fetchError}</div>
        )}

        {!loading && !fetchError && item && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{item.title}</DialogTitle>
              {(item.type === "MOVIE" || item.type === "TV_SHOW") &&
                (item.metadata.tagline as string | undefined) && (
                  <p className="text-sm text-zinc-400 italic">{item.metadata.tagline as string}</p>
                )}
            </DialogHeader>

            <div className="flex flex-col gap-6 sm:flex-row mt-2">
              {/* Left: poster + metadata */}
              <div className="flex-shrink-0 w-full sm:w-36 flex flex-col gap-2">
                <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-zinc-100">
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="144px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-zinc-300">
                      {icon}
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {typeLabel}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
                {renderMetadata(item)}
                {item.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.genres.slice(0, 5).map((g) => (
                      <span
                        key={g}
                        className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: overview + form */}
              <div className="flex flex-col gap-4 flex-1 min-w-0">
                {item.overview && (
                  <p className="text-sm text-zinc-600 line-clamp-4">{item.overview}</p>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Rating (optional)</Label>
                  <RatingWidget value={rating} onChange={setRating} size="lg" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Review (optional)</Label>
                  <Textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Your thoughts..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="detailIsPublic"
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                  />
                  <Label htmlFor="detailIsPublic">Show on public profile</Label>
                </div>

                {saveError && <p className="text-sm text-red-600">{saveError}</p>}

                <div className="flex items-center justify-between gap-2">
                  {entry ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      Remove from Library
                    </Button>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : entry ? "Save" : "Add to Library"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
