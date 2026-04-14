import { describe, expect, it } from 'vitest'

import {
  buildResolvedQuestionInteractionLookup,
  rewritePersistedQuestionResponseText
} from './questionHistorySummary'
import type { AgentSessionInteraction } from '@/api/types'

function buildInteraction(overrides: Partial<AgentSessionInteraction> = {}): AgentSessionInteraction {
  return {
    interactionId: 'interaction-1',
    runId: 'run-1',
    kind: 'question',
    status: 'answered',
    payload: {
      questionId: 'question-1',
      title: '补充信息',
      prompt: '请选择模式并补充备注',
      required: true,
      fields: [
        { id: 'task', label: '任务', type: 'text', required: true },
        {
          id: 'mode',
          label: '模式',
          type: 'select',
          required: true,
          options: [
            { label: 'VLR 模式', value: 'VLR' },
            { label: 'SGSN 模式', value: 'SGSN' }
          ]
        },
        { id: 'notes', label: '备注', type: 'text', required: false }
      ]
    },
    createdAt: 1,
    resolvedAt: 2,
    ...overrides
  }
}

describe('questionHistorySummary', () => {
  it('rewrites resolved continuation answers with field labels, select labels, and notes', () => {
    const lookup = buildResolvedQuestionInteractionLookup([buildInteraction()])

    const rewritten = rewritePersistedQuestionResponseText(
      [
        '[INTERACTION CONTEXT]',
        'interaction_id: interaction-1',
        'question_id: question-1',
        'prompt: 请选择模式并补充备注',
        'answer: {"task":"提取指标","mode":"VLR","notes":"只处理非空行"}'
      ].join('\n'),
      lookup
    )

    expect(rewritten).toEqual({
      text: '已提交回答：任务：提取指标，模式：VLR 模式，备注：只处理非空行',
      shouldHideOriginal: false,
      editable: false
    })
  })

  it('rewrites rejected continuation history into a readable rejection summary', () => {
    const lookup = buildResolvedQuestionInteractionLookup([
      buildInteraction({
        interactionId: 'interaction-reject',
        status: 'rejected',
        payload: {
          ...buildInteraction().payload,
          prompt: '是否继续执行？'
        }
      })
    ])

    const rewritten = rewritePersistedQuestionResponseText(
      [
        '[INTERACTION CONTEXT]',
        'interaction_id: interaction-reject',
        'question_id: question-1',
        'prompt: 是否继续执行？',
        'status: rejected'
      ].join('\n'),
      lookup
    )

    expect(rewritten).toEqual({
      text: '已拒绝回答：是否继续执行？',
      shouldHideOriginal: false,
      editable: false
    })
  })

  it('omits the generic select label in answered summaries while preserving other fields', () => {
    const lookup = buildResolvedQuestionInteractionLookup([
      buildInteraction({
        payload: {
          questionId: 'question-2',
          title: '',
          prompt: '请选择部署环境',
          required: true,
          fields: [
            {
              id: 'answer',
              label: '请选择',
              type: 'select',
              required: true,
              options: [
                { label: '开发环境', value: 'dev' },
                { label: '生产环境', value: 'prod' }
              ]
            },
            { id: 'notes', label: '补充说明', type: 'text', required: false }
          ]
        }
      })
    ])

    const rewritten = rewritePersistedQuestionResponseText(
      [
        '[INTERACTION CONTEXT]',
        'interaction_id: interaction-1',
        'question_id: question-2',
        'prompt: 请选择部署环境',
        'answer: {"answer":"prod","notes":"夜间发布"}'
      ].join('\n'),
      lookup
    )

    expect(rewritten).toEqual({
      text: '已提交回答：生产环境，补充说明：夜间发布',
      shouldHideOriginal: false,
      editable: false
    })
  })
})
