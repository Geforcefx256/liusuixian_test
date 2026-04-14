<template>
  <section class="conversation-pane agent-rail-surface">
    <div class="conversation-pane__body">
      <div v-if="messages.length === 0" class="conversation-pane__empty-shell">
        <div class="conversation-pane__surface-measure">
          <section class="conversation-pane__quick-starts card-shell">
            <div class="conversation-pane__section-head">
              <div>
                  <h3>快速开始</h3>
              </div>
            </div>

            <div class="conversation-pane__starter-grid">
              <div
                v-for="(group, groupIndex) in starterGroups"
                :key="group.id"
                class="conversation-pane__starter-card"
                :class="{ 'conversation-pane__starter-card--active': isStarterGroupActive(group) }"
              >
                <div class="conversation-pane__starter-copy">
                  <p class="conversation-pane__starter-title">{{ group.title }}</p>
                  <small>{{ group.subtitle }}</small>
                  <ul v-if="group.previewSkills.length" class="conversation-pane__starter-preview">
                    <li
                      v-for="skill in group.previewSkills"
                      :key="`${group.id}-${skill.id}`"
                      class="conversation-pane__starter-preview-item"
                      :class="{ 'conversation-pane__starter-preview-item--selected': selectedStarterSkillId === skill.id }"
                    >
                      <button
                        type="button"
                        class="conversation-pane__skill-toggle"
                        @click="handleSkillClick(skill.id)"
                      >
                        {{ skill.governedTitleText }}
                      </button>
                      <div v-if="selectedStarterSkillId === skill.id" class="conversation-pane__skill-detail">
                        <p class="conversation-pane__starter-summary">{{ skill.starterSummaryText }}</p>
                        <div class="conversation-pane__starter-action-row">
                          <button
                            type="button"
                            class="conversation-pane__starter-action"
                            @click="handleStartUse(skill)"
                          >
                            开始使用
                          </button>
                          <StarterSkillHoverHelp
                            :placement="resolveStarterHelpPlacement(groupIndex)"
                            :skill="skill"
                          />
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section class="conversation-pane__more-search card-shell">
            <button
              class="conversation-pane__search-toggle"
              type="button"
              :aria-expanded="isSearchPanelVisible"
              @click="toggleSearchPanel"
            >
              <div>
                <h3>更多搜索</h3>
                <p class="conversation-pane__section-copy">按技能名称、关键词查找</p>
              </div>
              <span class="conversation-pane__search-toggle-icon" :class="{ 'conversation-pane__search-toggle-icon--open': isSearchPanelVisible }">
                ▾
              </span>
            </button>

            <div v-if="isSearchPanelVisible" class="conversation-pane__search-panel">
              <label class="conversation-pane__search-label" for="skill-search-input">技能搜索</label>
              <label class="conversation-pane__search" for="skill-search-input">
                <svg viewBox="0 0 24 24" class="icon-svg">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="skill-search-input"
                  ref="searchInputRef"
                  :value="searchQuery"
                  type="search"
                  placeholder="搜索技能名称或关键词"
                  @input="handleSearchInput"
                >
              </label>

              <div v-if="!isSearchActive" class="conversation-pane__results-block">
                <p class="conversation-pane__results-title">热门技能</p>
                <div class="conversation-pane__search-suggestions">
                  <button
                    v-for="skill in hotSkills"
                    :key="skill.id"
                    class="conversation-pane__suggestion-chip conversation-pane__suggestion-chip--hot"
                    type="button"
                    @click="applySuggestion(skill.name)"
                  >
                    {{ skill.name }}
                  </button>
                </div>
              </div>

              <div v-else-if="searchResults.length === 0" class="conversation-pane__search-empty">
                <p>没有找到匹配技能，试试更泛化的关键词。</p>
                <div v-if="searchSuggestions.length" class="conversation-pane__search-suggestions">
                  <button
                    v-for="suggestion in searchSuggestions"
                    :key="`empty-${suggestion.value}`"
                    class="conversation-pane__suggestion-chip"
                    type="button"
                    @click="applySuggestion(suggestion.value)"
                  >
                    {{ suggestion.label }}
                  </button>
                </div>
              </div>

              <div v-else class="conversation-pane__results-block">
                <p class="conversation-pane__results-title">匹配结果</p>
                <div class="conversation-pane__results-list">
                  <div
                    v-for="skill in searchResults"
                    :key="skill.id"
                    class="conversation-pane__result-item"
                    :class="{ 'conversation-pane__result-item--selected': selectedStarterSkillId === skill.id }"
                  >
                    <button
                      type="button"
                      class="conversation-pane__skill-toggle"
                      @click="handleSkillClick(skill.id)"
                    >
                      <strong>{{ skill.governedTitleText }}</strong>
                    </button>
                    <div v-if="selectedStarterSkillId === skill.id" class="conversation-pane__skill-detail">
                      <p class="conversation-pane__skill-description">{{ skill.governedDescriptionText }}</p>
                      <div class="conversation-pane__starter-action-row">
                        <button
                          type="button"
                          class="conversation-pane__starter-action"
                          @click="handleStartUse(skill)"
                        >
                          开始使用
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div
        ref="messagesViewportRef"
        v-else
        class="conversation-pane__messages"
        :style="messagesViewportStyle"
        @scroll="handleMessagesScroll"
      >
        <div class="conversation-pane__surface-measure conversation-pane__surface-measure--messages">
          <article
            v-for="item in displayItems"
            :key="item.id"
            class="conversation-pane__message"
            :class="[
              `conversation-pane__message--${item.kind === 'assistant-process' ? item.mainMessage.role : item.kind === 'tool-step-group' ? 'assistant' : item.message.role}`,
              {
                'conversation-pane__message--editable': item.kind === 'message'
                  && item.message.role === 'user'
                  && item.message.messageId === editableMessageId
              }
            ]"
          >
            <div
              class="conversation-pane__bubble"
              :class="{
                'conversation-pane__bubble--assistant': item.kind === 'assistant-process' || item.kind === 'tool-step-group' || item.message.role === 'assistant',
                'conversation-pane__bubble--user': item.kind === 'message' && item.message.role === 'user',
                'conversation-pane__bubble--error': item.kind === 'message' && item.message.status === 'error'
              }"
            >
              <div
                class="conversation-pane__avatar"
                :class="{
                  'conversation-pane__avatar--assistant': item.kind === 'assistant-process' || item.kind === 'tool-step-group' || item.message.role === 'assistant',
                  'conversation-pane__avatar--user': item.kind === 'message' && item.message.role === 'user'
                }"
                aria-hidden="true"
              >
                <template v-if="item.kind === 'message' && item.message.role === 'user'">
                  <img v-if="props.userAvatarUrl" class="conversation-pane__avatar-image" :src="props.userAvatarUrl" alt="">
                  <span v-else>{{ normalizedUserAvatarInitial }}</span>
                </template>
                <span v-else class="agent-glyph"></span>
              </div>
              <div class="conversation-pane__bubble-content">
                <template v-if="item.kind === 'assistant-process'">
                  <AssistantMessageHeader
                    v-if="item.mainMessage.assistantHeader"
                    :header="item.mainMessage.assistantHeader"
                  />
                  <AssistantProcessGroup
                    :main-message="item.mainMessage"
                    :collapsed-steps="item.collapsedSteps"
                    :format-time="formatTime"
                    @toggle-view="$emit('toggle-assistant-reading-mode', $event)"
                  />
                </template>
                <template v-else-if="item.kind === 'tool-step-group'">
                  <div class="conversation-pane__tool-step-group">
                    <template v-for="step in item.steps" :key="step.id">
                      <div
                        v-for="(displayName, dIdx) in step.toolDisplayNames"
                        :key="`${step.id}-${dIdx}`"
                        class="conversation-pane__tool-step-line"
                      >
                        ○ {{ displayName }}
                      </div>
                    </template>
                  </div>
                </template>
                <template v-else>
                <AssistantMessageHeader
                  v-if="item.message.role === 'assistant' && item.message.assistantHeader"
                  :header="item.message.assistantHeader"
                />
                <ProtocolMessageCard
                  v-if="item.message.kind === 'protocol'"
                  :message="item.message"
                  :disabled="isRunning"
                  @action="handleProtocolAction(item.message.id, $event)"
                  @state-change="$emit('protocol-state', item.message.id, $event)"
                />
                <PendingQuestionCard
                  v-else-if="item.message.kind === 'question'"
                  class="conversation-pane__pending-question"
                  :interaction="item.message.interaction"
                  :disabled="isRunning"
                  @reply="handleReplyPendingInteraction"
                  @reject="$emit('reject-pending-interaction')"
                />
                <RichResultCard
                  v-else-if="item.message.kind === 'result'"
                  :message="item.message"
                  @open-file="$emit('open-artifact-file', $event)"
                />
                <div
                  v-else-if="item.message.kind === 'error'"
                  class="conversation-pane__error-card"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <strong>{{ resolveErrorCardTitle(item.message) }}</strong>
                  <p>{{ item.message.runtimeError?.userMessage || item.message.text || '运行失败。' }}</p>
                  <details v-if="item.message.runtimeError?.detail" class="conversation-pane__error-details">
                    <summary>查看失败详情</summary>
                    <pre class="conversation-pane__error-detail-body">{{ item.message.runtimeError.detail }}</pre>
                  </details>
                </div>
                <AssistantTextMessage
                  v-else-if="item.message.kind === 'text' && item.message.role === 'assistant'"
                  :message="item.message"
                  :timestamp="formatTime(item.message.createdAt)"
                  @toggle-view="$emit('toggle-assistant-reading-mode', item.message.id)"
                />
                <template v-else-if="item.message.kind === 'tool-step'">
                  <div class="conversation-pane__tool-step-group">
                    <div
                      v-for="(displayName, dIdx) in item.message.toolDisplayNames"
                      :key="dIdx"
                      class="conversation-pane__tool-step-line"
                    >
                      ○ {{ displayName }}
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div v-if="item.message.role === 'user'" class="conversation-pane__user-copy">
                    <div class="conversation-pane__message-meta">
                      <small>{{ formatTime(item.message.createdAt) }}</small>
                      <button
                        class="conversation-pane__message-edit-btn"
                        :class="{ 'conversation-pane__message-edit-btn--hidden': item.message.messageId !== editableMessageId }"
                        type="button"
                        aria-label="编辑消息"
                        title="编辑消息"
                        @click="emitStartEditRerun(item.message.messageId)"
                      >
                        <svg viewBox="0 0 24 24" class="conversation-pane__message-edit-icon" aria-hidden="true">
                          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                          <path d="m13 7 4 4" />
                        </svg>
                      </button>
                    </div>
                    <p>{{ item.message.text || (item.message.status === 'streaming' ? '正在生成内容...' : '') }}</p>
                  </div>
                  <template v-else>
                    <p>{{ item.message.text || (item.message.status === 'streaming' ? '正在生成内容...' : '') }}</p>
                    <small>{{ formatTime(item.message.createdAt) }}</small>
                  </template>
                </template>
                </template>
              </div>
            </div>
          </article>
          <div ref="messagesEndRef" class="conversation-pane__messages-end" aria-hidden="true"></div>
        </div>
      </div>
    </div>

    <div class="conversation-pane__composer">
      <div class="conversation-pane__surface-measure conversation-pane__surface-measure--composer">
        <div
          class="soft-input-shell conversation-pane__composer-shell"
          :class="{
            'conversation-pane__composer-shell--dragging': isDragActive,
            'conversation-pane__composer-shell--drag-reject': uploadError !== null
          }"
          @dragenter="handleComposerDragEnter"
          @dragover="handleComposerDragOver"
          @dragleave="handleComposerDragLeave"
          @drop="handleComposerDrop"
        >
          <div v-if="editRerunTarget" class="conversation-pane__edit-rerun-banner">
            <div>
              <p class="conversation-pane__edit-rerun-title">编辑并重跑最后一条用户消息</p>
              <p class="conversation-pane__edit-rerun-copy">
                原消息及其后的会话消息会被删除，工作区文件和之前的工具副作用不会回滚。
              </p>
            </div>
            <button
              class="secondary-btn conversation-pane__edit-rerun-cancel"
              type="button"
              :disabled="isRunning"
              @click="$emit('cancel-edit-rerun')"
            >
              取消编辑
            </button>
          </div>
          <textarea
            ref="composerInputRef"
            v-model="draft"
            rows="3"
            :disabled="composerBlocked"
            :placeholder="composerPlaceholder"
            @keydown="handleComposerKeydown"
          />
          <div class="conversation-pane__actions">
            <div class="conversation-pane__action-left">
              <div class="conversation-pane__icon-entry">
                <button
                  class="conversation-pane__attach-btn"
                  type="button"
                  aria-label="添加附件"
                  :title="composerLockReason || undefined"
                  :disabled="isRunning || composerBlocked || composerSendBlocked"
                  @click="$emit('upload-files')"
                >
                  +
                </button>
                <span class="conversation-pane__icon-tooltip" aria-hidden="true">
                  {{ COMPOSER_UPLOAD_TIP }}
                </span>
              </div>
            </div>
            <div class="conversation-pane__icon-entry conversation-pane__icon-entry--send">
              <button
                :class="composerActionClass"
                type="button"
                :aria-label="composerActionLabel"
                :title="composerLockReason || undefined"
                :disabled="isComposerActionDisabled"
                @click="handleComposerAction"
              >
                <span class="conversation-pane__composer-action-glyph" aria-hidden="true">
                  <span
                    v-if="stopPending"
                    class="conversation-pane__composer-action-spinner"
                  ></span>
                  <svg
                    v-if="isStopActionVisible"
                    viewBox="0 0 24 24"
                    class="conversation-pane__composer-action-icon"
                    aria-hidden="true"
                  >
                    <rect x="7" y="7" width="10" height="10" rx="1.5" />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    class="conversation-pane__composer-action-icon"
                    aria-hidden="true"
                  >
                    <path d="M5 12L18 12" />
                    <path d="M12 6L18 12L12 18" />
                  </svg>
                </span>
              </button>
              <span class="conversation-pane__icon-tooltip" aria-hidden="true">{{ composerActionTooltip }}</span>
            </div>
          </div>
          <p v-if="composerSendBlocked && composerLockReason" class="conversation-pane__composer-note">
            {{ composerLockReason }}
          </p>
        </div>
        <p v-if="uploadError" class="conversation-pane__error conversation-pane__error--upload">{{ uploadError }}</p>
        <p v-if="error" class="conversation-pane__error">{{ error }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { AgentSessionInteraction, ProtocolAction, RuntimeError } from '@/api/types'
import AssistantProcessGroup from './AssistantProcessGroup.vue'
import type { ProtocolMessageState } from './protocolRuntime'
import AssistantMessageHeader from './AssistantMessageHeader.vue'
import StarterSkillHoverHelp from './StarterSkillHoverHelp.vue'
import AssistantTextMessage from './AssistantTextMessage.vue'
import { buildConversationDisplayItems } from './conversationDisplay'
import {
  buildComposerUploadError,
  COMPOSER_PLACEHOLDER,
  COMPOSER_SEND_LABEL,
  COMPOSER_UPLOAD_TIP,
  splitComposerUploadFiles
} from './composerUpload'
import { useConversationAutoScroll } from './useConversationAutoScroll'
import PendingQuestionCard from './PendingQuestionCard.vue'
import ProtocolMessageCard from './ProtocolMessageCard.vue'
import RichResultCard from './RichResultCard.vue'
import type {
  StarterGroupView,
  StarterSkillView,
  UiMessage
} from '@/stores/workbenchStore'

type StarterHelpPlacement = 'right' | 'bottom' | 'left'
type SearchSuggestion = Readonly<{
  intentGroup: StarterGroupView['id']
  label: string
  value: string
}>

const STARTER_HELP_PLACEMENTS: StarterHelpPlacement[] = ['right', 'bottom', 'left']
const EMPTY_STATE_SEARCH_SUGGESTIONS: readonly SearchSuggestion[] = Object.freeze([
  { intentGroup: 'planning', label: '方案制作', value: '方案 制作' },
  { intentGroup: 'configuration-authoring', label: '配置生成', value: '配置 生成' },
  { intentGroup: 'verification', label: '配置核查', value: '配置 核查' }
])

const props = defineProps<{
  messages: UiMessage[]
  pendingInteraction?: AgentSessionInteraction | null
  composerDraft: string
  composerBlocked: boolean
  composerSendBlocked: boolean
  composerLockReason?: string | null
  isRunning: boolean
  canStopRun: boolean
  stopPending: boolean
  error: string | null
  userAvatarUrl: string
  userAvatarInitial: string
  activeSessionKey?: string | null
  editableMessageId?: number | null
  editRerunTarget?: { messageId: number; text: string } | null
  starterGroups: StarterGroupView[]
  searchableSkills: StarterSkillView[]
  searchQuery: string
  selectedStarterSkillId: string | null
  workspaceFileCount: number
}>()

const emit = defineEmits<{
  (event: 'send-prompt', prompt: string): void
  (event: 'update:composer-draft', value: string): void
  (event: 'stop-run'): void
  (event: 'start-edit-rerun', messageId: number): void
  (event: 'cancel-edit-rerun'): void
  (event: 'submit-edit-rerun', prompt: string): void
  (event: 'reply-pending-interaction', answer: Record<string, unknown>): void
  (event: 'reject-pending-interaction'): void
  (event: 'upload-files', files?: File[]): void
  (event: 'update:search-query', value: string): void
  (event: 'select-starter-skill', skillId: string | null): void
  (event: 'protocol-action', messageId: string, action: ProtocolAction): void
  (event: 'protocol-state', messageId: string, state: ProtocolMessageState): void
  (event: 'open-artifact-file', fileId: string): void
  (event: 'toggle-assistant-reading-mode', messageId: string): void
}>()

const draft = ref(props.composerDraft)
const composerInputRef = ref<HTMLTextAreaElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const messagesViewportRef = ref<HTMLElement | null>(null)
const messagesEndRef = ref<HTMLElement | null>(null)
const searchPanelOpen = ref(true)
const showAllResults = ref(false)
const dragDepth = ref(0)
const isDragActive = ref(false)
const uploadError = ref<string | null>(null)
const messagesScrollbarWidth = ref(0)

const isSearchActive = computed(() => props.searchQuery.trim().length > 0)
const isSearchPanelVisible = computed(() => {
  return searchPanelOpen.value || isSearchActive.value
})
const searchSuggestions = computed(() => {
  const availableIntentGroups = new Set(
    props.starterGroups
      .filter(group => group.previewSkills.length > 0)
      .map(group => group.id)
  )

  return EMPTY_STATE_SEARCH_SUGGESTIONS.filter(suggestion => {
    return availableIntentGroups.has(suggestion.intentGroup)
  })
})
const searchResults = computed(() => props.searchableSkills)
const hotSkills = computed(() => {
  if (isSearchActive.value) return []
  return props.searchableSkills.slice(0, 3)
})
const normalizedUserAvatarInitial = computed(() => props.userAvatarInitial.trim() || '我')
const displayItems = computed(() => buildConversationDisplayItems(props.messages))
const messagesViewportStyle = computed(() => ({
  '--conversation-pane-scrollbar-width': `${messagesScrollbarWidth.value}px`
}))
const sessionKey = computed(() => props.activeSessionKey ?? null)
const composerPlaceholder = computed(() => {
  if (props.composerBlocked) {
    return '请先在上方回答当前问题...'
  }
  if (props.composerSendBlocked) {
    return '当前会话可继续编辑草稿，待共享工作区空闲后再发送...'
  }
  if (props.editRerunTarget) {
    return '修改这条用户消息，然后确认编辑并重跑...'
  }
  return COMPOSER_PLACEHOLDER
})
const submitActionLabel = computed(() => {
  return props.editRerunTarget ? '编辑并重跑' : '发送消息'
})
const composerActionVisibleLabel = computed(() => {
  return props.editRerunTarget ? '编辑并重跑' : COMPOSER_SEND_LABEL
})
const isStopActionVisible = computed(() => {
  return props.canStopRun || props.stopPending
})
const composerActionLabel = computed(() => {
  if (props.stopPending) {
    return '停止中'
  }
  if (isStopActionVisible.value) {
    return '停止运行'
  }
  return submitActionLabel.value
})
const composerActionTooltip = computed(() => {
  return isStopActionVisible.value ? composerActionLabel.value : composerActionVisibleLabel.value
})
const isComposerActionDisabled = computed(() => {
  if (isStopActionVisible.value) {
    return props.stopPending
  }
  return props.isRunning || props.composerBlocked || props.composerSendBlocked || !draft.value.trim()
})
const composerActionClass = computed(() => {
  return [
    isStopActionVisible.value ? 'secondary-btn secondary-btn--danger' : 'primary-btn',
    'conversation-pane__composer-action',
    isStopActionVisible.value
      ? 'conversation-pane__composer-action--stop'
      : 'conversation-pane__composer-action--send',
    {
      'conversation-pane__composer-action--pending': props.stopPending
    }
  ]
})

const { handleViewportScroll: handleMessagesScroll, requestAutoScroll } = useConversationAutoScroll({
  messagesRef: computed(() => props.messages),
  sessionKeyRef: sessionKey,
  viewportRef: messagesViewportRef,
  sentinelRef: messagesEndRef
})

watch(() => props.searchQuery, () => {
  showAllResults.value = false
})

watch(
  () => props.composerDraft,
  value => {
    if (value === draft.value) {
      return
    }
    draft.value = value
  }
)

watch(draft, value => {
  if (value === props.composerDraft) {
    return
  }
  emit('update:composer-draft', value)
})

watch(
  () => props.editRerunTarget,
  async target => {
    if (!target) return
    draft.value = target.text
    await nextTick()
    composerInputRef.value?.focus()
    composerInputRef.value?.setSelectionRange(draft.value.length, draft.value.length)
  },
  { immediate: true }
)

watch(
  () => props.searchQuery,
  async (searchQuery) => {
    if (!searchQuery.trim()) return
    await nextTick()
    searchInputRef.value?.focus()
  }
)

watch(
  () => props.messages,
  async () => {
    await nextTick()
    syncMessagesScrollbarWidth()
  },
  { deep: true, immediate: true }
)

function resetDragState(): void {
  dragDepth.value = 0
  isDragActive.value = false
}

function handleComposerDragEnter(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth.value += 1
  isDragActive.value = true
  uploadError.value = null
}

function handleComposerDragOver(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function handleComposerDragLeave(): void {
  if (dragDepth.value > 0) {
    dragDepth.value -= 1
  }
  if (dragDepth.value === 0) {
    isDragActive.value = false
  }
}

function handleComposerDrop(event: DragEvent): void {
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files || [])
  const { acceptedFiles, rejectedFiles } = splitComposerUploadFiles(files)
  resetDragState()
  if (rejectedFiles.length > 0) {
    uploadError.value = buildComposerUploadError(rejectedFiles)
    return
  }
  uploadError.value = null
  if (!acceptedFiles.length || props.isRunning || props.composerBlocked || props.composerSendBlocked) return
  emit('upload-files', acceptedFiles)
}

function syncMessagesScrollbarWidth(): void {
  const viewport = messagesViewportRef.value
  if (!viewport) {
    messagesScrollbarWidth.value = 0
    return
  }
  messagesScrollbarWidth.value = Math.max(0, viewport.offsetWidth - viewport.clientWidth)
}

function emitStartEditRerun(messageId: number | undefined): void {
  if (typeof messageId !== 'number') {
    return
  }
  emit('start-edit-rerun', messageId)
}

function handleReplyPendingInteraction(answer: Record<string, unknown>): void {
  requestAutoScroll()
  emit('reply-pending-interaction', answer)
}

function handleProtocolAction(messageId: string, action: ProtocolAction): void {
  requestAutoScroll()
  emit('protocol-action', messageId, action)
}

function submit(): void {
  const value = draft.value.trim()
  if (!value || props.composerBlocked || props.composerSendBlocked) return
  requestAutoScroll()
  if (props.editRerunTarget) {
    emit('submit-edit-rerun', value)
    return
  }
  emit('send-prompt', value)
  draft.value = ''
}

function handleComposerAction(): void {
  if (isStopActionVisible.value) {
    emit('stop-run')
    return
  }
  submit()
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey) {
    return
  }
  if (event.ctrlKey || event.metaKey || event.isComposing) {
    return
  }
  if (isStopActionVisible.value) {
    return
  }
  event.preventDefault()
  submit()
}

