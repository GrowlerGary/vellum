'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MediaItem } from '@prisma/client'
import { RatingWidget } from '@/components/media/RatingWidget'
import { Button } from '@/components/ui/button'
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS, STATUS_LABELS } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { SimilarItemsSection } from '@/components/media/SimilarItemsSection'
import { ShelfmarkSection } from '@/components/media/ShelfmarkSection'
import { MediaDetails } from '@/components/media/MediaDetails'
import { ExternalRating } from '@/components/media/ExternalRating'

export default function MediaPreviewClient({ mediaItem, shelfmarkEnabled = false }: { mediaItem: MediaItem; shelfmarkEnabled?: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const icon = MEDIA_TYPE_ICONS[mediaItem.type] ?? '📦'
  const typeLabel = MEDIA_TYPE_LABELS[mediaItem.type] ?? mediaItem.type

  const addToLibrary = async (status: string, rating?: number) => {
    if (adding) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaItem: {
            externalId: mediaItem.externalId,
            source: mediaItem.source,
            type: mediaItem.type,
            title: mediaItem.title,
            year: mediaItem.year,
            posterUrl: mediaItem.posterUrl,
            overview: mediaItem.overview,
            genres: mediaItem.genres,
          },
          status,
          rating: rating ?? null,
        }),
      })
      if (res.ok) {
        const entry = await res.json() as { id: string }
        router.push(`/item/${entry.id}`)
      } else {
        setError('Failed to add to library. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleRating = (rating: number | null) => {
    if (rating != null) addToLibrary('COMPLETED', rating)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Header: poster + metadata */}
      <div className="flex flex-col sm:flex-row gap-6">
        {mediaItem.posterUrl ? (
          <div className="relative w-[180px] h-[270px] flex-shrink-0">
            <Image
              src={mediaItem.posterUrl}
              alt={mediaItem.title}
              fill
              className="rounded-xl shadow-md object-cover"
              sizes="180px"
            />
          </div>
        ) : (
          <div className="w-[180px] h-[270px] flex-shrink-0 bg-zinc-100 rounded-xl flex items-center justify-center text-5xl">
            {icon}
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{mediaItem.title}</h1>
            <p className="text-zinc-500 mt-1">
              {typeLabel}
              {mediaItem.year ? ` · ${mediaItem.year}` : ''}
              {' · '}
              <span className="text-xs uppercase tracking-wide text-zinc-400">{mediaItem.source}</span>
            </p>
          </div>

          <ExternalRating
            mediaType={mediaItem.type}
            metadata={mediaItem.metadata as unknown as Record<string, unknown>}
            size="md"
          />

          {mediaItem.genres && mediaItem.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {mediaItem.genres.map((g) => (
                <span key={g} className="px-2 py-1 bg-zinc-100 rounded-md text-xs text-zinc-600">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Add to library section */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-zinc-600">Add to my library</p>
            <div className="flex gap-2 flex-wrap">
              {(['WANT', 'IN_PROGRESS', 'COMPLETED', 'DROPPED'] as const).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={adding}
                  onClick={() => addToLibrary(s)}
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">Or rate it (adds as Completed):</span>
              <RatingWidget value={null} onChange={handleRating} size="lg" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      {/* Details */}
      <MediaDetails
        type={mediaItem.type}
        metadata={mediaItem.metadata as unknown as Record<string, unknown>}
        year={mediaItem.year}
      />

      {/* Overview */}
      {mediaItem.overview && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Overview</h2>
          <p className="text-zinc-700 leading-relaxed">{mediaItem.overview}</p>
        </section>
      )}

      {/* Find on Shelfmark */}
      <ShelfmarkSection
        title={mediaItem.title}
        author={(mediaItem.metadata as unknown as Record<string, unknown>)?.author as string | undefined}
        mediaType={mediaItem.type}
        shelfmarkEnabled={shelfmarkEnabled}
      />

      {/* Similar Items */}
      <SimilarItemsSection
        mediaItemId={mediaItem.id}
        mediaSource={mediaItem.source}
        parentMediaType={mediaItem.type}
      />
    </div>
  )
}
