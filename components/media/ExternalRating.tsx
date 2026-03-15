import Image from 'next/image'

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
      const score = metadata.rottenTomatoesScore as number | undefined
      if (score == null) return null
      return {
        icon: '/icons/rotten-tomatoes.svg',
        alt: 'Rotten Tomatoes',
        value: score,
        display: `${Math.round(score)}%`,
      }
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
      const score = metadata.googleBooksRating as number | undefined
      if (score == null) return null
      return {
        icon: '/icons/google-books.svg',
        alt: 'Google Books',
        value: score,
        display: `${score.toFixed(1)}/5`,
      }
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
      <Image
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