function handleSearchInput(event: Event): void {
  emit('update:search-query', (event.target as HTMLInputElement).value)
}

function applySuggestion(value: string): void {
  searchPanelOpen.value = true
  emit('update:search-query', value)
}

function handleSkillClick(skillId: string): void {
  emit('select-starter-skill', props.selectedStarterSkillId === skillId ? null : skillId)
}

function handleStartUse(skill: StarterSkillView): void {
  requestAutoScroll()
  emit('send-prompt', skill.starterPrompt)
  emit('select-starter-skill', null)
}

function resolveStarterHelpPlacement(groupIndex: number): StarterHelpPlacement {
  return STARTER_HELP_PLACEMENTS[groupIndex] || STARTER_HELP_PLACEMENTS[0]
}

function isStarterGroupActive(group: StarterGroupView): boolean {
  return group.previewSkills.some(skill => skill.id === props.selectedStarterSkillId)
}

async function toggleSearchPanel(): Promise<void> {
  if (isSearchPanelVisible.value) {
    searchPanelOpen.value = false
    showAllResults.value = false
    if (props.searchQuery) {
      emit('update:search-query', '')
    }
    return
  }

  searchPanelOpen.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function resolveErrorCardTitle(message: UiMessage): string {
  if (message.kind !== 'error') {
    return '执行失败'
  }
  return resolveRuntimeErrorTitle(message.runtimeError)
}

function resolveRuntimeErrorTitle(runtimeError: RuntimeError | null): string {
  if (runtimeError?.stage === 'tool') {
    return '工具执行失败'
  }
  return '执行失败'
}

onMounted(() => {
  syncMessagesScrollbarWidth()
})

</script>

<style scoped>
.conversation-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  block-size: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.conversation-pane__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.conversation-pane__empty-shell,
.conversation-pane__messages {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.conversation-pane__reading-measure,
.conversation-pane__surface-measure {
  width: min(100%, clamp(var(--layout-reading-min), var(--layout-reading-fluid), var(--layout-reading-max)));
  margin-inline: auto;
}

.conversation-pane__surface-measure {
  width: min(100%, clamp(var(--layout-surface-min), var(--layout-surface-fluid), var(--layout-surface-max)));
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

.conversation-pane__composer-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.conversation-pane__user-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-pane__message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.conversation-pane__message-meta small {
  margin-top: 0;
}

.conversation-pane__message-edit-btn {
  inline-size: 30px;
  block-size: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(96, 165, 250, 0.26);
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: rgba(30, 64, 175, 0.88);
  line-height: 1;
  opacity: 1;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 140ms ease,
    visibility 0s 140ms;
}

.conversation-pane__message-edit-btn--hidden {
  visibility: hidden;
  pointer-events: none;
}

.conversation-pane__message-edit-icon {
  inline-size: 14px;
  block-size: 14px;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.conversation-pane__message-edit-btn:hover,
.conversation-pane__message-edit-btn:focus-visible {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(59, 130, 246, 0.38);
  color: rgba(29, 78, 216, 0.96);
  transform: translateY(-1px);
}

.conversation-pane__edit-rerun-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--brand-soft) 45%, white);
}

.conversation-pane__edit-rerun-title {
  margin: 0;
  font-size: var(--font-meta);
  font-weight: 700;
}

.conversation-pane__edit-rerun-copy {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.conversation-pane__empty-shell {
  padding-block: var(--pane-block);
  padding-inline: var(--pane-inline);
}

.conversation-pane__quick-starts,
.conversation-pane__more-search {
  padding: var(--card-pad);
}

.conversation-pane__section-head {
  display: flex;
  align-items: flex-start;
  gap: var(--section-gap);
  margin-bottom: var(--section-gap);
}

.conversation-pane__eyebrow {
  margin: 0 0 4px;
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  color: var(--text-small);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.conversation-pane__section-head h3,
.conversation-pane__search-toggle h3 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.conversation-pane__section-copy {
  margin: calc(var(--section-gap) * 0.45) 0 0;
  max-inline-size: 60ch;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.conversation-pane__search {
  position: relative;
  width: min(100%, 40ch);
  flex-shrink: 0;
}

.conversation-pane__search-panel {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.7);
  margin-top: var(--section-gap);
  max-block-size: min(20rem, 42dvh);
  overflow-y: auto;
}

.conversation-pane__search-label {
  font-size: var(--font-meta);
  font-weight: 600;
  line-height: var(--line-meta);
  color: var(--text-primary);
}

.conversation-pane__search .icon-svg {
  position: absolute;
  inset-inline-start: calc(var(--pane-inline) * 0.6);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.conversation-pane__search input {
  width: 100%;
  block-size: calc(1.9lh + 0.8dvh);
  padding-inline: calc(var(--pane-inline) * 0.7);
  padding-inline-start: calc(1.8rem + 0.55vi);
  border-radius: var(--radius-md);
  border: 1px solid var(--line-subtle);
  background: rgba(247, 249, 252, 0.92);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.conversation-pane__search-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--section-gap) * 0.55);
}

.conversation-pane__suggestion-chip {
  min-block-size: calc(1.55rem + 0.55dvh);
  padding-inline: calc(var(--pane-inline) * 0.7);
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-secondary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  cursor: pointer;
  transition: 0.15s ease;
}

.conversation-pane__suggestion-chip:hover,
.conversation-pane__show-more:hover {
  border-color: var(--line-strong);
  background: var(--surface-subtle);
}

.conversation-pane__starter-grid,
.conversation-pane__results-list {
  display: grid;
  gap: var(--section-gap);
}

.conversation-pane__starter-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  isolation: isolate;
}

.conversation-pane__starter-card {
  position: relative;
  z-index: 0;
  overflow: visible;
  padding: var(--card-pad);
  border-radius: 12px;
  border: 1px solid var(--line-subtle);
  background: rgba(247, 249, 252, 0.86);
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.6);
  justify-content: flex-start;
}

