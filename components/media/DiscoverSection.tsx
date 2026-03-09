'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { MediaCard } from '@/components/media/MediaCard'
import { StackedCards } from '@/components/media/StackedCards'
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS } from '@/lib/utils'
import type { DiscoverItem } from '@/lib/discover'

const ALL_TYPES = ['MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME'] as const

interface TypeResults {
  items: DiscoverItem[]
  loading: boolean
}

interface DiscoverTypeSectionProps {
  mediaType: string
  items: DiscoverItem[]
  isExpanded: boolean
  onToggle: () => void
}

/** A single collapsible section for one media type's discover results */
function DiscoverTypeSection({ mediaType, items, isExpanded, onToggle }: DiscoverTypeSectionProps) {
  const [openingId, setOpeningId] = useState<string | null>(null)
  const router = useRouter()
  const icon = MEDIA_TYPE_ICONS[mediaType] ?? '📦'
  const label = MEDIA_TYPE_LABELS[mediaType] ?? mediaType

  const openItem = async (item: DiscoverItem) => {
    if (openingId) return // prevent double-click
    setOpeningId(item.externalId)
    try {
      const res = await fetch('/api/entries/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: item.source,
          externalId: item.externalId,
          mediaType: item.mediaType,
          title: item.title,
          year: item.year,
          posterUrl: item.posterUrl,
          overview: item.overview,
          genres: item.genres,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { itemId: string; entryId: string | null }
        router.push(data.entryId ? `/item/${data.entryId}` : `/media/${data.itemId}`)
      }
    } finally {
      setOpeningId(null)
    }
  }

  const cards = items.map((item) => (
    <div
      key={`${item.source}-${item.externalId}`}
      className={`relative ${openingId === item.externalId ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* Frequency badge — shows how many seeding items recommended this */}
      {item.frequency > 1 && (
        <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          <Sparkles className="h-2.5 w-2.5" />
          {item.frequency}×
        </div>
      )}
      <MediaCard
        id={item.externalId}
        title={item.title}
        year={item.year}
        posterUrl={item.posterUrl}
        mediaType={mediaType}
        onClick={() => openItem(item)}
      />
    </div>
  ))

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-zinc-50 rounded-lg px-2 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-zinc-800">{label}</span>
        <span className="text-sm text-zinc-400 ml-1">({items.length})</span>
        <span className="ml-auto text-zinc-400">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      <div className="mt-2">
        {isExpanded ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {cards}
          </div>
        ) : (
          <StackedCards maxVisible={2}>{cards}</StackedCards>
        )}
      </div>
    </div>
  )
}

/** Full discover section — fetches recommendations per type on mount */
export function DiscoverSection() {
  const [results, setResults] = useState<Record<string, TypeResults>>(() =>
    Object.fromEntries(ALL_TYPES.map((t) => [t, { items: [], loading: true }]))
  )

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

  const toggleExpanded = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  useEffect(() => {
    for (const type of ALL_TYPES) {
      fetch(`/api/discover?type=${type}`)
        .then((r) => r.json())
        .then((data: { recommendations?: DiscoverItem[]; error?: string }) => {
          setResults((prev) => ({
            ...prev,
            [type]: { items: data.recommendations ?? [], loading: false },
          }))
        })
        .catch(() => {
          setResults((prev) => ({
            ...prev,
            [type]: { items: [], loading: false },
          }))
        })
    }
  }, [])

  const typesWithResults = ALL_TYPES.filter((t) => results[t].items.length > 0)
  const anyLoading = ALL_TYPES.some((t) => results[t].loading)
  const allDone = !anyLoading

  // Don't render at all if everything loaded and nothing to show
  if (allDone && typesWithResults.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-zinc-900">Discover</h2>
        <span className="text-sm text-zinc-400">
          Based on your ratings
        </span>
      </div>

      {anyLoading && typesWithResults.length === 0 ? (
        /* Skeleton while first results load */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-zinc-100 bg-zinc-50 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {typesWithResults.map((type) => (
            <div
              key={type}
              className={expandedTypes.has(type) ? 'md:col-span-2' : ''}
            >
              <DiscoverTypeSection
                mediaType={type}
                items={results[type].items}
                isExpanded={expandedTypes.has(type)}
                onToggle={() => toggleExpanded(type)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
