import Image from "next/image";
import Link from "next/link";
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS, formatYear } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { RatingDisplay } from "./RatingWidget";
import { ExternalRating } from "./ExternalRating";

interface ListeningProgressData {
  progress: number      // 0–1
  currentChapter?: string | null
}

interface MediaCardProps {
  id: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  mediaType: string;
  status?: string;
  rating?: number | null;
  href?: string;
  onClick?: () => void;
  compact?: boolean;
  listeningProgress?: ListeningProgressData | null;
  metadata?: Record<string, unknown> | null;
}

export function MediaCard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: _id,
  title,
  year,
  posterUrl,
  mediaType,
  status,
  rating,
  href,
  onClick,
  compact = false,
  listeningProgress,
  metadata,
}: MediaCardProps) {
  const icon = MEDIA_TYPE_ICONS[mediaType] ?? "📦";
  const typeLabel = MEDIA_TYPE_LABELS[mediaType] ?? mediaType;

  const content = (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] transition-all duration-200 hover:border-[var(--gold-dim)] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--gold-dim),0_12px_32px_rgba(0,0,0,0.5)] ${onClick ? "cursor-pointer" : ""} ${compact ? "" : ""}`}
      onClick={onClick}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-[var(--bg-surface)]">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 200px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-20">
            {icon}
          </div>
        )}

        {/* Gradient vignette on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {status && (
          <div className="absolute bottom-1.5 left-1.5">
            <StatusBadge status={status} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2">
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] font-medium">
          {typeLabel}{year ? ` · ${formatYear(year)}` : ""}
        </p>
        <h3 className="font-display text-sm font-semibold italic leading-snug text-[var(--text)] line-clamp-2">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          {rating != null && <RatingDisplay value={rating} size="sm" />}
          {metadata && <ExternalRating mediaType={mediaType} metadata={metadata} size="sm" />}
        </div>

        {listeningProgress != null && (
          <div className="mt-1.5">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-strong)]">
              <div
                className="h-full rounded-full bg-[var(--gold)] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round(listeningProgress.progress * 100))}%` }}
              />
            </div>
            {listeningProgress.currentChapter && (
              <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]" title={listeningProgress.currentChapter}>
                {listeningProgress.currentChapter}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
