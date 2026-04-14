import { describe, expect, it } from 'vitest'

import type { AgentSessionMessage } from './sessionStoreTypes.js'
import {
  QuestionAnswerValidationError,
  normalizeConversationInput
} from './questionAnswer.js'
import { buildQuestionProtocol } from '../runtime/tools/local/question.js'

function buildQuestionMessage(protocol: Record<string, unknown>): AgentSessionMessage {
  return {
    role: 'assistant',
    createdAt: 1,
    parts: [
      { type: 'text', text: '请补充信息' },
      { type: 'structured', kind: 'protocol', protocol }
    ]
  }
}

function buildQuestionHistory(): AgentSessionMessage[] {
  return [buildQuestionMessage(buildQuestionProtocol({
    id: 'question-1',
    prompt: '请补充任务信息',
    required: true,
    fields: [
      {
        id: 'task',
        label: '任务',
        type: 'text',
        required: true
      },
      {
        id: 'mode',
        label: '模式',
        type: 'select',
        required: false,
        options: [
          { label: 'VLR', value: 'VLR' },
          { label: 'SGSN', value: 'SGSN' }
        ]
      }
    ]
  }))]
}

describe('normalizeConversationInput', () => {
  it('passes through free-form input unchanged', () => {
    expect(normalizeConversationInput({
      input: '普通用户输入',
      history: buildQuestionHistory()
    })).toBe('普通用户输入')
  })

  it('accepts valid question answers and normalizes field order', () => {
    const normalized = normalizeConversationInput({
      input: JSON.stringify({
        questionId: 'question-1',
        answer: {
          mode: 'VLR',
          task: '提取指标',
          notes: '补充说明'
        }
      }),
      history: buildQuestionHistory()
    })

    expect(normalized).toBe('{"questionId":"question-1","answer":{"task":"提取指标","mode":"VLR","notes":"补充说明"}}')
  })

  it('rejects mismatched question ids', () => {
    expect(() => normalizeConversationInput({
      input: JSON.stringify({
        questionId: 'question-2',
        answer: {
          task: '提取指标'
        }
      }),
      history: buildQuestionHistory()
    })).toThrowError(new QuestionAnswerValidationError('问题回答的 questionId 与当前待回答问题不匹配。'))
  })

  it('rejects unknown fields', () => {
    expect(() => normalizeConversationInput({
      input: JSON.stringify({
        questionId: 'question-1',
        answer: {
          task: '提取指标',
          unknown: 'x'
        }
      }),
      history: buildQuestionHistory()
    })).toThrowError(new QuestionAnswerValidationError('问题回答包含未知字段：unknown。'))
  })

  it('rejects invalid select values', () => {
    expect(() => normalizeConversationInput({
      input: JSON.stringify({
        questionId: 'question-1',
        answer: {
          task: '提取指标',
          mode: 'BAD'
        }
      }),
      history: buildQuestionHistory()
    })).toThrowError(new QuestionAnswerValidationError('字段“模式”包含无效选项值。'))
  })

  it('rejects missing required answers', () => {
    expect(() => normalizeConversationInput({
      input: JSON.stringify({
        questionId: 'question-1',
        answer: {
          mode: 'VLR'
        }
      }),
      history: buildQuestionHistory()
    })).toThrowError(new QuestionAnswerValidationError('字段“任务”为必填项。'))
  })
})
