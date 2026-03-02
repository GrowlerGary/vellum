import Image from "next/image";
import Link from "next/link";
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS, formatYear } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { RatingDisplay } from "./RatingWidget";

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
}: MediaCardProps) {
  const icon = MEDIA_TYPE_ICONS[mediaType] ?? "📦";
  const typeLabel = MEDIA_TYPE_LABELS[mediaType] ?? mediaType;

  const content = (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {/* Poster */}
      <div className={`relative bg-zinc-100 ${compact ? "aspect-[2/3]" : "aspect-[2/3]"} overflow-hidden`}>
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 200px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-zinc-300">
            {icon}
          </div>
        )}
        {status && (
          <div className="absolute bottom-1 left-1">
            <StatusBadge status={status} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-2">
        <p className="text-xs text-zinc-500">
          {icon} {typeLabel} {year ? `· ${formatYear(year)}` : ""}
        </p>
        <h3 className="text-sm font-semibold leading-tight text-zinc-900 line-clamp-2">{title}</h3>
        {rating != null && (
          <RatingDisplay value={rating} size="sm" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
