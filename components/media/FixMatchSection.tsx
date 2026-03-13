'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, X, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MEDIA_TYPE_ICONS } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaItemSnapshot {
  id: string
  type: string
  source: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  metadata: Record<string, unknown>
}

interface SearchResult {
  externalId: string
  source: string
  mediaType: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl?: string | null
  overview: string
  genres: string[]
  metadata: Record<string, unknown>
}

type FieldKey = 'title' | 'year' | 'posterUrl' | 'backdropUrl' | 'overview' | 'genres' | 'metadata'

const FIELD_LABELS: Record<FieldKey, string> = {
  title: 'Title',
  year: 'Year',
  posterUrl: 'Poster',
  backdropUrl: 'Backdrop',
  overview: 'Overview',
  genres: 'Genres',
  metadata: 'Metadata',
}

const ALL_SOURCES = [
  { value: 'TMDB', label: 'TMDB (Movies & TV)' },
  { value: 'IGDB', label: 'IGDB (Games)' },
  { value: 'HARDCOVER', label: 'Hardcover (Books)' },
  { value: 'AUDNEXUS', label: 'Audnexus (Audiobooks)' },
]

// Default source based on media type
function defaultSource(mediaType: string): string {
  if (mediaType === 'VIDEO_GAME') return 'IGDB'
  if (mediaType === 'AUDIOBOOK') return 'AUDNEXUS'
  if (mediaType === 'BOOK') return 'HARDCOVER'
  return 'TMDB'
}

// ── Search result row ──────────────────────────────────────────────────────────

