interface MediaDetailsProps {
  type: string
  metadata: Record<string, unknown>
  year?: number | null
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatYearsRunning(
  startYear: number | null | undefined,
  lastAirDate: string | null | undefined,
  status: string | null | undefined
): string | null {
  if (!startYear) return null
  const isOngoing = status === 'Returning Series' || status === 'In Production'
  if (isOngoing) return `${startYear}–present`
  if (lastAirDate) {
    const endYear = new Date(lastAirDate).getFullYear()
    return endYear > startYear ? `${startYear}–${endYear}` : `${startYear}`
  }
  return `${startYear}`
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-zinc-700 mt-0.5">{value}</dd>
    </div>
  )
}

export function MediaDetails({ type, metadata, year }: MediaDetailsProps) {
  const items: Array<{ label: string; value: string }> = []

  if (type === 'MOVIE') {
    const director = metadata.director as string | null | undefined
    const cast = metadata.cast as string[] | undefined
    const runtime = metadata.runtime as number | null | undefined

    if (director) items.push({ label: 'Director', value: director })
    if (cast?.length) items.push({ label: 'Cast', value: cast.join(', ') })
    if (year) items.push({ label: 'Released', value: String(year) })
    if (runtime && runtime > 0) items.push({ label: 'Duration', value: formatDuration(runtime) })
  } else if (type === 'TV_SHOW') {
    const cast = metadata.cast as string[] | undefined
    const numberOfSeasons = metadata.numberOfSeasons as number | null | undefined
    const status = metadata.status as string | null | undefined
    const lastAirDate = metadata.lastAirDate as string | null | undefined
    const episodeRunTime = metadata.episodeRunTime as number | null | undefined

    if (cast?.length) items.push({ label: 'Cast', value: cast.join(', ') })
    if (numberOfSeasons && numberOfSeasons > 0) {
      items.push({ label: 'Seasons', value: String(numberOfSeasons) })
    }
    const yearsStr = formatYearsRunning(year, lastAirDate, status)
    if (yearsStr) items.push({ label: 'Years', value: yearsStr })
    const isOngoing = status === 'Returning Series' || status === 'In Production'
    if (status) items.push({ label: 'Status', value: isOngoing ? 'Ongoing' : 'Ended' })
    if (episodeRunTime && episodeRunTime > 0) {
      items.push({ label: 'Episode Length', value: formatDuration(episodeRunTime) })
    }
  } else if (type === 'BOOK') {
    const authors = metadata.authors as string[] | undefined
    const pages = metadata.pages as number | null | undefined

    if (authors?.length) items.push({ label: 'Author', value: authors.join(', ') })
    if (year) items.push({ label: 'Published', value: String(year) })
    if (pages && pages > 0) items.push({ label: 'Pages', value: String(pages) })
  } else if (type === 'AUDIOBOOK') {
    const authors = metadata.authors as string[] | undefined
    const narrators = metadata.narrators as string[] | undefined
    const runtimeMinutes = metadata.runtimeMinutes as number | null | undefined

    if (authors?.length) items.push({ label: 'Author', value: authors.join(', ') })
    if (narrators?.length) items.push({ label: 'Narrator', value: narrators.join(', ') })
    if (year) items.push({ label: 'Released', value: String(year) })
    if (runtimeMinutes && runtimeMinutes > 0) {
      items.push({ label: 'Length', value: formatDuration(runtimeMinutes) })
    }
  }

  if (items.length === 0) return null

  return (
    <section>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
        {items.map((item) => (
          <DetailItem key={item.label} label={item.label} value={item.value} />
        ))}
      </dl>
    </section>
  )
}
