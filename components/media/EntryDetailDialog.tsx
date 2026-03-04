"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingWidget } from "./RatingWidget";
import { STATUS_LABELS, MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from "@/lib/utils";

export interface EntryWithMedia {
  id: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  isPublic: boolean;
  mediaItem: {
    id: string;
    title: string;
    year: number | null;
    posterUrl: string | null;
    overview: string;
    genres: string[];
    type: string;
  };
}

interface EntryDetailDialogProps {
  entry: EntryWithMedia;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EntryDetailDialog({ entry, open, onClose, onSuccess }: EntryDetailDialogProps) {
  const [status, setStatus] = useState(entry.status);
  const [rating, setRating] = useState<number | null>(entry.rating);
  const [review, setReview] = useState(entry.reviewText ?? "");
  const [isPublic, setIsPublic] = useState(entry.isPublic);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rating,
          reviewText: review || null,
          isPublic,
          completedAt: status === "COMPLETED" ? new Date().toISOString() : null,
          startedAt: status === "IN_PROGRESS" || status === "COMPLETED" ? new Date().toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to remove entry. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const { mediaItem: item } = entry;
  const icon = MEDIA_TYPE_ICONS[item.type] ?? "📦";
  const typeLabel = MEDIA_TYPE_LABELS[item.type] ?? item.type;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 sm:flex-row mt-2">
          {/* Metadata column */}
          <div className="flex-shrink-0 w-full sm:w-36 flex flex-col gap-2">
            <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-zinc-100">
              {item.posterUrl ? (
                <Image src={item.posterUrl} alt={item.title} fill className="object-cover" sizes="144px" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl text-zinc-300">{icon}</div>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {typeLabel}{item.year ? ` · ${item.year}` : ""}
            </p>
            {item.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.genres.slice(0, 4).map((g) => (
                  <span key={g} className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Form column */}
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
                    <SelectItem key={k} value={k}>{v}</SelectItem>
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
                id="editIsPublic"
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
              />
              <Label htmlFor="editIsPublic">Show on public profile</Label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between gap-2">
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                Remove from Library
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
