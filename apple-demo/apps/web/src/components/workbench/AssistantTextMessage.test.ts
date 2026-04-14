import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import AssistantTextMessage from './AssistantTextMessage.vue'
import assistantTextMessageSource from './AssistantTextMessage.vue?raw'
import type { UiTextMessage } from '@/stores/workbenchStore'

function buildMessage(overrides: Partial<UiTextMessage> = {}): UiTextMessage {
  return {
    id: 'assistant-1',
    kind: 'text',
    role: 'assistant',
    text: '# 标题\n\nhttps://example.com/' + 'segment'.repeat(20),
    createdAt: 1,
    status: 'done',
    readingModeEligible: true,
    displayMode: 'reading',
    ...overrides
  }
}

describe('AssistantTextMessage', () => {
  it('renders eligible assistant content in reading mode', () => {
    const wrapper = mount(AssistantTextMessage, {
      props: {
        message: buildMessage(),
        timestamp: '12:00'
      }
    })

    expect(wrapper.find('.assistant-text-message__reading').exists()).toBe(true)
    expect(wrapper.text()).toContain('标题')
  })

  it('keeps long markdown tokens inside the chat bubble styles', () => {
    expect(assistantTextMessageSource).toContain('.assistant-text-message__raw {')
    expect(assistantTextMessageSource).toContain('overflow-wrap: anywhere;')
    expect(assistantTextMessageSource).toContain('word-break: break-word;')
    expect(assistantTextMessageSource).toContain('.assistant-text-message__reading {')
    expect(assistantTextMessageSource).toContain('max-width: 100%;')
    expect(assistantTextMessageSource).toContain('.assistant-text-message__reading :deep(a) {')
    expect(assistantTextMessageSource).toContain('.assistant-text-message__reading :deep(code) {')
    expect(assistantTextMessageSource).toContain('.assistant-text-message__reading :deep(pre) {')
    expect(assistantTextMessageSource).toContain('overflow-wrap: normal;')
    expect(assistantTextMessageSource).toContain('word-break: normal;')
  })
})
