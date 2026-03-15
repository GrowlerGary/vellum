interface ExternalRatingProps {
  mediaType: string
  metadata: Record<string, unknown>
  size?: 'sm' | 'md'
}

interface RatingConfig {
  provider: 'rt' | 'tmdb' | 'igdb' | 'audible' | 'google-books' | 'hardcover'
  alt: string
  display: string
}

/* ---------- Inline SVG icons (avoids file-serving issues in standalone/Docker) ---------- */

function RottenTomatoesIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <circle cx="12" cy="13" r="10" fill="#FA320A"/>
      <path d="M10 4C10 4 8 2 10 1C12 0 13 2 12 3C14 2 15 4 13 5C11 4 10 4 10 4Z" fill="#00B528"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">RT</text>
    </svg>
  )
}

function TmdbIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <rect width="24" height="24" rx="4" fill="#0D253F"/>
      <rect x="3" y="8" width="7" height="8" rx="1.5" fill="#01B4E4"/>
      <rect x="12" y="8" width="9" height="8" rx="1.5" fill="#90CEA1"/>
    </svg>
  )
}

function IgdbIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <rect width="24" height="24" rx="4" fill="#9147FF"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">IGDB</text>
    </svg>
  )
}

function AudibleIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <rect width="24" height="24" rx="4" fill="#F8991D"/>
      <path d="M6 16C6 16 9 10 12 10C15 10 18 16 18 16" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M8 14.5C8 14.5 10 11 12 11C14 11 16 14.5 16 14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M10 13C10 13 11 11.5 12 11.5C13 11.5 14 13 14 13" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function GoogleBooksIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <rect x="4" y="2" width="16" height="20" rx="2" fill="#4285F4"/>
      <rect x="6" y="4" width="12" height="16" rx="1" fill="white"/>
      <rect x="8" y="7" width="8" height="1.5" rx="0.5" fill="#EA4335"/>
      <rect x="8" y="10" width="8" height="1.5" rx="0.5" fill="#FBBC05"/>
      <rect x="8" y="13" width="5" height="1.5" rx="0.5" fill="#34A853"/>
    </svg>
  )
}

function HardcoverIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <rect width="24" height="24" rx="4" fill="#6366F1"/>
      <path d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a1 1 0 01-1-1V5a1 1 0 011-1z" fill="white" fillOpacity="0.9"/>
      <path d="M8 4v16" stroke="#6366F1" strokeWidth="1.5"/>
      <rect x="10" y="7" width="6" height="1.5" rx="0.5" fill="#6366F1" fillOpacity="0.5"/>
      <rect x="10" y="10" width="4" height="1.5" rx="0.5" fill="#6366F1" fillOpacity="0.3"/>
    </svg>
  )
}

const ICON_COMPONENTS = {
  'rt': RottenTomatoesIcon,
  'tmdb': TmdbIcon,
  'igdb': IgdbIcon,
  'audible': AudibleIcon,
  'google-books': GoogleBooksIcon,
  'hardcover': HardcoverIcon,
} as const

/* ---------- Rating resolution ---------- */

function getRatingConfig(mediaType: string, metadata: Record<string, unknown>): RatingConfig | null {
  switch (mediaType) {
    case 'MOVIE':
    case 'TV_SHOW': {
      const rtScore = metadata.rottenTomatoesScore as number | undefined
      if (rtScore != null) {
        return { provider: 'rt', alt: 'Rotten Tomatoes', display: `${Math.round(rtScore)}%` }
      }
      const voteAvg = metadata.voteAverage as number | undefined
      if (voteAvg != null && voteAvg > 0) {
        return { provider: 'tmdb', alt: 'TMDB', display: `${voteAvg.toFixed(1)}/10` }
      }
      return null
    }
    case 'VIDEO_GAME': {
      const score = metadata.rating as number | undefined
      if (score == null) return null
      return { provider: 'igdb', alt: 'IGDB', display: `${Math.round(score)}/100` }
    }
    case 'AUDIOBOOK': {
      const score = metadata.rating as number | undefined
      if (score == null) return null
      return { provider: 'audible', alt: 'Audible', display: `${score.toFixed(1)}/5` }
    }
    case 'BOOK': {
      const googleScore = metadata.googleBooksRating as number | undefined
      if (googleScore != null) {
        return { provider: 'google-books', alt: 'Google Books', display: `${googleScore.toFixed(1)}/5` }
      }
      const hcScore = metadata.hardcoverRating as number | undefined
      if (hcScore != null && hcScore > 0) {
        return { provider: 'hardcover', alt: 'Hardcover', display: `${hcScore.toFixed(1)}/5` }
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
  const IconComponent = ICON_COMPONENTS[config.provider]

  return (
    <div className="flex items-center gap-1" title={`${config.alt}: ${config.display}`}>
      <IconComponent size={iconSize} />
      <span className={`${textClass} text-zinc-600`}>{config.display}</span>
    </div>
  )
}
