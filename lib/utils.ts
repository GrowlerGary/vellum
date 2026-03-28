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
  WANT:        "bg-[#1a2c3a] text-[#7ab0cc] border border-[#254455]",
  IN_PROGRESS: "bg-[#2c2410] text-[#c8a344] border border-[#4a3a18]",
  COMPLETED:   "bg-[#142318] text-[#68aa6e] border border-[#224030]",
  DROPPED:     "bg-[#2a1414] text-[#cc6e6e] border border-[#4a2020]",
};

export const MEDIA_TYPE_ICONS: Record<string, string> = {
  MOVIE: "🎬",
  TV_SHOW: "📺",
  BOOK: "📚",
  AUDIOBOOK: "🎧",
  VIDEO_GAME: "🎮",
};
