<template>
  <div ref="railRoot" class="session-rail" @keydown.esc.stop="handleEscape">
    <div class="session-rail__trigger-wrap">
      <button
        ref="historyTrigger"
        class="session-rail__trigger"
        type="button"
        aria-label="历史会话"
        :aria-expanded="isExpanded"
        @click="toggleExpanded"
      >
        <svg viewBox="0 0 24 24" class="icon-svg" aria-hidden="true">
          <path d="M12 7v5l3 2" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      </button>
      <span class="session-rail__tooltip" aria-hidden="true">历史会话</span>
    </div>

    <div v-if="isExpanded" id="session-rail-panel" class="session-rail__expanded" role="dialog" aria-label="历史会话">
      <div class="session-rail__header">
        <div>
          <p class="session-rail__eyebrow">历史会话</p>
          <h2>最近任务</h2>
        </div>
      </div>

      <label class="session-rail__search">
        <svg viewBox="0 0 24 24" class="icon-svg">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span class="visually-hidden">搜索会话</span>
        <input v-model="query" type="search" placeholder="搜索会话..." />
      </label>

      <div v-if="loading" class="session-rail__empty">会话列表加载中...</div>
      <div v-else-if="filteredSessions.length === 0" class="session-rail__empty">没有匹配的会话。</div>

      <div v-else class="session-rail__list">
        <div
          v-for="session in filteredSessions"
          :key="session.sessionId"
          class="session-rail__item-wrap"
        >
          <button
            class="session-rail__item"
            :class="{ 'session-rail__item--active': session.sessionId === activeSessionId }"
            type="button"
            @click="handleSelectSession(session.sessionId)"
          >
            <div class="session-rail__item-top">
              <strong>
                {{ session.title }}
                <span
                  v-if="session.activity.active"
                  class="session-rail__owner-badge"
                  :title="resolveActivityBadgeTitle(session)"
                >
                  {{ resolveActivityBadgeLabel(session) }}
                </span>
              </strong>
              <span>{{ formatTime(session.updatedAt) }}</span>
            </div>
            <div v-if="resolveSessionUsageLabel(session.sessionId)" class="session-rail__item-meta">
              <span class="session-rail__usage-badge">{{ resolveSessionUsageLabel(session.sessionId) }}</span>
            </div>
          </button>
          <button
            class="session-rail__delete"
            type="button"
            aria-label="删除会话"
            :aria-expanded="isDeleteConfirmationOpen(session.sessionId)"
            @click.stop="openDeleteConfirmation(session, $event)"
          >
            <svg viewBox="0 0 24 24" class="icon-svg">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="isDialogConfirmationOpen" class="session-rail__confirm-layer">
      <div class="session-rail__confirm-backdrop" @click="closeSurface(false)"></div>
      <div ref="dialogConfirmRoot" class="session-rail__confirm-shell">
        <SessionRailConfirmSurface
          variant="dialog"
          :title="dialogConfirmationTitle"
          :context="dialogConfirmationContext"
          :detail-lines="dialogConfirmationLines"
          :confirm-label="dialogConfirmationLabel"
          @cancel="closeSurface()"
          @confirm="confirmDelete"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { AgentSessionListItem, AgentSessionUsageSummary } from '@/api/types'

import SessionRailConfirmSurface from './SessionRailConfirmSurface.vue'

type ActiveSurface = { readonly kind: 'delete'; readonly sessionId: string; readonly title: string } | null

interface SessionUsageDisplayState {
  loading: boolean
  summary: AgentSessionUsageSummary | null
  error: string | null
}

const props = defineProps<{
  sessions: AgentSessionListItem[]
  activeSessionId: string | null
  loading?: boolean
  showUsage?: boolean
  sessionUsageById?: Record<string, SessionUsageDisplayState | undefined>
}>()

const emit = defineEmits<{
  (event: 'select-session', sessionId: string): void
  (event: 'delete-session', sessionId: string): void
  (event: 'request-session-usage', sessionIds: string[]): void
}>()

