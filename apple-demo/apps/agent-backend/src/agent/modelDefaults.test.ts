import { describe, expect, it } from 'vitest'
import { resolveModelContextWindow } from './modelDefaults.js'

describe('resolveModelContextWindow', () => {
  it('returns explicit contextWindow when provided', () => {
    expect(resolveModelContextWindow({
      provider: 'deepseek',
      modelName: 'deepseek-chat',
      contextWindow: 65536
    })).toBe(65536)
  })

  it('returns official deepseek-chat context window by default', () => {
    expect(resolveModelContextWindow({
      provider: 'deepseek',
      modelName: 'deepseek-chat'
    })).toBe(131072)
  })

  it('falls back to conservative default for unknown models', () => {
    expect(resolveModelContextWindow({
      provider: 'openai',
      modelName: 'gpt-unknown'
    })).toBe(16384)
  })
})
