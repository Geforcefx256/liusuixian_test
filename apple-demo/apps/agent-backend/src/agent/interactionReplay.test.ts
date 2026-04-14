import { describe, expect, it } from 'vitest'

import { buildAwaitingInteractionToolSummary } from './interactions.js'
import { filterReplayMessages } from './interactionReplay.js'

describe('interaction replay filtering', () => {
  it('removes awaiting-interaction messages by structured tool marker', () => {
    const messages = filterReplayMessages([
      {
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '请提供「列索引」，填写后我会继续。'
          },
          {
            type: 'tool',
            id: 'tool-question-1',
            name: 'local:question',
            input: { prompt: '请补充列索引' },
            status: 'success',
            output: buildAwaitingInteractionToolSummary({
              interactionId: 'interaction-1',
              runId: 'run-1',
              kind: 'question',
              status: 'pending',
              payload: {
                questionId: 'question-1',
                title: '补充信息',
                prompt: '请补充列索引',
                required: true,
                fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
              },
              createdAt: 1,
              resolvedAt: null
            })
          }
        ],
        createdAt: 1
      }
    ])

    expect(messages).toEqual([])
  })

  it('does not filter assistant text by matching one fixed placeholder', () => {
    const messages = filterReplayMessages([{
      role: 'assistant',
      parts: [{
        type: 'text',
        text: '需要你的输入后才能继续。'
      }],
      createdAt: 1
    }])

    expect(messages).toEqual([{
      role: 'assistant',
      parts: [{
        type: 'text',
        text: '需要你的输入后才能继续。'
      }],
      createdAt: 1
    }])
  })
})