const query = ref('')
const isExpanded = ref(false)
const railRoot = ref<HTMLElement | null>(null)
const dialogConfirmRoot = ref<HTMLElement | null>(null)
const historyTrigger = ref<HTMLButtonElement | null>(null)
const surfaceTrigger = ref<HTMLElement | null>(null)
const activeSurface = ref<ActiveSurface>(null)

const filteredSessions = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized) {
    return props.sessions
  }
  return props.sessions.filter(session => {
    const haystack = [session.title, session.preview, formatTime(session.updatedAt)].join(' ').toLowerCase()
    return haystack.includes(normalized)
  })
})

const deleteConfirmation = computed(() => {
  return activeSurface.value?.kind === 'delete' ? activeSurface.value : null
})
const isDialogConfirmationOpen = computed(() => activeSurface.value?.kind === 'delete')
const dialogConfirmationTitle = computed(() => '删除会话？')
const dialogConfirmationContext = computed(() => {
  if (activeSurface.value?.kind !== 'delete') {
    return undefined
  }
  return activeSurface.value.title
})
const dialogConfirmationLines = computed(() => {
  if (activeSurface.value?.kind === 'delete') {
    const targetSession = props.sessions.find(session => session.sessionId === deleteConfirmation.value?.sessionId)
    if (targetSession?.activity.active) {
      return ['该会话正在处理中，删除后会立即终止并清理状态。', '删除后不可恢复。']
    }
    return ['删除后不可恢复。']
  }
  return []
})

watch(isExpanded, expanded => {
  if (expanded) {
    requestVisibleSessionUsage()
  }
})

watch(filteredSessions, () => {
  requestVisibleSessionUsage()
})

watch(() => props.showUsage, showUsage => {
  if (showUsage) {
    requestVisibleSessionUsage()
  }
})
const dialogConfirmationLabel = computed(() => '删除会话')

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getEventTrigger(event: MouseEvent): HTMLElement | null {
  return event.currentTarget instanceof HTMLElement ? event.currentTarget : null
}

function isDeleteConfirmationOpen(sessionId: string): boolean {
  return deleteConfirmation.value?.sessionId === sessionId
}

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
  if (!isExpanded.value) {
    closeSurface(false)
  }
}

function requestVisibleSessionUsage(): void {
  if (!isExpanded.value || !props.showUsage) {
    return
  }
  const sessionIds = filteredSessions.value.map(session => session.sessionId)
  if (sessionIds.length > 0) {
    emit('request-session-usage', sessionIds)
  }
}

function closeExpanded(restoreFocus = false): void {
  isExpanded.value = false
  closeSurface(false)
  if (restoreFocus) {
    historyTrigger.value?.focus()
  }
}

function handleEscape(): void {
  if (activeSurface.value) {
    closeSurface()
    return
  }
  if (isExpanded.value) {
    closeExpanded(true)
  }
}

function setActiveSurface(nextSurface: Exclude<ActiveSurface, null>, trigger: HTMLElement | null): void {
  surfaceTrigger.value = trigger
  activeSurface.value = nextSurface
}

function closeSurface(restoreFocus = true): void {
  activeSurface.value = null
  if (!restoreFocus) {
    surfaceTrigger.value = null
    return
  }
  const trigger = surfaceTrigger.value
  surfaceTrigger.value = null
  if (trigger?.isConnected) {
    trigger.focus()
  }
}

function handleSelectSession(sessionId: string): void {
  emit('select-session', sessionId)
  closeExpanded()
}

function openDeleteConfirmation(session: AgentSessionListItem, event: MouseEvent): void {
  setActiveSurface({ kind: 'delete', sessionId: session.sessionId, title: session.title }, getEventTrigger(event))
}

function confirmDelete(): void {
  if (!deleteConfirmation.value) {
    return
  }
  const sessionId = deleteConfirmation.value.sessionId
  closeSurface(false)
  emit('delete-session', sessionId)
}

