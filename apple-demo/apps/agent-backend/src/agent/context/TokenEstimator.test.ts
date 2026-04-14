import { describe, expect, it } from 'vitest'
import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import { TokenEstimator } from './TokenEstimator.js'

const FIXED_CREATED_AT = 1

function createMessage(parts: AgentSessionMessage['parts']): AgentSessionMessage {
  return {
    role: 'assistant',
    parts,
    createdAt: FIXED_CREATED_AT
  }
}

describe('TokenEstimator', () => {
  it('counts text and tool parts from serialized content', () => {
    const estimator = new TokenEstimator({
      countTokens: text => text.length
    })
    const message = createMessage([
      { type: 'text', text: 'abc' },
      {
        type: 'tool',
        id: 'tool-1',
        name: 'read_file',
        input: { path: 'README.md' },
        status: 'success',
        output: '{"ok":true}'
      }
    ])

    expect(estimator.countMessage(message)).toBe(
      'abc\n[tool] read_file {"path":"README.md"} => {"ok":true}'.length
    )
  })

  it('counts multiple messages cumulatively', () => {
    const estimator = new TokenEstimator({
      countTokens: text => text.length
    })
    const messages = [
      createMessage([{ type: 'text', text: 'hello' }]),
      createMessage([{ type: 'text', text: 'world!' }])
    ]

    expect(estimator.countMessages(messages)).toBe(11)
  })

  it('returns at least one token for non-empty text and zero for empty text', () => {
    const estimator = new TokenEstimator({
      countTokens: () => 0
    })

    expect(estimator.countText('x')).toBe(1)
    expect(estimator.countText('')).toBe(0)
  })
})
