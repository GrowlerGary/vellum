import { describe, it, expect } from 'vitest'
import { validateReorderPayload } from '../reorder/validation'

describe('validateReorderPayload', () => {
  it('rejects empty entries array', () => {
    const result = validateReorderPayload({ entries: [] })
    expect(result.success).toBe(false)
  })

  it('accepts valid entries', () => {
    const result = validateReorderPayload({
      entries: [
        { id: 'abc', sortOrder: 0 },
        { id: 'def', sortOrder: 1 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative sortOrder', () => {
    const result = validateReorderPayload({
      entries: [{ id: 'abc', sortOrder: -1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer sortOrder', () => {
    const result = validateReorderPayload({
      entries: [{ id: 'abc', sortOrder: 1.5 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty id', () => {
    const result = validateReorderPayload({
      entries: [{ id: '', sortOrder: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing entries field', () => {
    const result = validateReorderPayload({})
    expect(result.success).toBe(false)
  })
})
