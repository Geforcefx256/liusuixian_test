import { describe, expect, it } from 'vitest'

import {
  buildAnswerContinuationContext,
  buildAwaitingInteractionToolSummary,
  buildDegradedQuestionInteractionPayload,
  prepareQuestionInteractionPayload,
  validateQuestionInteractionAnswer
} from './interactions.js'
import { buildPendingQuestionSummary } from './questionSummary.js'

describe('question interactions', () => {
  it('adds one optional notes field to select questions and records normalization warnings', () => {
    const prepared = prepareQuestionInteractionPayload({
      prompt: '请选择模式',
      options: JSON.stringify([
        { label: 'VLR', value: 'VLR' },
        { label: 'SGSN', value: 'SGSN' }
      ])
    })

    expect(prepared.warnings).toEqual([expect.objectContaining({
      code: 'options_json_string_normalized',
      field: 'options'
    })])
    expect(prepared.payload.fields).toMatchObject([
      {
        id: 'answer',
        type: 'select',
        options: [
          { label: 'VLR', value: 'VLR' },
          { label: 'SGSN', value: 'SGSN' }
        ]
      },
      {
        id: 'notes',
        type: 'text',
        required: false
      }
    ])
  })

  it('infers optional fields from optional wording and records normalization warnings', () => {
    const prepared = prepareQuestionInteractionPayload({
      prompt: '请提供 APN 的基本信息',
      required: true,
      fields: [
        {
          id: 'apnName',
          label: 'APN名称',
          type: 'text',
          required: true
        },
        {
          id: 'bizDesc',
          label: '业务描述（可选）',
          type: 'text',
          placeholder: '可选，填写业务场景或备注'
        }
      ]
    })

    expect(prepared.warnings).toEqual([expect.objectContaining({
      code: 'field_required_inferred_from_optional_text',
      field: 'fields[1].required'
    })])
    expect(prepared.payload.fields).toMatchObject([
      { id: 'apnName', required: true },
      { id: 'bizDesc', required: false }
    ])
  })

  it('preserves notes as supplementary context while still requiring the primary answer', () => {
    const payload = prepareQuestionInteractionPayload({
      prompt: '请选择模式',
      options: [
        { label: 'VLR', value: 'VLR' },
        { label: 'SGSN', value: 'SGSN' }
      ]
    }).payload

    expect(validateQuestionInteractionAnswer(payload, {
      answer: 'VLR',
      notes: '仅用于回放'
    })).toEqual({
      answer: 'VLR',
      notes: '仅用于回放'
    })

    expect(() => validateQuestionInteractionAnswer(payload, {
      notes: '只有备注'
    })).toThrowError('请选择后再提交。')
  })

  it('returns a generic invalid-option error for default select labels', () => {
    const payload = prepareQuestionInteractionPayload({
      prompt: '请选择模式',
      options: [
        { label: 'VLR', value: 'VLR' },
        { label: 'SGSN', value: 'SGSN' }
      ]
    }).payload

    expect(() => validateQuestionInteractionAnswer(payload, {
      answer: 'UNKNOWN'
    })).toThrowError('所选内容无效，请重新选择。')
  })

  it('builds degraded question payloads and keeps notes in continuation context', () => {
    const payload = buildDegradedQuestionInteractionPayload({
      prompt: '请选择列',
      reason: '结构化问题收集失败，原始选项无法可靠展示。请参考下面的信息手动填写主答案。',
      referenceOptions: ['第一列', '第二列']
    })

    expect(payload.degraded).toEqual({
      reason: '结构化问题收集失败，原始选项无法可靠展示。请参考下面的信息手动填写主答案。',
      referenceOptions: ['第一列', '第二列']
    })
    expect(payload.fields).toMatchObject([
      { id: 'answer', type: 'text', required: true },
      { id: 'notes', type: 'text', required: false }
    ])

    const continuation = buildAnswerContinuationContext({
      interactionId: 'interaction-1',
      payload
    }, {
      answer: '第一列',
      notes: '只处理非空行'
    })

    expect(continuation).toMatchObject({
      type: 'answer',
      answer: {
        answer: '第一列',
        notes: '只处理非空行'
      }
    })
  })

  it('builds a single-text summary from the field label when the prompt is generic', () => {
    expect(buildPendingQuestionSummary({
      prompt: '请补充信息',
      fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
    })).toBe('请提供「列索引」，填写后我会继续。')
  })

  it('builds a single-select summary without expanding options', () => {
    expect(buildPendingQuestionSummary({
      prompt: '请选择你的电脑主要用途：',
      fields: [{
        id: 'answer',
        label: '主要用途',
        type: 'select',
        options: [
          { label: '办公', value: 'office' },
          { label: '游戏', value: 'gaming' }
        ]
      }]
    })).toBe('请选择你的电脑主要用途，选择后我会继续。')
  })

  it('builds a multi-field summary from the prompt and primary field labels', () => {
    expect(buildPendingQuestionSummary({
      prompt: '为了给您推荐最合适的游戏电脑配置，请回答以下问题：',
      fields: [
        {
          id: 'cpuBrand',
          label: 'CPU品牌偏好',
          type: 'select',
          options: [
            { label: 'Intel', value: 'intel' },
            { label: 'AMD', value: 'amd' }
          ]
        },
        {
          id: 'gpuBrand',
          label: '显卡品牌偏好',
          type: 'select',
          options: [
            { label: 'NVIDIA', value: 'nvidia' },
            { label: 'AMD', value: 'amd' }
          ]
        },
        {
          id: 'notes',
          label: '补充说明',
          type: 'text'
        }
      ]
    })).toBe(
      '为了给您推荐最合适的游戏电脑配置，请回答以下问题（需补充：CPU品牌偏好、显卡品牌偏好），补充后我会继续。'
    )
  })

  it('keeps degraded summaries concise without duplicating degraded diagnostics', () => {
    const payload = buildDegradedQuestionInteractionPayload({
      prompt: '请选择列',
      reason: '结构化问题收集失败',
      referenceOptions: ['第一列', '第二列']
    })

    expect(buildPendingQuestionSummary(payload)).toBe('请选择列，填写后我会继续。')
    expect(buildAwaitingInteractionToolSummary(payload)).toContain('"referenceOptions":["第一列","第二列"]')
  })

  it('falls back conservatively when prompt and field labels are unusable', () => {
    expect(buildPendingQuestionSummary({
      prompt: '   ',
      fields: [{ id: 'answer', label: '   ', type: 'text' }]
    })).toBe('需要你的输入后才能继续。')
  })
})
