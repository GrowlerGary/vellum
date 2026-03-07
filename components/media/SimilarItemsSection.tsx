'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS } from '@/lib/utils'

interface SimilarItem {
  externalId: string
  source: string
  mediaType: string
  title: string
  year: number | null
  posterUrl: string | null
  overview: string
  genres: string[]
}

interface SimilarItemsResult {
  items: SimilarItem[]
  source: 'cache' | 'fresh' | 'none'
}

interface SimilarItemsSectionProps {
  mediaItemId: string
  mediaSource: string
}

function SimilarCard({ item }: { item: SimilarItem }) {
  const icon = MEDIA_TYPE_ICONS[item.mediaType] ?? '📦'
  const typeLabel = MEDIA_TYPE_LABELS[item.mediaType] ?? item.mediaType

  return (
    <div className="flex-shrink-0 w-[120px] flex flex-col gap-1">
      <div className="relative w-[120px] h-[180px] rounded-lg overflow-hidden bg-zinc-100">
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="120px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-zinc-300">
            {icon}
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-400">{icon} {typeLabel}{item.year ? ` · ${item.year}` : ''}</p>
      <p className="text-xs font-medium text-zinc-800 leading-tight line-clamp-2">{item.title}</p>
    </div>
  )
}

export function SimilarItemsSection({ mediaItemId, mediaSource }: SimilarItemsSectionProps) {
  const [result, setResult] = useState<SimilarItemsResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/media-items/${mediaItemId}/similar`)
      .then((r) => r.json())
      .then((data: SimilarItemsResult) => {
        setResult(data)
      })
      .catch(() => setResult({ items: [], source: 'none' }))
      .finally(() => setLoading(false))
  }, [mediaItemId])

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Similar Items</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[120px]">
              <div className="w-[120px] h-[180px] rounded-lg bg-zinc-100 animate-pulse" />
              <div className="mt-1 h-3 w-16 bg-zinc-100 rounded animate-pulse" />
              <div className="mt-1 h-3 w-full bg-zinc-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (!result || result.items.length === 0) {
    const isManual = mediaSource === 'MANUAL' || mediaSource === 'AUDIOBOOKSHELF'
    return (
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Similar Items</h2>
        {isManual ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
            No similar items found. Try using{' '}
            <span className="font-medium text-zinc-700">Fix Match</span> below to link this item
            to an external source so we can find recommendations.
          </div>
        ) : (
          <p className="text-zinc-400 text-sm">No similar items found for this title.</p>
        )}
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-zinc-900">Similar Items</h2>
        {result.source === 'cache' && (
          <span className="text-xs text-zinc-400">Cached</span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {result.items.map((item) => (
          <SimilarCard key={`${item.source}-${item.externalId}`} item={item} />
        ))}
      </div>
    </section>
  )
}
