import { describe, it, expect } from 'vitest'
import { aggregateAndRank } from '@/lib/discover'

describe('aggregateAndRank', () => {
  it('deduplicates and ranks by frequency', () => {
    const similarSets = [
      [{ title: 'A', externalId: '1' }, { title: 'B', externalId: '2' }],
      [{ title: 'A', externalId: '1' }, { title: 'C', externalId: '3' }],
    ]
    const existing = new Set<string>()
    const result = aggregateAndRank(similarSets, existing)

    expect(result[0].title).toBe('A')  // appears in 2 sets
    expect(result[0].frequency).toBe(2)
    expect(result.length).toBe(3)
  })

  it('filters out items already in library', () => {
    const similarSets = [
      [{ title: 'A', externalId: '1' }, { title: 'B', externalId: '2' }],
    ]
    const existing = new Set(['1'])
    const result = aggregateAndRank(similarSets, existing)

    expect(result.length).toBe(1)
    expect(result[0].title).toBe('B')
  })

  it('returns empty array when all items are in library', () => {
    const similarSets = [
      [{ title: 'A', externalId: '1' }],
    ]
    const existing = new Set(['1'])
    const result = aggregateAndRank(similarSets, existing)

    expect(result.length).toBe(0)
  })

  it('handles empty similar sets', () => {
    const result = aggregateAndRank([], new Set())
    expect(result).toEqual([])
  })

  it('correctly tracks frequency across multiple appearances', () => {
    const similarSets = [
      [{ title: 'A', externalId: '1' }],
      [{ title: 'A', externalId: '1' }],
      [{ title: 'A', externalId: '1' }],
      [{ title: 'B', externalId: '2' }],
    ]
    const existing = new Set<string>()
    const result = aggregateAndRank(similarSets, existing)

    expect(result[0].externalId).toBe('1')
    expect(result[0].frequency).toBe(3)
    expect(result[1].externalId).toBe('2')
    expect(result[1].frequency).toBe(1)
  })
})
