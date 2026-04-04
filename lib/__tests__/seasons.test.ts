import { describe, it, expect } from 'vitest'
import { deriveShowStatus, mergeSeasonIntoCache, getAiredEpisodeCount, enrichEntriesWithTvStatus } from '@/lib/seasons'

describe('deriveShowStatus', () => {
  it('returns null when no episodes watched', () => {
    expect(deriveShowStatus(0, 10)).toBeNull()
  })

  it('returns IN_PROGRESS when some episodes watched', () => {
    expect(deriveShowStatus(3, 10)).toBe('IN_PROGRESS')
  })

  it('returns COMPLETED when all aired episodes watched', () => {
    expect(deriveShowStatus(10, 10)).toBe('COMPLETED')
  })

  it('returns IN_PROGRESS when more watched than aired (edge case)', () => {
    // Can happen if cache is stale and new episodes added
    expect(deriveShowStatus(11, 10)).toBe('IN_PROGRESS')
  })

  it('returns null when airedCount is 0', () => {
    expect(deriveShowStatus(0, 0)).toBeNull()
  })
})

describe('getAiredEpisodeCount', () => {
  const today = '2024-06-01'

  it('counts only episodes with air date before or on today', () => {
    const seasons = [
      {
        number: 1,
        name: 'Season 1',
        episodes: [
          { number: 1, title: 'Ep 1', airDate: '2024-01-01', overview: '' },
          { number: 2, title: 'Ep 2', airDate: '2024-05-31', overview: '' },
          { number: 3, title: 'Ep 3', airDate: '2024-07-01', overview: '' }, // future
        ],
      },
    ]
    expect(getAiredEpisodeCount(seasons, today)).toBe(2)
  })

  it('counts episodes with null air date as aired', () => {
    const seasons = [
      {
        number: 1,
        name: 'Season 1',
        episodes: [
          { number: 1, title: 'Ep 1', airDate: null, overview: '' },
        ],
      },
    ]
    expect(getAiredEpisodeCount(seasons, today)).toBe(1)
  })

  it('returns 0 for empty seasons', () => {
    expect(getAiredEpisodeCount([], today)).toBe(0)
  })
})

describe('mergeSeasonIntoCache', () => {
  it('adds a new season to empty cache data', () => {
    const newSeason = { number: 1, name: 'Season 1', episodes: [] }
    const result = mergeSeasonIntoCache({ seasons: [] }, newSeason)
    expect(result.seasons).toHaveLength(1)
    expect(result.seasons[0].number).toBe(1)
  })

  it('replaces an existing season', () => {
    const existing = {
      seasons: [
        { number: 1, name: 'Season 1', episodes: [{ number: 1, title: 'Old', airDate: null, overview: '' }] },
      ],
    }
    const newSeason = { number: 1, name: 'Season 1', episodes: [{ number: 1, title: 'New', airDate: null, overview: '' }] }
    const result = mergeSeasonIntoCache(existing, newSeason)
    expect(result.seasons).toHaveLength(1)
    expect(result.seasons[0].episodes[0].title).toBe('New')
  })

  it('preserves other seasons when adding a new one', () => {
    const existing = {
      seasons: [
        { number: 1, name: 'Season 1', episodes: [] },
      ],
    }
    const newSeason = { number: 2, name: 'Season 2', episodes: [] }
    const result = mergeSeasonIntoCache(existing, newSeason)
    expect(result.seasons).toHaveLength(2)
    expect(result.seasons.map((s) => s.number)).toEqual([1, 2])
  })
})

describe('enrichEntriesWithTvStatus', () => {
  it('overrides status for TV_SHOW entries based on watch counts', () => {
    const entries = [
      {
        id: '1',
        status: 'COMPLETED' as const,
        mediaItem: { type: 'TV_SHOW', metadata: {} },
        _count: { episodeWatches: 5 },
      },
      {
        id: '2',
        status: 'WANT' as const,
        mediaItem: { type: 'MOVIE', metadata: {} },
        _count: { episodeWatches: 0 },
      },
    ]
    const airedCounts = new Map([['1', 10]])
    const result = enrichEntriesWithTvStatus(entries as never, airedCounts)

    expect(result[0].status).toBe('IN_PROGRESS') // 5 of 10 watched
    expect(result[1].status).toBe('WANT')         // movies unchanged
  })

  it('sets COMPLETED when all aired episodes watched', () => {
    const entries = [
      {
        id: '1',
        status: 'IN_PROGRESS' as const,
        mediaItem: { type: 'TV_SHOW', metadata: {} },
        _count: { episodeWatches: 10 },
      },
    ]
    const airedCounts = new Map([['1', 10]])
    const result = enrichEntriesWithTvStatus(entries as never, airedCounts)

    expect(result[0].status).toBe('COMPLETED')
  })
})
