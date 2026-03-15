interface ExternalRatingProps {
  mediaType: string
  metadata: Record<string, unknown>
  size?: 'sm' | 'md'
}

interface RatingConfig {
  icon: string
  alt: string
  value: number
  display: string
}

function getRatingConfig(mediaType: string, metadata: Record<string, unknown>): RatingConfig | null {
  switch (mediaType) {
    case 'MOVIE':
    case 'TV_SHOW': {
      const rtScore = metadata.rottenTomatoesScore as number | undefined
      if (rtScore != null) {
        return {
          icon: '/icons/rotten-tomatoes.svg',
          alt: 'Rotten Tomatoes',
          value: rtScore,
          display: `${Math.round(rtScore)}%`,
        }
      }
      // Fallback to TMDB vote average (0-10 scale)
      const voteAvg = metadata.voteAverage as number | undefined
      if (voteAvg != null && voteAvg > 0) {
        return {
          icon: '/icons/tmdb.svg',
          alt: 'TMDB',
          value: voteAvg,
          display: `${voteAvg.toFixed(1)}/10`,
        }
      }
      return null
    }
    case 'VIDEO_GAME': {
      const score = metadata.rating as number | undefined
      if (score == null) return null
      return {
        icon: '/icons/igdb.svg',
        alt: 'IGDB',
        value: score,
        display: `${Math.round(score)}/100`,
      }
    }
    case 'AUDIOBOOK': {
      const score = metadata.rating as number | undefined
      if (score == null) return null
      return {
        icon: '/icons/audible.svg',
        alt: 'Audible',
        value: score,
        display: `${score.toFixed(1)}/5`,
      }
    }
    case 'BOOK': {
      const googleScore = metadata.googleBooksRating as number | undefined
      if (googleScore != null) {
        return {
          icon: '/icons/google-books.svg',
          alt: 'Google Books',
          value: googleScore,
          display: `${googleScore.toFixed(1)}/5`,
        }
      }
      // Fallback to Hardcover rating (0-5 scale)
      const hcScore = metadata.hardcoverRating as number | undefined
      if (hcScore != null && hcScore > 0) {
        return {
          icon: '/icons/hardcover.svg',
          alt: 'Hardcover',
          value: hcScore,
          display: `${hcScore.toFixed(1)}/5`,
        }
      }
      return null
    }
    default:
      return null
  }
}

export function ExternalRating({ mediaType, metadata, size = 'sm' }: ExternalRatingProps) {
  const config = getRatingConfig(mediaType, metadata)
  if (!config) return null

  const iconSize = size === 'sm' ? 14 : 20
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm font-medium'

  return (
    <div className="flex items-center gap-1" title={`${config.alt}: ${config.display}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.icon}
        alt={config.alt}
        width={iconSize}
        height={iconSize}
        className="shrink-0"
      />
      <span className={`${textClass} text-zinc-600`}>{config.display}</span>
    </div>
  )
}
