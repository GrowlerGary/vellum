'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, Download, Check, AlertCircle, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShelfmarkRelease {
  id: string
  source: string
  sourceId: string
  title: string
  author?: string
  format?: string
  size?: string
  seeders?: number
  metadata?: Record<string, unknown>
}

interface ShelfmarkSectionProps {
  title: string
  author?: string
  mediaType: string
  shelfmarkEnabled: boolean
}

// ── Release row ───────────────────────────────────────────────────────────────

function ReleaseRow({
  release,
  onSelect,
}: {
  release: ShelfmarkRelease
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full p-3 hover:bg-zinc-50 text-left transition-colors group"
    >
      <BookOpen className="h-5 w-5 text-zinc-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 text-sm truncate">{release.title}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {release.source}
          {release.format && ` · ${release.format.toUpperCase()}`}
          {release.size && ` · ${release.size}`}
          {release.seeders != null && ` · ${release.seeders} seeders`}
        </p>
        {release.author && (
          <p className="text-xs text-zinc-500 mt-0.5">{release.author}</p>
        )}
      </div>
      <Download className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 flex-shrink-0" />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type State = 'idle' | 'searching' | 'confirm'

export function ShelfmarkSection({ title, author, mediaType, shelfmarkEnabled }: ShelfmarkSectionProps) {
  const [state, setState] = useState<State>('idle')
  const [query, setQuery] = useState(() => {
    const parts = [title]
    if (author) parts.push(author)
    return parts.join(' ')
  })
  const [results, setResults] = useState<ShelfmarkRelease[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ShelfmarkRelease | null>(null)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Escape key to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setState('idle')
        setSelected(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus search input when entering search state
  useEffect(() => {
    if (state === 'searching') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [state])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    setError(null)
    try {
      const res = await fetch('/api/shelfmark/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json() as { releases?: ShelfmarkRelease[]; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? `Search failed (${res.status})`)
        return
      }
      setResults(data.releases ?? [])
    } catch {
      setError('Network error. Is Vellum able to reach Shelfmark?')
    } finally {
      setSearching(false)
    }
  }, [query])

  const handleSelectRelease = (release: ShelfmarkRelease) => {
    setSelected(release)
    setState('confirm')
    setError(null)
  }

  const handleDownload = async () => {
    if (!selected) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/shelfmark/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selected.source,
          sourceId: selected.sourceId,
          title: selected.title,
          format: selected.format,
          metadata: selected.metadata,
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? `Download failed (${res.status})`)
        return
      }
      setSuccess(true)
      setState('idle')
      setSelected(null)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // Only show for BOOK / AUDIOBOOK
  if (mediaType !== 'BOOK' && mediaType !== 'AUDIOBOOK') return null
  if (!shelfmarkEnabled) return null

  // ── Idle ────────────────────────────────────────────────────────────────────

  if (state === 'idle') {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-zinc-900">Find on Shelfmark</h2>
          {success && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Sent to Shelfmark
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 mb-3">
          Search your Shelfmark instance and queue a download.
        </p>
        <Button variant="outline" size="sm" onClick={() => setState('searching')}>
          <Search className="h-4 w-4" /> Find on Shelfmark
        </Button>
      </section>
    )
  }

  // ── Confirm ─────────────────────────────────────────────────────────────────

  if (state === 'confirm' && selected) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Find on Shelfmark</h2>
          <Button variant="outline" size="sm" onClick={() => { setError(null); setState('searching') }}>
            <X className="h-4 w-4" /> Back
          </Button>
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 space-y-3">
          <p className="text-sm text-zinc-700">
            Send <span className="font-medium">{selected.title}</span> to Shelfmark for download?
          </p>
          <div className="text-xs text-zinc-400 space-y-0.5">
            <p>Source: {selected.source}</p>
            {selected.format && <p>Format: {selected.format.toUpperCase()}</p>}
            {selected.size && <p>Size: {selected.size}</p>}
            {selected.seeders != null && <p>Seeders: {selected.seeders}</p>}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleDownload} disabled={sending} className="flex-1">
              {sending ? 'Sending…' : <><Download className="h-4 w-4" /> Send to Shelfmark</>}
            </Button>
            <Button variant="outline" onClick={() => { setError(null); setState('searching') }}>
              Cancel
            </Button>
          </div>
        </div>
      </section>
    )
  }

  // ── Searching ───────────────────────────────────────────────────────────────

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">Find on Shelfmark</h2>
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
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? '…' : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <ReleaseRow
              key={`${r.source}-${r.sourceId}-${r.id}`}
              release={r}
              onSelect={() => handleSelectRelease(r)}
            />
          ))}
        </div>
      ) : searching ? (
        <p className="text-sm text-zinc-400 text-center py-4">Searching Shelfmark…</p>
      ) : (
        <p className="text-sm text-zinc-400 text-center py-4">
          Enter a search query and press Search.
        </p>
      )}
    </section>
  )
}
