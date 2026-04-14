import { describe, expect, it } from 'vitest'
import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import { TokenEstimator } from './TokenEstimator.js'
import { MessageSelector } from './MessageSelector.js'

function createMessage(text: string, createdAt: number): AgentSessionMessage {
  return {
    role: 'user',
    createdAt,
    parts: [{ type: 'text', text }]
  }
}

function createSelector(): MessageSelector {
  return new MessageSelector(new TokenEstimator({
    countTokens: text => text.length
  }))
}

describe('MessageSelector', () => {
  it('keeps all messages when budget exactly fits total tokens', () => {
    const selector = createSelector()
    const messages = [
      createMessage('aa', 1),
      createMessage('bbb', 2),
      createMessage('cccc', 3)
    ]

    const result = selector.selectWithinBudget({
      messages,
      budget: 9
    })

    expect(result.selected).toEqual(messages)
    expect(result.estimatedTokens).toBe(9)
  })

  it('keeps only the most recent messages within budget and preserves order', () => {
    const selector = createSelector()
    const messages = [
      createMessage('aa', 1),
      createMessage('bbb', 2),
      createMessage('cccc', 3)
    ]

    const result = selector.selectWithinBudget({
      messages,
      budget: 7
    })

    expect(result.selected).toEqual([
      messages[1],
      messages[2]
    ])
    expect(result.estimatedTokens).toBe(7)
  })

  it('returns empty when the newest message alone exceeds budget', () => {
    const selector = createSelector()
    const messages = [
      createMessage('aa', 1),
      createMessage('bbbbbb', 2)
    ]

    const result = selector.selectWithinBudget({
      messages,
      budget: 5
    })

    expect(result.selected).toEqual([])
    expect(result.estimatedTokens).toBe(0)
  })

  it('returns empty for zero budget or empty messages', () => {
    const selector = createSelector()

    expect(selector.selectWithinBudget({
      messages: [createMessage('aa', 1)],
      budget: 0
    })).toEqual({
      selected: [],
      estimatedTokens: 0
    })

    expect(selector.selectWithinBudget({
      messages: [],
      budget: 10
    })).toEqual({
      selected: [],
      estimatedTokens: 0
    })
  })
})
