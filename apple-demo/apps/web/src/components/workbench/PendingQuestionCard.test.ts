import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PendingQuestionCard from './PendingQuestionCard.vue'
import type { AgentSessionInteraction } from '@/api/types'

const pendingQuestionCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/workbench/PendingQuestionCard.vue'),
  'utf8'
)

function buildInteraction(overrides: Partial<AgentSessionInteraction> = {}): AgentSessionInteraction {
  return {
    interactionId: 'interaction-1',
    runId: 'run-1',
    kind: 'question',
    status: 'pending',
    payload: {
      questionId: 'question-1',
      title: '补充信息',
      prompt: '请输入任务信息',
      required: true,
      fields: [{ id: 'task', label: '任务', type: 'text' }]
    },
    createdAt: 1,
    resolvedAt: null,
    ...overrides
  }
}

describe('PendingQuestionCard', () => {
  it('blocks submit when required text values are missing', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction()
      }
    })

    await wrapper.get('.primary-btn').trigger('click')

    expect(wrapper.text()).toContain('请填写任务')
    expect(wrapper.text()).toContain('请先补全必填项。')
    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  it('keeps required select fields unanswered until the user explicitly chooses an option', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction({
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请选择模式',
            required: true,
            fields: [{
              id: 'mode',
              label: '模式',
              type: 'select',
              placeholder: '请选择',
              options: [
                { label: 'VLR', value: 'VLR' },
                { label: 'SGSN', value: 'SGSN' }
              ]
            }]
          }
        })
      }
    })

    await wrapper.get('.primary-btn').trigger('click')

    expect(wrapper.text()).toContain('请填写模式')
    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  it('renders select placeholder as a visible disabled option with placeholder styling', () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction({
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请选择模式',
            required: true,
            fields: [{
              id: 'mode',
              label: '模式',
              type: 'select',
              placeholder: '请选择',
              options: [
                { label: 'VLR', value: 'VLR' },
                { label: 'SGSN', value: 'SGSN' }
              ]
            }]
          }
        })
      }
    })

    const option = wrapper.get('select option[value=""]')
    const select = wrapper.get('select')
    expect(option.attributes('disabled')).toBeDefined()
    expect(option.attributes('hidden')).toBeUndefined()
    expect(option.classes()).toContain('pending-question-card__placeholder-option')
    expect(select.classes()).toContain('pending-question-card__input--placeholder')
  })

  it('uses field-level requiredness before falling back to question defaults', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction({
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请输入任务信息',
            required: true,
            fields: [
              { id: 'task', label: '任务', type: 'text', required: true },
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
          }
        })
      }
    })

    await wrapper.get('input').setValue('提取指标')
    await wrapper.get('.primary-btn').trigger('click')

    expect(wrapper.emitted('reply')).toEqual([[
      {
        task: '提取指标'
      }
    ]])
  })

  it('emits resolved answers for text and select fields', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction({
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请输入任务和模式',
            required: true,
            fields: [
              { id: 'task', label: '任务', type: 'text', required: true },
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
          }
        })
      }
    })

    await wrapper.get('input').setValue('提取指标')
    await wrapper.get('select').setValue(JSON.stringify('VLR'))
    await wrapper.get('.primary-btn').trigger('click')

    expect(wrapper.emitted('reply')).toEqual([[
      {
        task: '提取指标',
        mode: 'VLR'
      }
    ]])
  })

  it('emits reject from the secondary action', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction()
      }
    })

    expect(wrapper.get('.secondary-btn').text()).toBe('跳过')
    await wrapper.get('.secondary-btn').trigger('click')

    expect(wrapper.emitted('reject')).toEqual([[]])
  })

  it('uses a fixed primary action label', () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction()
      }
    })

    expect(wrapper.get('.primary-btn').text()).toBe('确认')
  })

  it('renders one shared notes field for select questions and submits it separately', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction({
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请选择模式',
            required: true,
            fields: [
              {
                id: 'answer',
                label: '模式',
                type: 'select',
                options: [
                  { label: 'VLR', value: 'VLR' },
                  { label: 'SGSN', value: 'SGSN' }
                ]
              },
              {
                id: 'notes',
                label: '补充说明',
                type: 'text',
                required: false,
                placeholder: '可选说明'
              }
            ]
          }
        })
      }
    })

    const inputs = wrapper.findAll('input')
    await wrapper.get('select').setValue(JSON.stringify('VLR'))
    await inputs[0]?.setValue('只看 VLR 分支')
    await wrapper.get('.primary-btn').trigger('click')

    expect(wrapper.emitted('reply')).toEqual([[
      {
        answer: 'VLR',
        notes: '只看 VLR 分支'
      }
    ]])
  })

  it('renders degraded question guidance and submits answer plus notes through reply', async () => {
    const wrapper = mount(PendingQuestionCard, {
      props: {
        interaction: buildInteraction({
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请选择列',
            required: true,
            degraded: {
              reason: '结构化问题收集失败，请手动填写。',
              referenceOptions: ['第一列', '第二列']
            },
            fields: [
              { id: 'answer', label: '手动回答', type: 'text', required: true },
              { id: 'notes', label: '补充说明', type: 'text', required: false }
            ]
          }
        })
      }
    })

    const inputs = wrapper.findAll('input')
    expect(wrapper.text()).toContain('结构化问题收集失败，请手动填写。')
    expect(wrapper.text()).toContain('第一列')
    expect(wrapper.text()).toContain('第二列')

    await inputs[0]?.setValue('第一列')
    await inputs[1]?.setValue('只处理非空值')
    await wrapper.get('.primary-btn').trigger('click')

    expect(wrapper.emitted('reply')).toEqual([[
      {
        answer: '第一列',
        notes: '只处理非空值'
      }
    ]])
  })

  it('applies the updated card accent and spacing styles', () => {
    expect(pendingQuestionCardSource).toContain('border-left: 3px solid rgba(42, 88, 128, 0.5);')
    expect(pendingQuestionCardSource).toContain('min-height: 44px;')
    expect(pendingQuestionCardSource).toContain('gap: 12px;')
  })
})
