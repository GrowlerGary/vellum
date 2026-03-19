'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MediaEntry, MediaItem, ListeningProgress } from '@prisma/client'
import { RatingWidget } from '@/components/media/RatingWidget'
import { StatusBadge } from '@/components/media/StatusBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS, STATUS_LABELS } from '@/lib/utils'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { SimilarItemsSection } from '@/components/media/SimilarItemsSection'
import { FixMatchSection } from '@/components/media/FixMatchSection'
import { ShelfmarkSection } from '@/components/media/ShelfmarkSection'
import { MediaDetails } from '@/components/media/MediaDetails'
import { ExternalRating } from '@/components/media/ExternalRating'

type EntryWithRelations = MediaEntry & {
  mediaItem: MediaItem
  listeningProgress: ListeningProgress | null
}

export default function ItemDetailClient({ entry, shelfmarkEnabled = false }: { entry: EntryWithRelations; shelfmarkEnabled?: boolean }) {
  const router = useRouter()
  const [status, setStatus] = useState<string | null>(entry.status)
  const [rating, setRating] = useState<number | null>(entry.rating)
  const [reviewText, setReviewText] = useState(entry.reviewText || '')
  const [deleteStage, setDeleteStage] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const item = entry.mediaItem

  const handleStatusChange = async (newStatus: string) => {
    const nextStatus = status === newStatus ? null : newStatus
    setStatus(nextStatus)
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
  }

  const handleRatingChange = async (newRating: number | null) => {
    setRating(newRating)
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: newRating }),
    })
  }

  const handleReviewBlur = async () => {
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewText }),
    })
  }

  const handleDelete = async () => {
    setDeleteStage('deleting')
    setDeleteError(null)
    try {
      const res = await fetch(`/api/media-items/${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setDeleteStage('idle')
        setDeleteError('Failed to delete item. Please try again.')
      }
    } catch {
      setDeleteStage('idle')
      setDeleteError('Network error. Please try again.')
    }
  }

  const icon = MEDIA_TYPE_ICONS[item.type] ?? '📦'
  const typeLabel = MEDIA_TYPE_LABELS[item.type] ?? item.type

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
        {item.posterUrl ? (
          <div className="relative w-[180px] h-[270px] flex-shrink-0">
            <Image
              src={item.posterUrl}
              alt={item.title}
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
            <h1 className="text-3xl font-bold text-zinc-900">{item.title}</h1>
            <p className="text-zinc-500 mt-1">
              {typeLabel}
              {item.year ? ` · ${item.year}` : ''}
              {' · '}
              <span className="text-xs uppercase tracking-wide text-zinc-400">{item.source}</span>
            </p>
          </div>

          {item.genres && item.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {item.genres.map((g) => (
                <span key={g} className="px-2 py-1 bg-zinc-100 rounded-md text-xs text-zinc-600">
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {status && <StatusBadge status={status} />}
            <RatingWidget value={rating} onChange={handleRatingChange} size="lg" />
            <ExternalRating
              mediaType={item.type}
              metadata={item.metadata as unknown as Record<string, unknown>}
              size="md"
            />
          </div>

          {/* Status selector buttons */}
          <div className="flex gap-2 flex-wrap">
            {(['WANT', 'IN_PROGRESS', 'COMPLETED', 'DROPPED'] as const).map((s) => (
              <Button
                key={s}
                variant={status === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusChange(s)}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>

          {/* Dates */}
          <div className="text-xs text-zinc-400 space-y-1">
            {entry.startedAt && (
              <p>Started: {new Date(entry.startedAt).toLocaleDateString()}</p>
            )}
            {entry.completedAt && (
              <p>Completed: {new Date(entry.completedAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <MediaDetails
        type={item.type}
        metadata={item.metadata as unknown as Record<string, unknown>}
        year={item.year}
      />

      {/* Overview */}
      {item.overview && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Overview</h2>
          <p className="text-zinc-700 leading-relaxed">{item.overview}</p>
        </section>
      )}

      {/* Listening Progress (audiobooks only) */}
      {entry.listeningProgress && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Listening Progress</h2>
          <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
            <div className="w-full bg-zinc-200 rounded-full h-3">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round(entry.listeningProgress.progress * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-zinc-500">
              <span>{Math.round(entry.listeningProgress.progress * 100)}% complete</span>
              {entry.listeningProgress.currentChapter && (
                <span className="text-right">{entry.listeningProgress.currentChapter}</span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Last synced: {new Date(entry.listeningProgress.lastSyncedAt).toLocaleString()}
            </p>
          </div>
        </section>
      )}

      {/* Review */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Review</h2>
        <Textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          onBlur={handleReviewBlur}
          placeholder="Write your thoughts..."
          className="min-h-[120px]"
        />
      </section>

      {/* Similar Items */}
      <SimilarItemsSection
        mediaItemId={item.id}
        mediaSource={item.source}
        parentMediaType={item.type}
      />

      {/* Find on Shelfmark */}
      <ShelfmarkSection
        title={item.title}
        author={(item.metadata as unknown as Record<string, unknown>)?.author as string | undefined}
        mediaType={item.type}
        shelfmarkEnabled={shelfmarkEnabled}
      />

      {/* Fix Match */}
      <FixMatchSection
        mediaItem={{
          id: item.id,
          type: item.type,
          source: item.source,
          title: item.title,
          year: item.year,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          overview: item.overview ?? '',
          genres: item.genres,
          metadata: item.metadata as Record<string, unknown>,
        }}
        onMatchApplied={() => router.refresh()}
      />

      {/* Danger zone */}
      <section className="pt-4 border-t border-zinc-100">
        {deleteStage === 'idle' && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={() => { setDeleteError(null); setDeleteStage('confirm') }}
          >
            <Trash2 className="h-4 w-4" /> Delete item
          </Button>
        )}

        {(deleteStage === 'confirm' || deleteStage === 'deleting') && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteStage('idle')}
              disabled={deleteStage === 'deleting'}
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleteStage === 'deleting'}
            >
              <Trash2 className="h-4 w-4" />
              {deleteStage === 'deleting'
                ? 'Deleting…'
                : `Delete "${item.title.length > 30 ? item.title.slice(0, 30) + '…' : item.title}"?`}
            </Button>
          </div>
        )}
        {deleteError && (
          <p className="mt-2 text-sm text-red-600">{deleteError}</p>
        )}
      </section>
    </div>
  )
}
