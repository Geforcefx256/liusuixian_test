import { nextTick, ref, watch, type Ref } from 'vue'

import type { UiMessage } from '@/stores/workbenchStore'

const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 48

type MessageSnapshot = {
  count: number
  lastId: string | null
  lastStatus: UiMessage['status'] | null
  lastTextLength: number
}

function buildMessageSnapshot(messages: readonly UiMessage[]): MessageSnapshot {
  const lastMessage = messages.at(-1) || null
  return {
    count: messages.length,
    lastId: lastMessage?.id || null,
    lastStatus: lastMessage?.status || null,
    lastTextLength: lastMessage?.text.length || 0
  }
}

function didMessagesAdvance(previous: MessageSnapshot, next: MessageSnapshot): boolean {
  if (previous.count !== next.count) {
    return true
  }
  if (previous.lastId !== next.lastId) {
    return true
  }
  return previous.lastStatus !== next.lastStatus || previous.lastTextLength !== next.lastTextLength
}

function isViewportNearBottom(viewport: HTMLElement): boolean {
  const distanceToBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
  return distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX
}

function scrollViewportToBottom(
  viewport: HTMLElement | null,
  sentinel: HTMLElement | null
): void {
  if (sentinel && typeof sentinel.scrollIntoView === 'function') {
    sentinel.scrollIntoView({
      block: 'end',
      behavior: 'auto'
    })
    return
  }
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight
  }
}

export function useConversationAutoScroll(params: {
  messagesRef: Ref<readonly UiMessage[]>
  sessionKeyRef: Ref<string | null | undefined>
  viewportRef: Ref<HTMLElement | null>
  sentinelRef: Ref<HTMLElement | null>
}) {
  const autoScrollEnabled = ref(true)
  const forceNextScroll = ref(false)
  let lastSnapshot = buildMessageSnapshot(params.messagesRef.value)

  function requestAutoScroll(): void {
    autoScrollEnabled.value = true
    forceNextScroll.value = true
  }

  function handleViewportScroll(): void {
    const viewport = params.viewportRef.value
    if (!viewport) {
      return
    }
    autoScrollEnabled.value = isViewportNearBottom(viewport)
  }

  async function scrollToBottom(): Promise<void> {
    await nextTick()
    scrollViewportToBottom(params.viewportRef.value, params.sentinelRef.value)
    forceNextScroll.value = false
    autoScrollEnabled.value = true
  }

  watch(
    params.sessionKeyRef,
    async () => {
      lastSnapshot = buildMessageSnapshot(params.messagesRef.value)
      requestAutoScroll()
      if (!params.messagesRef.value.length) {
        return
      }
      await scrollToBottom()
    },
    { immediate: true }
  )

  watch(
    params.messagesRef,
    async messages => {
      const nextSnapshot = buildMessageSnapshot(messages)
      const shouldScroll = forceNextScroll.value || (
        autoScrollEnabled.value
        && didMessagesAdvance(lastSnapshot, nextSnapshot)
      )
      lastSnapshot = nextSnapshot
      if (!shouldScroll || !messages.length) {
        return
      }
      await scrollToBottom()
    },
    { deep: true }
  )

  return {
    handleViewportScroll,
    requestAutoScroll
  }
}
