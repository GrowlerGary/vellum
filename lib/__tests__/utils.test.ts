import { describe, it, expect } from 'vitest'
import { slugify, formatYear, formatRating, cn } from '@/lib/utils'

describe('utils', () => {
  describe('slugify', () => {
    it('converts title to slug', () => {
      expect(slugify('Project Hail Mary')).toBe('project-hail-mary')
    })
    it('handles special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world')
    })
    it('trims leading and trailing hyphens', () => {
      expect(slugify('  test  ')).toBe('test')
    })
  })

  describe('formatYear', () => {
    it('formats a valid year', () => {
      expect(formatYear(2024)).toBe('2024')
    })
    it('returns Unknown for null', () => {
      expect(formatYear(null)).toBe('Unknown')
    })
    it('returns Unknown for undefined', () => {
      expect(formatYear(undefined)).toBe('Unknown')
    })
  })

  describe('formatRating', () => {
    it('formats a valid rating', () => {
      expect(formatRating(4.5)).toBe('4.5 / 5')
    })
    it('returns Not rated for null', () => {
      expect(formatRating(null)).toBe('Not rated')
    })
  })

  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })
    it('resolves tailwind conflicts', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2')
    })
  })
})
