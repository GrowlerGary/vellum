'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaCard } from '@/components/media/MediaCard'
import { CollapsibleCategory } from '@/components/media/CollapsibleCategory'
import { StackedCards } from '@/components/media/StackedCards'
import { SortableMediaCard } from '@/components/media/SortableMediaCard'
import { SetNextUpButton } from '@/components/media/SetNextUpButton'
import { DiscoverSection } from '@/components/media/DiscoverSection'
import { cn, MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface MediaItemData {
  id: string
  type: string
  title: string
  year: number | null
  posterUrl: string | null
  metadata?: Record<string, unknown> | null
}

interface ListeningProgressData {
  progress: number
  currentChapter: string | null
}

interface EntryData {
  id: string
  status: string
  rating: number | null
  mediaItem: MediaItemData
  sortOrder: number
  listeningProgress: ListeningProgressData | null
}

interface DashboardClientProps {
  userName: string
  inProgress: EntryData[]
  wantEntries: EntryData[]
  recentCompleted: EntryData[]
  categoryOrder: string[]
  isEmpty: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByType(entries: EntryData[]): Record<string, EntryData[]> {
  const groups: Record<string, EntryData[]> = {}
  for (const entry of entries) {
    const type = entry.mediaItem.type
    if (!groups[type]) groups[type] = []
    groups[type].push(entry)
  }
  return groups
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'MOVIE', label: MEDIA_TYPE_LABELS['MOVIE'] },
  { value: 'TV_SHOW', label: MEDIA_TYPE_LABELS['TV_SHOW'] },
  { value: 'BOOK', label: MEDIA_TYPE_LABELS['BOOK'] },
  { value: 'AUDIOBOOK', label: MEDIA_TYPE_LABELS['AUDIOBOOK'] },
  { value: 'VIDEO_GAME', label: MEDIA_TYPE_LABELS['VIDEO_GAME'] },
]

// ── Sortable Want category (drag-and-drop when expanded) ─────────────────────

interface SortableCategoryProps {
  type: string
  initialEntries: EntryData[]
  isExpanded: boolean
  onToggle: () => void
}

function SortableWantCategory({ type, initialEntries, isExpanded, onToggle }: SortableCategoryProps) {
  const [entries, setEntries] = useState<EntryData[]>(initialEntries)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = entries.findIndex((e) => e.id === String(active.id))
      const newIndex = entries.findIndex((e) => e.id === String(over.id))
      const reordered = arrayMove(entries, oldIndex, newIndex)
      setEntries(reordered)

      await fetch('/api/entries/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: reordered.map((e, idx) => ({ id: e.id, sortOrder: idx })),
        }),
      })
    },
    [entries]
  )

  const icon = MEDIA_TYPE_ICONS[type] ?? '📦'
  const label = MEDIA_TYPE_LABELS[type] ?? type

  // Build card nodes — each includes the MediaCard + SetNextUpButton
  const cardNodes = entries.map((entry, idx) => (
    <div key={entry.id} className="flex flex-col gap-1">
      <MediaCard
        id={entry.mediaItem.id}
        title={entry.mediaItem.title}
        year={entry.mediaItem.year}
        posterUrl={entry.mediaItem.posterUrl}
        mediaType={entry.mediaItem.type}
        status={entry.status}
        rating={entry.rating}
        href={`/item/${entry.id}`}
        listeningProgress={entry.listeningProgress}
        metadata={entry.mediaItem.metadata}
      />
      <div className="flex justify-center">
        <SetNextUpButton entryId={entry.id} isNextUp={idx === 0} />
      </div>
    </div>
  ))

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-zinc-50 rounded-lg px-2 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-zinc-800">{label}</span>
        <span className="text-sm text-zinc-400 ml-1">({entries.length})</span>
        {isExpanded && (
          <span className="ml-2 text-xs text-zinc-400 italic">drag to reorder</span>
        )}
        <span className="ml-auto text-zinc-400">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Content */}
      <div className="mt-2">
        {isExpanded ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={entries.map((e) => e.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {entries.map((entry, idx) => (
                  <SortableMediaCard key={entry.id} id={entry.id}>
                    <div className="flex flex-col gap-1">
                      <MediaCard
                        id={entry.mediaItem.id}
                        title={entry.mediaItem.title}
                        year={entry.mediaItem.year}
                        posterUrl={entry.mediaItem.posterUrl}
                        mediaType={entry.mediaItem.type}
                        status={entry.status}
                        rating={entry.rating}
                        href={`/item/${entry.id}`}
                        listeningProgress={entry.listeningProgress}
                        metadata={entry.mediaItem.metadata}
                      />
                      <div className="flex justify-center">
                        <SetNextUpButton entryId={entry.id} isNextUp={idx === 0} />
                      </div>
                    </div>
                  </SortableMediaCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <StackedCards maxVisible={2}>{cardNodes}</StackedCards>
        )}
      </div>
    </div>
  )
}

// ── Dashboard section ────────────────────────────────────────────────────────

interface SectionProps {
  sectionKey: string
  title: string
  entries: EntryData[]
  categoryOrder: string[]
  showNextUp?: boolean
  sortable?: boolean
  activeFilter: string
}

function DashboardSection({
  sectionKey,
  title,
  entries,
  categoryOrder,
  showNextUp,
  sortable,
  activeFilter: _activeFilter,
}: SectionProps) {
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({})

  if (entries.length === 0) return null

  const groups = groupByType(entries)
  const activeTypes = categoryOrder.filter((t) => (groups[t]?.length ?? 0) > 0)
  if (activeTypes.length === 0) return null

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeTypes.map((type) => {
          const typeEntries = groups[type]

          // Want queue — sortable with DnD, but expand state lifted here for col-span
          if (sortable) {
            const isExpanded = expandedTypes[type] ?? false
            return (
              <div key={`${sectionKey}-${type}`} className={isExpanded ? 'md:col-span-2' : ''}>
                <SortableWantCategory
                  type={type}
                  initialEntries={typeEntries}
                  isExpanded={isExpanded}
                  onToggle={() => toggleType(type)}
                />
              </div>
            )
          }

          // Non-sortable: use CollapsibleCategory with stacked preview
          const isExpanded = expandedTypes[type] ?? false
          const cards = typeEntries.map((entry, idx) => (
            <div key={entry.id} className="flex flex-col gap-1">
              <MediaCard
                id={entry.mediaItem.id}
                title={entry.mediaItem.title}
                year={entry.mediaItem.year}
                posterUrl={entry.mediaItem.posterUrl}
                mediaType={entry.mediaItem.type}
                status={entry.status}
                rating={entry.rating}
                href={`/item/${entry.id}`}
                listeningProgress={entry.listeningProgress}
                metadata={entry.mediaItem.metadata}
              />
              {showNextUp && (
                <div className="flex justify-center">
                  <SetNextUpButton entryId={entry.id} isNextUp={idx === 0} />
                </div>
              )}
            </div>
          ))

          return (
            <div
              key={`${sectionKey}-${type}`}
              className={isExpanded ? 'md:col-span-2' : ''}
            >
              <CollapsibleCategory
                mediaType={type}
                isExpanded={isExpanded}
                onToggle={() => toggleType(type)}
              >
                {cards}
              </CollapsibleCategory>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Root client component ─────────────────────────────────────────────────────

export function DashboardClient({
  userName,
  inProgress,
  wantEntries,
  recentCompleted,
  categoryOrder,
  isEmpty,
}: DashboardClientProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all')

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Welcome back, {userName}</h1>
          <p className="text-zinc-500">Here&apos;s what you&apos;ve been up to</p>
        </div>
        <div className="flex gap-2">
          <Link href="/search">
            <Button>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </Link>
          <Link href="/dashboard/suggestions">
            <Button variant="outline">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Suggestions</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Sticky type filter bar */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-white/90 backdrop-blur-sm border-b border-zinc-100">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors',
                activeFilter === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DashboardSection
        sectionKey="in-progress"
        title="Currently Consuming"
        entries={inProgress}
        categoryOrder={categoryOrder}
        activeFilter={activeFilter}
      />

      <DashboardSection
        sectionKey="want"
        title="Want to Consume"
        entries={wantEntries}
        categoryOrder={categoryOrder}
        showNextUp
        sortable
        activeFilter={activeFilter}
      />

      <DashboardSection
        sectionKey="completed"
        title="Recently Consumed"
        entries={recentCompleted}
        categoryOrder={categoryOrder}
        activeFilter={activeFilter}
      />

      <DiscoverSection />

      {isEmpty && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="text-6xl">🎬</div>
          <h2 className="text-xl font-semibold text-zinc-700">Nothing tracked yet</h2>
          <p className="text-zinc-500 max-w-sm">
            Start by searching for a movie, book, game, or any other media you&apos;ve consumed.
          </p>
          <Link href="/search">
            <Button>
              <Plus className="h-4 w-4" />
              Add your first entry
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

