import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProtocolMessageCard from './ProtocolMessageCard.vue'
import type { UiProtocolMessage } from '@/stores/workbenchStore'

function buildMessage(): UiProtocolMessage {
  return {
    id: 'protocol-1',
    kind: 'protocol',
    role: 'assistant',
    text: '{"version":"1.0"}',
    createdAt: 1,
    status: 'done',
    protocolState: null,
    protocol: {
      version: '1.0',
      components: [
        { type: 'text', id: 'title', content: '协议标题', style: 'heading' },
        { type: 'text', id: 'hint', content: '补充说明', style: 'muted' },
        {
          type: 'list',
          id: 'choices',
          label: '选择一项',
          selectable: true,
          selectionMode: 'single',
          items: [
            { id: 'item-1', title: '选项一', description: '第一项' },
            { id: 'item-2', title: '选项二' }
          ]
        },
        {
          type: 'form',
          id: 'question-form',
          fields: [
            { id: 'task', label: '任务', type: 'text', value: '', required: true, placeholder: '请输入任务' },
            {
              id: 'mode',
              label: '模式',
              type: 'select',
              value: 'A',
              options: [
                { label: '模式 A', value: 'A' },
                { label: '模式 B', value: 'B' }
              ]
            }
          ]
        },
        {
          type: 'table',
          id: 'table-1',
          label: '参数表',
          editable: true,
          columns: [
            { id: 'name', label: '名称', editable: false },
            { id: 'value', label: '值', editable: true }
          ],
          rows: [
            { name: 'alpha', value: '1' },
            { name: 'beta', value: '2' }
          ]
        },
        {
          type: 'button-group',
          id: 'group-1',
          buttons: [
            { id: 'primary', label: '主动作', actionId: 'submit-primary' }
          ]
        },
        {
          type: 'chart',
          id: 'unsupported-1'
        }
      ],
      actions: [
        {
          id: 'submit-primary',
          label: '主动作',
          type: 'submit',
          tool: 'question_response',
          toolInput: {
            questionId: 'question-1',
            answer: '${form.question-form}'
          }
        },
        {
          id: 'secondary',
          label: '备用动作',
          type: 'cancel'
        }
      ]
    }
  }
}

describe('ProtocolMessageCard', () => {
  it('renders the expanded protocol surface and emits interaction state updates', async () => {
    const wrapper = mount(ProtocolMessageCard, {
      props: {
        message: buildMessage()
      }
    })

    expect(wrapper.text()).toContain('协议标题')
    expect(wrapper.find('.protocol-card__text--heading').exists()).toBe(true)
    expect(wrapper.text()).toContain('选项一')
    expect(wrapper.text()).toContain('参数表')
    expect(wrapper.text()).toContain('暂未完整支持的协议组件：chart')
    expect(wrapper.text()).toContain('备用动作')

    await wrapper.get('.protocol-card__item-btn').trigger('click')
    await wrapper.get('input[placeholder="请输入任务"]').setValue('补齐参数')
    await wrapper.get('select').setValue('1')
    await wrapper.get('.protocol-card__table-input').setValue('9')
    await wrapper.get('.protocol-card__button').trigger('click')

    const emittedStates = (wrapper.emitted('state-change') || []).map(args => args[0] as Record<string, unknown>)
    expect(emittedStates.some(state => {
      return JSON.stringify(state.listSelection) === JSON.stringify({ choices: ['item-1'] })
    })).toBe(true)
    expect(emittedStates.some(state => {
      return JSON.stringify(state.form) === JSON.stringify({
        'question-form': {
          task: '补齐参数',
          mode: 'A'
        }
      })
    })).toBe(true)
    expect(emittedStates.some(state => {
      return JSON.stringify(state.form) === JSON.stringify({
        'question-form': {
          task: '',
          mode: 'B'
        }
      })
    })).toBe(true)
    expect(emittedStates.some(state => {
      return JSON.stringify(state.table) === JSON.stringify({
        'table-1': {
          columns: [
            { id: 'name', label: '名称', editable: false },
            { id: 'value', label: '值', editable: true }
          ],
          rows: [
            { name: 'alpha', value: '9' },
            { name: 'beta', value: '2' }
          ]
        }
      })
    })).toBe(true)
    expect(wrapper.emitted('action')?.[0]?.[0]).toMatchObject({
      id: 'submit-primary',
      tool: 'question_response'
    })
  })

  it('renders select placeholder as hidden and disabled when no option is selected', () => {
    const message = buildMessage()
    const formComponent = message.protocol.components.find(component => component.type === 'form') as {
      fields: Array<Record<string, unknown>>
    }
    const modeField = formComponent.fields.find(field => field.id === 'mode') as Record<string, unknown>
    modeField.value = ''

    const wrapper = mount(ProtocolMessageCard, {
      props: {
        message
      }
    })

    const placeholderOption = wrapper.get('select option[value=""]')
    expect(placeholderOption.text()).toBe('请选择')
    expect(placeholderOption.attributes('disabled')).toBeDefined()
    expect(placeholderOption.attributes('hidden')).toBeDefined()
  })
})