.conversation-pane__starter-card:hover,
.conversation-pane__result-item:hover {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.conversation-pane__starter-card--active {
  z-index: 6;
}

.conversation-pane__starter-copy {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.45);
  overflow: visible;
}

.conversation-pane__starter-title {
  margin: 0;
  font-size: var(--font-title);
  font-weight: 700;
  line-height: var(--line-title);
}

.conversation-pane__starter-copy small {
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.conversation-pane__starter-preview {
  margin-top: auto;
}

.conversation-pane__starter-preview {
  list-style: none;
  padding: 0;
  margin-bottom: 0;
  display: grid;
  gap: 8px;
}

.conversation-pane__starter-preview-item {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(222, 232, 247, 0.72);
  color: var(--text-primary);
  font-size: var(--font-meta);
  font-weight: 600;
  line-height: var(--line-meta);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-pane__starter-preview-item--selected {
  position: relative;
  z-index: 1;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(37, 99, 235, 0.12);
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.conversation-pane__starter-preview-item:nth-child(n + 3) {
  display: none;
}

.conversation-pane__more-search {
  padding-block: var(--card-pad-tight);
}

.conversation-pane__search-toggle {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--section-gap);
  text-align: left;
  cursor: pointer;
}

.conversation-pane__search-toggle-icon {
  font-size: 14px;
  color: var(--text-secondary);
  transition: transform 0.15s ease;
}

.conversation-pane__search-toggle-icon--open {
  transform: rotate(180deg);
}

.conversation-pane__results-block {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.7);
}

.conversation-pane__results-title {
  margin: 0;
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  color: var(--text-primary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.conversation-pane__result-item {
  padding: var(--card-pad-tight);
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: var(--surface-panel);
  text-align: left;
  cursor: pointer;
  transition: 0.15s ease;
}

.conversation-pane__result-item strong {
  display: block;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.conversation-pane__result-item p,
.conversation-pane__search-empty {
  margin: calc(var(--section-gap) * 0.45) 0 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.conversation-pane__skill-toggle {
  display: block;
  width: 100%;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  padding: 0;
  font: inherit;
  color: inherit;
}

.conversation-pane__skill-detail {
  margin-top: calc(var(--section-gap) * 0.5);
  padding-left: 4px;
  display: grid;
  gap: calc(var(--section-gap) * 0.55);
}

.conversation-pane__starter-summary {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.conversation-pane__skill-description {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.conversation-pane__starter-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conversation-pane__starter-action {
  min-block-size: 34px;
  padding: 0 14px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--accent);
  font-size: var(--font-meta);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.conversation-pane__starter-action:hover,
.conversation-pane__starter-action:focus-visible {
  border-color: rgba(37, 99, 235, 0.34);
  background: rgba(239, 246, 255, 0.96);
}

.conversation-pane__result-item--selected {
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(239, 246, 255, 0.72);
}

.conversation-pane__search-empty {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.7);
  line-height: var(--line-meta);
}

.conversation-pane__search-empty p {
  margin: 0;
}

.conversation-pane__search-empty--compact {
  padding: 0;
}

.conversation-pane__show-more {
  align-self: flex-start;
  min-block-size: calc(1.65rem + 0.6dvh);
  padding-inline: calc(var(--pane-inline) * 0.75);
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-primary);
  font-size: var(--font-meta);
  font-weight: 600;
  line-height: var(--line-meta);
  cursor: pointer;
}

.conversation-pane__messages {
  padding-block: calc(var(--pane-block) * 0.8);
  padding-inline-start: var(--pane-inline);
  padding-inline-end: calc(var(--pane-inline) - var(--conversation-pane-scrollbar-width, 0px));
}

.conversation-pane__surface-measure--messages {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.9);
}

.conversation-pane__messages-end {
  block-size: 1px;
}

.conversation-pane__message {
  display: flex;
  width: 100%;
  max-width: 100%;
}

.conversation-pane__message--user {
  justify-content: flex-end;
}

.conversation-pane__avatar {
  inline-size: calc(1.7rem + 0.95dvh);
  block-size: calc(1.7rem + 0.95dvh);
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.98));
  color: var(--accent);
  font-size: var(--font-meta);
  font-weight: 700;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 10px 20px rgba(15, 23, 42, 0.08);
}

.conversation-pane__avatar--user {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(191, 219, 254, 0.96));
  color: rgba(30, 64, 175, 0.88);
}

.conversation-pane__avatar-image {
  inline-size: 100%;
  block-size: 100%;
  display: block;
  object-fit: cover;
  border-radius: 14px;
}

.conversation-pane__bubble {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--section-gap) * 0.7);
  min-inline-size: 0;
  inline-size: fit-content;
  max-inline-size: min(100%, 72ch);
  padding-block: calc(var(--card-pad-tight) - 0.15rem);
  padding-inline: calc(var(--card-pad) - 0.1rem);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--line-subtle);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-body);
  line-height: var(--line-body);
}

