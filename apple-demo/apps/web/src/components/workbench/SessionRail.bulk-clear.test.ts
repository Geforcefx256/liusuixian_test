import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import type { AgentSessionListItem } from '@/api/types'
import SessionRail from './SessionRail.vue'

function buildSession(overrides: Partial<AgentSessionListItem> = {}): AgentSessionListItem {
  return {
    userId: 1,
    agentId: 'agent-1',
    sessionId: 'session-1',
    title: 'Alpha',
    createdAt: 1,
    updatedAt: 1711440000000,
    messageCount: 1,
    preview: 'preview',
    activity: {
      active: false,
      state: 'idle' as const,
      runId: null
    },
    activePrimaryAgent: 'build' as const,
    planState: null,
    ...overrides
  }
}

async function openRail() {
  const wrapper = mount(SessionRail, {
    props: {
      sessions: [
        buildSession({ sessionId: 'session-current', title: 'Current' }),
        buildSession({ sessionId: 'session-history', title: 'History', updatedAt: 1711440000001 })
      ],
      activeSessionId: 'session-current'
    },
    attachTo: document.body
  })

  await wrapper.get('[aria-label="历史会话"]').trigger('click')
  return wrapper
}

function getButtonElement(wrapper: { element: Element }): HTMLButtonElement {
  if (!(wrapper.element instanceof HTMLButtonElement)) {
    throw new Error('button element not found')
  }
  return wrapper.element
}

function getConfirmButton(selector: string): HTMLButtonElement {
  const button = document.body.querySelector(selector)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${selector}`)
  }
  return button
}

describe('SessionRail focus management', () => {
  it('restores focus to the history trigger after closing the dropdown with Escape', async () => {
    const wrapper = await openRail()
    const historyTrigger = getButtonElement(wrapper.get('[aria-label="历史会话"]'))

    historyTrigger.focus()
    await nextTick()

    await wrapper.get('.session-rail').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('.session-rail__expanded').exists()).toBe(false)
    expect(document.activeElement).toBe(historyTrigger)
    wrapper.unmount()
  })

  it('restores focus to the delete trigger after cancelling single-session deletion', async () => {
    const wrapper = await openRail()
    const deleteButtonWrapper = wrapper.findAll('.session-rail__delete')[1]
    const deleteButton = getButtonElement(deleteButtonWrapper!)

    deleteButton.focus()
    await nextTick()
    await deleteButtonWrapper!.trigger('click')

    expect(document.body.querySelector('.session-rail__confirm-layer')).not.toBeNull()

    getConfirmButton('.session-rail-confirm__cancel').click()
    await nextTick()

    expect(document.body.querySelector('.session-rail__confirm-layer')).toBeNull()
    expect(document.activeElement).toBe(deleteButton)
    expect(wrapper.emitted('delete-session')).toBeUndefined()
    wrapper.unmount()
  })
})