function ResultRow({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-zinc-50 text-left transition-colors group"
    >
      <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-zinc-100">
        {result.posterUrl ? (
          <Image src={result.posterUrl} alt={result.title} fill className="object-cover" sizes="40px" />
        ) : (
          <div className="flex h-full items-center justify-center text-lg text-zinc-300">
            {MEDIA_TYPE_ICONS[result.mediaType] ?? '📦'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 text-sm truncate">{result.title}</p>
        <p className="text-xs text-zinc-400">
          {result.source} · {result.year ?? 'Unknown year'}
        </p>
        {result.overview && (
          <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{result.overview}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 flex-shrink-0" />
    </button>
  )
}

// ── Merge preview ──────────────────────────────────────────────────────────────

function MergePreview({
  current,
  external,
  onApply,
  onCancel,
  error,
}: {
  current: MediaItemSnapshot
  external: SearchResult
  onApply: (fields: Record<FieldKey, boolean>, externalData: SearchResult) => Promise<void>
  onCancel: () => void
  error?: string | null
}) {
  const [selected, setSelected] = useState<Record<FieldKey, boolean>>({
    title: true,
    year: true,
    posterUrl: true,
    backdropUrl: true,
    overview: true,
    genres: true,
    metadata: true,
  })
  const [applying, setApplying] = useState(false)

  const toggle = (field: FieldKey) =>
    setSelected((prev) => ({ ...prev, [field]: !prev[field] }))

  const selectAll = () =>
    setSelected({ title: true, year: true, posterUrl: true, backdropUrl: true, overview: true, genres: true, metadata: true })

  const handleApply = async () => {
    setApplying(true)
    try {
      await onApply(selected, external)
    } finally {
      setApplying(false)
    }
  }

  function renderValue(field: FieldKey, source: 'current' | 'external'): string {
    const obj = source === 'current' ? current : external
    switch (field) {
      case 'title': return obj.title ?? '—'
      case 'year': return String(obj.year ?? '—')
      case 'posterUrl': return obj.posterUrl ? '✓ Has poster' : '— None'
      case 'backdropUrl': return obj.backdropUrl ? '✓ Has backdrop' : '— None'
      case 'overview': {
        const text = obj.overview ?? ''
        return text.length > 80 ? text.slice(0, 80) + '…' : text || '—'
      }
      case 'genres': return (obj.genres ?? []).join(', ') || '—'
      case 'metadata': return 'JSON data'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900">Merge Preview</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Matching to: <span className="font-medium text-zinc-600">{external.title}</span> ({external.source})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Update All
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
      </div>

      {/* Field comparison table */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_1fr] gap-0 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 px-3 py-2">
          <div className="w-8" />
          <div>Current</div>
          <div>From {external.source}</div>
        </div>

        {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => {
          const currentVal = renderValue(field, 'current')
          const externalVal = renderValue(field, 'external')
          const unchanged = currentVal === externalVal

          return (
            <label
              key={field}
              className={`grid grid-cols-[auto_1fr_1fr] gap-0 border-b border-zinc-100 last:border-0 px-3 py-2 cursor-pointer hover:bg-zinc-50 transition-colors ${
                selected[field] ? 'bg-indigo-50/40' : ''
              }`}
            >
              <div className="w-8 flex items-start pt-0.5">
                <input
                  type="checkbox"
                  checked={selected[field]}
                  onChange={() => toggle(field)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 cursor-pointer"
                />
              </div>
              <div className="pr-3">
                <p className="text-xs font-medium text-zinc-500 mb-0.5">{FIELD_LABELS[field]}</p>
                <p className="text-xs text-zinc-700 break-words">{currentVal}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-0.5">&nbsp;</p>
                <p className={`text-xs break-words ${unchanged ? 'text-zinc-400' : 'text-indigo-700 font-medium'}`}>
                  {externalVal}
                  {unchanged && <span className="ml-1 text-zinc-300">(same)</span>}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button onClick={handleApply} disabled={applying} className="w-full">
        {applying ? 'Applying…' : <><Check className="h-4 w-4" /> Apply Selected Fields</>}
      </Button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface FixMatchSectionProps {
  mediaItem: MediaItemSnapshot
  onMatchApplied: () => void
}

type State = 'idle' | 'searching' | 'merging'

export function FixMatchSection({ mediaItem, onMatchApplied }: FixMatchSectionProps) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [query, setQuery] = useState(mediaItem.title)
  const [source, setSource] = useState(defaultSource(mediaItem.type))
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [success, setSuccess] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Escape key to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState('idle')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus search input when searching state activates
  useEffect(() => {
    if (state === 'searching') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [state])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const type = mediaItem.type
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`)
      const data = await res.json() as { results: SearchResult[] }
      // Filter to the selected source
      const filtered = (data.results ?? []).filter((r) => r.source === source)
      setResults(filtered)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query, source, mediaItem.type])

  const handleSelectResult = (result: SearchResult) => {
    setSelected(result)
    setState('merging')
  }

  const handleApply = async (
    fields: Record<FieldKey, boolean>,
    externalData: SearchResult
  ) => {
    setApplyError(null)
    try {
      const res = await fetch(`/api/media-items/${mediaItem.id}/match`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: externalData.source,
          externalId: externalData.externalId,
          fields,
          externalData: {
            title: externalData.title,
            year: externalData.year,
            posterUrl: externalData.posterUrl,
            backdropUrl: externalData.backdropUrl ?? null,
            overview: externalData.overview,
            genres: externalData.genres,
            metadata: externalData.metadata,
          },
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: unknown }
        setApplyError(
          typeof errBody.error === 'string'
            ? errBody.error
            : 'Failed to apply match. Please try again.'
        )
        return
      }

      const data = await res.json() as { id: string; entryId?: string; merged?: boolean }

      if (data.id !== mediaItem.id) {
        // This item was merged into an existing record.
        // Navigate using entryId (MediaEntry ID) — the detail page routes by
        // entry ID, not MediaItem ID. Fall back to data.id only as a safety net.
        router.push(`/item/${data.entryId ?? data.id}`)
        return
      }

      setSuccess(true)
      setState('idle')
      onMatchApplied()
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setApplyError('Network error. Please try again.')
    }
  }

  if (state === 'idle') {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-zinc-900">Fix Match</h2>
          {success && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Match applied
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 mb-3">
          Incorrect poster, title, or metadata? Re-link this item to the right external record.
        </p>
        <Button variant="outline" size="sm" onClick={() => setState('searching')}>
          <Search className="h-4 w-4" /> Fix Match
        </Button>
      </section>
    )
  }

  if (state === 'merging' && selected) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Fix Match</h2>
        <MergePreview
          current={mediaItem}
          external={selected}
          onApply={handleApply}
          onCancel={() => { setApplyError(null); setState('searching') }}
          error={applyError}
        />
      </section>
    )
  }

  // Searching state
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">Fix Match</h2>
        <Button variant="outline" size="sm" onClick={() => setState('idle')}>
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>

      {/* Search controls */}
      <div className="flex gap-2 mb-3">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search for a title…"
          className="flex-1"
        />
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? '…' : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <ResultRow
              key={`${r.source}-${r.externalId}`}
              result={r}
              onSelect={() => handleSelectResult(r)}
            />
          ))}
        </div>
      ) : searching ? (
        <p className="text-sm text-zinc-400 text-center py-4">Searching…</p>
      ) : (
        <p className="text-sm text-zinc-400 text-center py-4">
          {results.length === 0 && query !== mediaItem.title
            ? 'No results. Try a different title or source.'
            : 'Enter a title and press Search.'}
        </p>
      )}
    </section>
  )
}