.conversation-pane__bubble-content {
  min-inline-size: 0;
  display: grid;
  gap: 4px;
}

.conversation-pane__bubble-content > * {
  min-inline-size: 0;
}

.conversation-pane__message--assistant .conversation-pane__bubble {
  max-inline-size: 100%;
  inline-size: 100%;
}

.conversation-pane__message--assistant .conversation-pane__bubble-content {
  flex: 1;
}

.conversation-pane__message--user .conversation-pane__bubble {
  flex-direction: row-reverse;
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.98), rgba(191, 219, 254, 0.98));
  color: rgba(15, 23, 42, 0.94);
  border-color: rgba(59, 130, 246, 0.24);
}

.conversation-pane__bubble--error {
  border-color: rgba(220, 38, 38, 0.2);
  background: rgba(255, 244, 243, 0.96);
  color: #b91c1c;
}

.conversation-pane__bubble p {
  margin: 0;
  white-space: pre-wrap;
  line-height: inherit;
}

.conversation-pane__bubble small {
  display: block;
  margin-top: calc(var(--section-gap) * 0.45);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  opacity: 0.72;
}

.conversation-pane__composer {
  z-index: 1;
  padding-block-start: calc(var(--pane-block) * 0.8);
  padding-block-end: var(--pane-block);
  padding-inline: var(--pane-inline);
  border-top: 1px solid var(--line-subtle);
  background: rgba(244, 247, 251, 0.96);
}