function resolveActivityBadgeLabel(session: AgentSessionListItem): string {
  if (session.activity.state === 'awaiting-question') {
    return '待回答'
  }
  if (session.activity.state === 'stop-pending') {
    return '停止中'
  }
  return '运行中'
}

function resolveActivityBadgeTitle(session: AgentSessionListItem): string {
  if (session.activity.state === 'awaiting-question') {
    return '该会话正在等待问题回答。'
  }
  if (session.activity.state === 'stop-pending') {
    return '该会话正在等待停止结果。'
  }
  return '该会话当前正在运行。'
}

function resolveSessionUsageLabel(sessionId: string): string | null {
  if (!props.showUsage) {
    return null
  }
  const state = props.sessionUsageById?.[sessionId]
  if (!state || state.loading || state.error || !state.summary) {
    return null
  }
  return `${formatTokenCount(state.summary.totalTokens)} tok`
}

function formatTokenCount(totalTokens: number): string {
  if (totalTokens < 1000) {
    return String(totalTokens)
  }
  if (totalTokens < 100000) {
    return `${(totalTokens / 1000).toFixed(1)}k`
  }
  if (totalTokens < 1000000) {
    return `${Math.round(totalTokens / 1000)}k`
  }
  return `${(totalTokens / 1000000).toFixed(1)}m`
}

function handleDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }
  if (isDialogConfirmationOpen.value) {
    if (!dialogConfirmRoot.value?.contains(target)) {
      closeSurface(false)
    }
    return
  }
  if (isExpanded.value && !railRoot.value?.contains(target)) {
    closeExpanded(false)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.session-rail {
  position: relative;
  display: inline-flex;
  align-items: center;
  z-index: 1;
}

.session-rail__trigger-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.session-rail__trigger,
.session-rail__delete {
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  transition: 0.15s ease;
}

.session-rail__trigger {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.session-rail__trigger:hover,
.session-rail__trigger:focus-visible,
.session-rail__trigger[aria-expanded='true'] {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  outline: none;
}

.session-rail__trigger-wrap:hover .session-rail__tooltip,
.session-rail__trigger-wrap:focus-within .session-rail__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.session-rail__tooltip {
  position: absolute;
  left: 50%;
  top: calc(100% + 6px);
  transform: translate(-50%, -4px);
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.session-rail__expanded {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: clamp(320px, 34vw, 420px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
  z-index: 30;
}

.session-rail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.session-rail__eyebrow {
  margin: 0 0 4px;
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  color: var(--text-small);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.session-rail__header h2 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.session-rail__search {
  position: relative;
}

.session-rail__search .icon-svg {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.session-rail__search input {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 32px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: var(--surface-subtle);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.session-rail__list {
  max-block-size: min(24rem, 56dvh);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-rail__item-wrap {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.session-rail__item {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  transition: 0.15s ease;
}

.session-rail__item:hover,
.session-rail__item--active {
  background: var(--accent-lighter);
  border-color: var(--accent-light);
}

.session-rail__item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.session-rail__item-top strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.session-rail__item-top span {
  flex-shrink: 0;
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  color: var(--text-small);
}

.session-rail__item-meta {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
}

.session-rail__usage-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-small);
  font-size: 11px;
  line-height: 1.2;
}

.session-rail__owner-badge {
  margin-left: 6px;
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: var(--accent);
  font-size: 11px;
  line-height: 1.2;
  vertical-align: middle;
}

.session-rail__delete {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.session-rail__delete:hover,
.session-rail__delete:focus-visible {
  background: rgba(37, 99, 235, 0.08);
  color: var(--accent);
}

.session-rail__delete:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.session-rail__confirm-layer {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 36;
}

.session-rail__confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(8px);
}

.session-rail__confirm-shell {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  z-index: 1;
}

.session-rail__empty {
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed var(--line-subtle);
  background: var(--surface-subtle);
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  text-align: center;
}
</style>
