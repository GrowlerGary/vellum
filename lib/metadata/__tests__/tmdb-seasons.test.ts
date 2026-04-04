import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock env var
vi.stubEnv('TMDB_API_KEY', 'test-key')

describe('getTmdbSeason', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns episodes for a season', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        season_number: 1,
        name: 'Season 1',
        episodes: [
          { episode_number: 1, name: 'Pilot', air_date: '2023-09-17', overview: 'First episode' },
          { episode_number: 2, name: 'Episode 2', air_date: '2023-09-24', overview: 'Second episode' },
        ],
      }),
    })

    const { getTmdbSeason } = await import('../tmdb')
    const result = await getTmdbSeason('1234', 1)

    expect(result).not.toBeNull()
    expect(result!.number).toBe(1)
    expect(result!.name).toBe('Season 1')
    expect(result!.episodes).toHaveLength(2)
    expect(result!.episodes[0]).toEqual({
      number: 1,
      title: 'Pilot',
      airDate: '2023-09-17',
      overview: 'First episode',
    })
  })

  it('returns null when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { getTmdbSeason } = await import('../tmdb')
    const result = await getTmdbSeason('1234', 1)

    expect(result).toBeNull()
  })

  it('calls the correct TMDB endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ season_number: 2, name: 'Season 2', episodes: [] }),
    })

    const { getTmdbSeason } = await import('../tmdb')
    await getTmdbSeason('5678', 2)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/tv/5678/season/2',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) })
    )
  })
})
