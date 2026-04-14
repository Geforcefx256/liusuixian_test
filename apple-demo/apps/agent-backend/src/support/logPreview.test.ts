import { describe, expect, it } from 'vitest'
import { buildLogPreview } from './logPreview.js'

describe('buildLogPreview', () => {
  it('truncates long values by default', () => {
    const value = 'x'.repeat(20)

    expect(buildLogPreview(value, { maxChars: 10 })).toBe('xxxxxxxxxx...[truncated]')
  })

  it('returns full values when truncation is disabled', () => {
    const value = 'x'.repeat(20)

    expect(buildLogPreview(value, {
      maxChars: 10,
      disableTruncation: true
    })).toBe(value)
  })
})