.conversation-pane__composer-shell {
  padding: var(--card-pad-tight);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.conversation-pane__composer-shell--dragging {
  border-color: rgba(59, 130, 246, 0.44);
  background: rgba(239, 246, 255, 0.94);
  box-shadow: 0 0 0 2px rgba(191, 219, 254, 0.72);
}

.conversation-pane__composer-shell--drag-reject {
  border-color: rgba(220, 38, 38, 0.3);
}

.conversation-pane__composer textarea {
  min-block-size: var(--composer-min-block);
  max-block-size: var(--composer-max-block);
  resize: none;
  display: block;
  font-size: var(--font-body);
  line-height: var(--line-body);
}
.conversation-pane__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--section-gap);
  margin-top: var(--section-gap);
}

.conversation-pane__action-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.conversation-pane__icon-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.conversation-pane__icon-entry:hover .conversation-pane__icon-tooltip,
.conversation-pane__icon-entry:focus-within .conversation-pane__icon-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.conversation-pane__icon-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translate(-50%, 4px);
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
  z-index: 2;
}

.conversation-pane__icon-tooltip--wide {
  max-inline-size: min(34ch, calc(100vw - 32px));
  white-space: normal;
  text-align: center;
}

.conversation-pane__attach-btn {
  inline-size: 38px;
  block-size: 38px;
  padding: 0;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--text-primary);
  font-size: 1.35rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.conversation-pane__attach-btn:hover,
