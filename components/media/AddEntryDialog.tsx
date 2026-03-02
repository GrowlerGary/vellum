"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingWidget } from "./RatingWidget";
import { STATUS_LABELS } from "@/lib/utils";

interface SearchResult {
  externalId: string;
  source: string;
  mediaType: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  genres: string[];
  metadata: Record<string, unknown>;
}

interface AddEntryDialogProps {
  item: SearchResult;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddEntryDialog({ item, open, onClose, onSuccess }: AddEntryDialogProps) {
  const [status, setStatus] = useState("WANT");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaItem: {
            externalId: item.externalId,
            source: item.source,
            type: item.mediaType,
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
          startedAt: status === "IN_PROGRESS" || status === "COMPLETED" ? new Date().toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to save entry. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
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
              id="isPublic"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
            />
            <Label htmlFor="isPublic">Show on public profile</Label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
