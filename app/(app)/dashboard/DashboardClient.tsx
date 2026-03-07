'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MediaCard } from '@/components/media/MediaCard'
import { CollapsibleCategory } from '@/components/media/CollapsibleCategory'
import { SetNextUpButton } from '@/components/media/SetNextUpButton'
import { Plus, Sparkles } from 'lucide-react'
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS } from '@/lib/utils'

interface MediaItemData {
  id: string
  type: string
  title: string
  year: number | null
  posterUrl: string | null
}

interface EntryData {
  id: string
  status: string
  rating: number | null
  mediaItem: MediaItemData
  sortOrder: number
}

interface StatData {
  type: string
  label: string
  icon: string
  total: number
  completed: number
  inProgress: number
  want: number
}

interface DashboardClientProps {
  userName: string
  inProgress: EntryData[]
  wantEntries: EntryData[]
  recentCompleted: EntryData[]
  statsByType: StatData[]
  categoryOrder: string[]
  isEmpty: boolean
}

interface SectionProps {
  sectionKey: string
  title: string
  entries: EntryData[]
  categoryOrder: string[]
  showNextUp?: boolean
}

function groupByType(entries: EntryData[]): Record<string, EntryData[]> {
  const groups: Record<string, EntryData[]> = {}
  for (const entry of entries) {
    const type = entry.mediaItem.type
    if (!groups[type]) groups[type] = []
    groups[type].push(entry)
  }
  return groups
}

function DashboardSection({ sectionKey, title, entries, categoryOrder, showNextUp }: SectionProps) {
  // Track expanded state per media type within this section
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

export function DashboardClient({
  userName,
  inProgress,
  wantEntries,
  recentCompleted,
  statsByType,
  categoryOrder,
  isEmpty,
}: DashboardClientProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Welcome back, {userName}
          </h1>
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statsByType.map((s) => (
          <div key={s.type} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-sm font-medium text-zinc-700">{s.label}</div>
            <div className="text-2xl font-bold text-zinc-900">{s.total}</div>
            <div className="text-xs text-zinc-400 mt-1">
              {s.completed} done · {s.inProgress} in progress
            </div>
          </div>
        ))}
      </div>

      <DashboardSection
        sectionKey="in-progress"
        title="Currently Consuming"
        entries={inProgress}
        categoryOrder={categoryOrder}
      />

      <DashboardSection
        sectionKey="want"
        title="Want to Consume"
        entries={wantEntries}
        categoryOrder={categoryOrder}
        showNextUp
      />

      <DashboardSection
        sectionKey="completed"
        title="Recently Consumed"
        entries={recentCompleted}
        categoryOrder={categoryOrder}
      />

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

// Keep the label/icon map accessible for stats rendering without importing entire utils in client
export { MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS }
