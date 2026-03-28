import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatYear(year: number | null | undefined): string {
  return year ? String(year) : "Unknown";
}

export function formatRating(rating: number | null | undefined): string {
  if (!rating) return "Not rated";
  return `${rating.toFixed(1)} / 5`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  MOVIE: "Movie",
  TV_SHOW: "TV Show",
  BOOK: "Book",
  AUDIOBOOK: "Audiobook",
  VIDEO_GAME: "Video Game",
};

export const STATUS_LABELS: Record<string, string> = {
  WANT: "Want to Consume",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
};

export const STATUS_COLORS: Record<string, string> = {
  WANT: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  DROPPED: "bg-red-100 text-red-800",
};

export const MEDIA_TYPE_ICONS: Record<string, string> = {
  MOVIE: "🎬",
  TV_SHOW: "📺",
  BOOK: "📚",
  AUDIOBOOK: "🎧",
  VIDEO_GAME: "🎮",
};
