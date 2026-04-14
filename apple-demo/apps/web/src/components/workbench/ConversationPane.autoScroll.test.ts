import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import ConversationPane from './ConversationPane.vue'
import type { UiMessage } from '@/stores/workbenchStore'

function buildProps() {
  return {
    title: 'AI MML',
    subtitle: '工作区助手',
    messages: [] as UiMessage[],
    pendingInteraction: null,
    composerDraft: '',
    composerBlocked: false,
    composerSendBlocked: false,
    composerLockReason: null,
    isRunning: false,
    canStopRun: false,
    stopPending: false,
    error: null,
    userAvatarUrl: '',
    userAvatarInitial: '管',
    activeSessionKey: null as string | null,
    editableMessageId: null,
    editRerunTarget: null,
    starterGroups: [],
    searchableSkills: [],
    searchQuery: '',
    selectedStarterSkillId: null as string | null,
    workspaceFileCount: 0
  }
}

function buildAssistantMessage(overrides: Partial<UiMessage> = {}): UiMessage {
  return {
    id: 'assistant-1',
    kind: 'text',
    role: 'assistant',
    text: '处理完成',
    createdAt: 1,
    status: 'done',
    readingModeEligible: false,
    displayMode: 'raw',
    ...overrides
  } as UiMessage
}

function buildQuestionMessage(overrides: Partial<UiMessage> = {}): UiMessage {
  return {
    id: 'interaction-1',
    kind: 'question',
    role: 'assistant',
    text: '请输入补充信息',
    createdAt: 2,
    status: 'done',
    interaction: {
      interactionId: 'interaction-1',
      runId: 'run-1',
      kind: 'question',
      status: 'pending',
      payload: {
        questionId: 'question-1',
        title: '补充信息',
        prompt: '请输入补充信息',
        required: true,
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      },
      createdAt: 2,
      resolvedAt: null
    },
    ...overrides
  } as UiMessage
}

function setViewportMetrics(
  viewport: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }
): void {
  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    value: metrics.scrollHeight
  })
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: metrics.clientHeight
  })
  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    writable: true,
    value: metrics.scrollTop
  })
}

async function flushAutoScroll(): Promise<void> {
  await nextTick()
  await nextTick()
}

describe('ConversationPane auto scroll', () => {
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    scrollIntoView.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls to the latest message when switching sessions', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        activeSessionKey: 'session-a',
        messages: [buildAssistantMessage()]
      }
    })

    await flushAutoScroll()
    expect(scrollIntoView).toHaveBeenCalled()

    scrollIntoView.mockClear()

    await wrapper.setProps({
      activeSessionKey: 'session-b',
      messages: [buildAssistantMessage({ id: 'assistant-2', text: '新会话消息' })]
    })

    await flushAutoScroll()
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('keeps following streamed assistant updates while the viewport stays near the bottom', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        activeSessionKey: 'session-a',
        messages: [buildAssistantMessage({ status: 'streaming', text: '正在' })]
      }
    })

    await flushAutoScroll()
    scrollIntoView.mockClear()

    const viewport = wrapper.get('.conversation-pane__messages').element as HTMLElement
    setViewportMetrics(viewport, {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 760
    })

    await wrapper.get('.conversation-pane__messages').trigger('scroll')
    await wrapper.setProps({
      messages: [buildAssistantMessage({ status: 'streaming', text: '正在生成更长的回复内容' })]
    })

    await flushAutoScroll()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('stops following stream updates after the user scrolls away and resumes near the bottom', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        activeSessionKey: 'session-a',
        messages: [buildAssistantMessage({ status: 'streaming', text: '第一段' })]
      }
    })

    await flushAutoScroll()
    scrollIntoView.mockClear()

    const viewport = wrapper.get('.conversation-pane__messages').element as HTMLElement
    setViewportMetrics(viewport, {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 680
    })

    await wrapper.get('.conversation-pane__messages').trigger('scroll')
    await wrapper.setProps({
      messages: [buildAssistantMessage({ status: 'streaming', text: '第一段 第二段' })]
    })

    await flushAutoScroll()
    expect(scrollIntoView).not.toHaveBeenCalled()

    setViewportMetrics(viewport, {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 752
    })

    await wrapper.get('.conversation-pane__messages').trigger('scroll')
    await wrapper.setProps({
      messages: [buildAssistantMessage({ status: 'streaming', text: '第一段 第二段 第三段' })]
    })

    await flushAutoScroll()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('scrolls to the pending question card when it is appended to the message list', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        activeSessionKey: 'session-a',
        messages: [buildAssistantMessage()]
      }
    })

    await flushAutoScroll()
    scrollIntoView.mockClear()

    await wrapper.setProps({
      messages: [buildAssistantMessage(), buildQuestionMessage()]
    })

    await flushAutoScroll()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