.conversation-pane__attach-btn:focus-visible {
  border-color: var(--accent-light);
  background: var(--accent-lighter);
  color: var(--accent);
}

.conversation-pane__attach-btn:disabled {
  background: #f0f0f0;
  color: #b0b0b0;
  border-color: #d8d8d8;
  cursor: not-allowed;
}

.conversation-pane__composer-action {
  inline-size: 44px;
  block-size: 44px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conversation-pane__composer-action--send:disabled {
  background: var(--line-strong);
  border-color: var(--line-strong);
  color: var(--text-tertiary);
  cursor: not-allowed;
  opacity: 0.72;
}

.conversation-pane__composer-action-glyph {
  position: relative;
  inline-size: 20px;
  block-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.conversation-pane__composer-action-icon {
  inline-size: 20px;
  block-size: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.conversation-pane__composer-action--stop .conversation-pane__composer-action-icon {
  fill: currentColor;
  stroke: none;
}

.conversation-pane__composer-action-spinner {
  position: absolute;
  inset: -3px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: conversation-pane-stop-spin 0.65s linear infinite;
}

@keyframes conversation-pane-stop-spin {
  to {
    transform: rotate(360deg);
  }
}

.conversation-pane__error {
  margin: calc(var(--section-gap) * 0.7) 0.125rem 0;
  color: var(--danger);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.conversation-pane__error--upload {
  margin-top: 10px;
}

.conversation-pane__error-card {
  display: grid;
  gap: 6px;
}

.conversation-pane__error-card p,
.conversation-pane__error-detail-body {
  margin: 0;
  white-space: pre-wrap;
}

.conversation-pane__error-details {
  display: grid;
  gap: 6px;
}

.conversation-pane__error-details summary {
  cursor: pointer;
  color: var(--accent);
  font-size: var(--font-meta);
}

.conversation-pane__error-detail-body {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: 1.5;
}

.conversation-pane__tool-step-group {
  display: grid;
  gap: 2px;
}

.conversation-pane__tool-step-line {
  color: var(--text-secondary);
  font-size: var(--font-body);
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .conversation-pane__starter-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 720px) {
  .conversation-pane__starter-preview-item:nth-child(3) {
    display: block;
  }
}

@media (max-width: 980px) {
  .conversation-pane__empty-shell,
  .conversation-pane__messages,
  .conversation-pane__composer {
    padding-inline: var(--pane-inline);
  }

  .conversation-pane__surface-measure--messages,
  .conversation-pane__surface-measure--composer,
  .conversation-pane__surface-measure {
    width: 100%;
  }

  .conversation-pane__search {
    width: 100%;
  }

  .conversation-pane__actions {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .conversation-pane__action-left {
    justify-content: flex-start;
  }

}
</style>
