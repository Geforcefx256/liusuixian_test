import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import type { AgentSessionListItem, AgentSessionUsageSummary } from '@/api/types'
import SessionRail from './SessionRail.vue'
import sessionRailSource from './SessionRail.vue?raw'

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

function buildUsageSummary(overrides: Partial<AgentSessionUsageSummary> = {}): AgentSessionUsageSummary {
  return {
    userId: 1,
    agentId: 'agent-1',
    sessionId: 'session-history',
    totalTokens: 18234,
    inputTokens: 12000,
    outputTokens: 6234,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    assistantMessageCount: 3,
    ...overrides
  }
}

async function openDeleteConfirmation(wrapper: Awaited<ReturnType<typeof openRail>>) {
  await wrapper.findAll('.session-rail__delete')[1].trigger('click')
}

function getConfirmLayer(): HTMLElement {
  const layer = document.body.querySelector('.session-rail__confirm-layer')
  if (!(layer instanceof HTMLElement)) {
    throw new Error('confirmation layer not found')
  }
  return layer
}

function getConfirmButton(selector: string): HTMLButtonElement {
  const button = document.body.querySelector(selector)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${selector}`)
  }
  return button
}

describe('SessionRail', () => {
  it('opens the dropdown history panel from the trigger button and closes on outside click', async () => {
    const wrapper = await openRail()

    expect(wrapper.find('.session-rail__expanded').exists()).toBe(true)
    expect(wrapper.text()).toContain('历史会话')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('.session-rail__expanded').exists()).toBe(false)
    wrapper.unmount()
  })

  it('uses an icon-only trigger with a history tooltip', () => {
    const wrapper = mount(SessionRail, {
      props: {
        sessions: [buildSession({ sessionId: 'session-current', title: 'Current' })],
        activeSessionId: 'session-current'
      }
    })

    const trigger = wrapper.get('[aria-label="历史会话"]')

    expect(trigger.attributes('title')).toBeUndefined()
    expect(trigger.text().trim()).toBe('')
    expect(wrapper.get('.session-rail__tooltip').text()).toBe('历史会话')
    expect(sessionRailSource).toContain('.session-rail__trigger {')
    expect(sessionRailSource).toContain('border: 0;')
    expect(sessionRailSource).toContain('.session-rail__tooltip {')
    expect(sessionRailSource).toContain('pointer-events: none;')
    wrapper.unmount()
  })

  it('closes the dropdown panel after selecting a session from the list', async () => {
    const wrapper = await openRail()

    await wrapper.findAll('.session-rail__item')[1].trigger('click')

    expect(wrapper.emitted('select-session')).toEqual([['session-history']])
    expect(wrapper.find('.session-rail__expanded').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the dropdown panel on escape', async () => {
    const wrapper = await openRail()

    await wrapper.get('.session-rail').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('.session-rail__expanded').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens and cancels single-session deletion without emitting delete-session', async () => {
    const wrapper = await openRail()

    await openDeleteConfirmation(wrapper)

    const layer = getConfirmLayer()

    expect(layer.textContent).toContain('删除会话？')
    expect(layer.textContent).toContain('会话：History')
    expect(wrapper.emitted('delete-session')).toBeUndefined()

    getConfirmButton('.session-rail-confirm__cancel').click()
    await nextTick()

    expect(document.body.querySelector('.session-rail__confirm-layer')).toBeNull()
    expect(wrapper.emitted('delete-session')).toBeUndefined()
    wrapper.unmount()
  })

  it('dismisses single-session deletion on outside click and Esc without accidental requests', async () => {
    const wrapper = await openRail()

    await openDeleteConfirmation(wrapper)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(document.body.querySelector('.session-rail__confirm-layer')).toBeNull()
    expect(wrapper.emitted('delete-session')).toBeUndefined()

    await openDeleteConfirmation(wrapper)
    await wrapper.get('.session-rail').trigger('keydown', { key: 'Escape' })

    expect(document.body.querySelector('.session-rail__confirm-layer')).toBeNull()
    expect(wrapper.find('.session-rail__expanded').exists()).toBe(true)
    expect(wrapper.emitted('delete-session')).toBeUndefined()
    wrapper.unmount()
  })

  it('confirms single-session deletion inside the centered modal', async () => {
    const wrapper = await openRail()

    await openDeleteConfirmation(wrapper)

    getConfirmButton('.session-rail-confirm__confirm').click()
    await nextTick()

    expect(wrapper.emitted('delete-session')).toEqual([['session-history']])
    wrapper.unmount()
  })

  it('keeps the current session highlighted in the history list', async () => {
    const wrapper = await openRail()

    const items = wrapper.findAll('.session-rail__item')
    expect(items[0]?.classes()).toContain('session-rail__item--active')
    expect(items[1]?.classes()).not.toContain('session-rail__item--active')
    wrapper.unmount()
  })

  it('hides per-session preview text and bulk-clear entry points', async () => {
    const wrapper = await openRail()

    expect(wrapper.find('.session-rail__preview').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('清空历史会话')
    expect(wrapper.find('[aria-label="更多操作"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps search behavior available without showing preview text', async () => {
    const wrapper = await openRail()

    await wrapper.get('.session-rail__search input').setValue('history')

    expect(wrapper.findAll('.session-rail__item')).toHaveLength(1)
    expect(wrapper.text()).toContain('History')
    wrapper.unmount()
  })

  it('shows the simplified empty copy when no sessions match the search query', async () => {
    const wrapper = await openRail()

    await wrapper.get('.session-rail__search input').setValue('missing-session')

    expect(wrapper.text()).toContain('没有匹配的会话。')
    expect(wrapper.text()).not.toContain('请换个关键词')
    wrapper.unmount()
  })

  it('renders a weak token badge for admins when session usage is available', async () => {
    const wrapper = mount(SessionRail, {
      props: {
        sessions: [
          buildSession({ sessionId: 'session-current', title: 'Current' }),
          buildSession({ sessionId: 'session-history', title: 'History', updatedAt: 1711440000001 })
        ],
        activeSessionId: 'session-current',
        showUsage: true,
        sessionUsageById: {
          'session-history': {
            loading: false,
            summary: buildUsageSummary(),
            error: null
          }
        }
      },
      attachTo: document.body
    })

    await wrapper.get('[aria-label="历史会话"]').trigger('click')

    expect(wrapper.text()).toContain('18.2k tok')
    expect(wrapper.find('.session-rail__usage-badge').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not render token usage metadata for non-admin views', async () => {
    const wrapper = mount(SessionRail, {
      props: {
        sessions: [buildSession({ sessionId: 'session-history', title: 'History' })],
        activeSessionId: null,
        showUsage: false,
        sessionUsageById: {
          'session-history': {
            loading: false,
            summary: buildUsageSummary(),
            error: null
          }
        }
      },
      attachTo: document.body
    })

    await wrapper.get('[aria-label="历史会话"]').trigger('click')

    expect(wrapper.find('.session-rail__usage-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps list interaction available when usage loading fails', async () => {
    const wrapper = mount(SessionRail, {
      props: {
        sessions: [buildSession({ sessionId: 'session-history', title: 'History' })],
        activeSessionId: null,
        showUsage: true,
        sessionUsageById: {
          'session-history': {
            loading: false,
            summary: null,
            error: 'usage failed'
          }
        }
      },
      attachTo: document.body
    })

    await wrapper.get('[aria-label="历史会话"]').trigger('click')
    await wrapper.get('.session-rail__item').trigger('click')

    expect(wrapper.emitted('select-session')).toEqual([['session-history']])
    expect(wrapper.find('.session-rail__usage-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows per-session activity badges and allows delete confirmation for active history sessions', async () => {
    const wrapper = mount(SessionRail, {
      props: {
        sessions: [
          buildSession({ sessionId: 'session-current', title: 'Current' }),
          buildSession({
            sessionId: 'session-history',
            title: 'History',
            updatedAt: 1711440000001,
            activity: {
              active: true,
              state: 'awaiting-question',
              runId: null
            }
          })
        ],
        activeSessionId: 'session-current'
      },
      attachTo: document.body
    })

    await wrapper.get('[aria-label="历史会话"]').trigger('click')

    expect(wrapper.text()).toContain('待回答')
    const deleteButtons = wrapper.findAll('.session-rail__delete')
    expect(deleteButtons[0]?.attributes('disabled')).toBeUndefined()
    expect(deleteButtons[1]?.attributes('disabled')).toBeUndefined()

    await deleteButtons[1]?.trigger('click')

    const layer = getConfirmLayer()
    expect(layer.textContent).toContain('该会话正在处理中，删除后会立即终止并清理状态。')
    expect(layer.textContent).toContain('删除后不可恢复。')
    wrapper.unmount()
  })

  it('renders the dropdown panel under the trigger instead of reserving a permanent left rail width', async () => {
    const wrapper = await openRail()

    expect(wrapper.find('.session-rail__expanded').exists()).toBe(true)
    expect(sessionRailSource).toContain('.session-rail__expanded {')
    expect(sessionRailSource).toContain('position: absolute;')
    expect(sessionRailSource).toContain('top: calc(100% + 10px);')
    expect(sessionRailSource).toContain('left: 0;')
    expect(sessionRailSource).not.toContain('writing-mode: vertical-rl;')
    expect(sessionRailSource).toContain('font-size: var(--font-overline);')
    expect(sessionRailSource).toContain('font-size: var(--font-title);')
    expect(sessionRailSource).toContain('font-size: var(--font-meta);')
    wrapper.unmount()
  })
})
