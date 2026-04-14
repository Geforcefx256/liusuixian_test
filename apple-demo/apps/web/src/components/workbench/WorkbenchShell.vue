<template>
  <div class="workbench-shell">
    <header class="workbench-shell__header">
      <div class="workbench-shell__header-left">
        <div class="workbench-shell__brand">
          <div class="agent-identity workbench-shell__brand-identity">
            <div class="agent-identity__main">
              <img src="/logo.png" alt="Logo" class="brand-logo-img" />
              <div class="agent-identity__copy workbench-shell__brand-copy">
                <strong class="workbench-shell__brand-title">{{ agentTitle }}</strong>
                <p class="agent-identity__subtitle">{{ agentSubtitle }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="workbench-shell__primary-actions">
          <div class="workbench-shell__icon-entry">
            <button
              class="workbench-shell__icon-action workbench-shell__new-conversation"
              type="button"
              aria-label="新建会话"
              @click="handleNewConversation"
            >
              <svg viewBox="0 0 24 24" class="icon-svg" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
            <span class="workbench-shell__icon-tooltip" aria-hidden="true">新建会话</span>
          </div>
          <SessionRail
            :sessions="workbenchStore.sessions"
            :active-session-id="workbenchStore.activeSessionId"
            :loading="workbenchStore.isInitializing"
            :show-usage="isAdmin"
            :session-usage-by-id="workbenchStore.sessionUsageById"
            @select-session="handleSelectSession"
            @delete-session="handleDeleteSession"
            @request-session-usage="handleRequestSessionUsage"
          />
        </div>

      </div>

      <div class="workbench-shell__header-center">
        <nav v-if="isAdmin" class="workbench-shell__nav segmented-control" aria-label="Workbench navigation">
          <button
            class="workbench-shell__nav-btn segmented-control__item"
            :class="{ 'workbench-shell__nav-btn--active segmented-control__item--active': currentView === 'workbench' }"
            :aria-pressed="currentView === 'workbench'"
            type="button"
            @click="currentView = 'workbench'"
          >
            工作台
          </button>
          <button
            class="workbench-shell__nav-btn segmented-control__item"
            :class="{ 'workbench-shell__nav-btn--active segmented-control__item--active': currentView === 'admin' }"
            :aria-pressed="currentView === 'admin'"
            type="button"
            @click="currentView = 'admin'"
          >
            Skill 管理
          </button>
        </nav>
      </div>

      <div class="workbench-shell__header-right">
        <button class="ghost-btn" type="button">帮助</button>
        <HeaderUserMenu />
      </div>
    </header>

    <div v-if="currentView === 'admin'" class="workbench-shell__admin-body">
      <AdminSkillManagement />
    </div>

    <div ref="bodyHost" v-else class="workbench-shell__body">
      <main
        ref="workspaceHost"
        class="workbench-shell__workspace"
        :class="{ 'workbench-shell__workspace--workspace-open': workbenchStore.workspaceOpen }"
        :style="workspaceLayoutStyle"
      >
        <div
          class="workbench-shell__conversation-column"
          :class="{ 'workbench-shell__conversation-column--workspace-open': workbenchStore.workspaceOpen }"
        >
          <ConversationPane
            :messages="workbenchStore.messages"
            :pending-interaction="workbenchStore.pendingInteraction"
            :composer-draft="workbenchStore.composerDraft"
            :composer-blocked="workbenchStore.isSessionInputBlocked"
            :composer-send-blocked="workbenchStore.isWorkspaceOccupiedByAnotherSession"
            :composer-lock-reason="workbenchStore.composerLockReason"
            :is-running="workbenchStore.isActiveSessionRunning"
            :can-stop-run="workbenchStore.canStopActiveRun"
            :stop-pending="workbenchStore.isStopPending"
            :error="workbenchStore.error"
            :user-avatar-url="userAvatarUrl"
            :user-avatar-initial="userAvatarInitial"
            :active-session-key="workbenchStore.activeSessionId"
            :editable-message-id="workbenchStore.editableUserMessageId"
            :edit-rerun-target="workbenchStore.editRerunTarget"
            :starter-groups="workbenchStore.starterGroups"
            :searchable-skills="workbenchStore.searchableSkills"
            :search-query="workbenchStore.skillSearchQuery"
            :selected-starter-skill-id="workbenchStore.selectedStarterSkillId"
            :workspace-file-count="workbenchStore.workspaceFiles.length"
            @send-prompt="handleSendPrompt"
            @update:composer-draft="workbenchStore.setComposerDraft"
            @stop-run="workbenchStore.stopCurrentRun"
            @start-edit-rerun="workbenchStore.startEditRerun"
            @cancel-edit-rerun="workbenchStore.cancelEditRerun"
            @submit-edit-rerun="workbenchStore.submitEditRerun"
            @reply-pending-interaction="workbenchStore.replyPendingInteraction"
            @reject-pending-interaction="workbenchStore.rejectPendingInteraction"
            @upload-files="handleUploadFiles"
            @update:search-query="workbenchStore.setSkillSearchQuery"
            @select-starter-skill="workbenchStore.selectStarterSkill"
            @protocol-action="handleProtocolAction"
            @protocol-state="handleProtocolState"
            @open-artifact-file="handleOpenArtifactFile"
            @toggle-assistant-reading-mode="workbenchStore.toggleAssistantReadingMode"
          />
        </div>

        <div
          v-if="workbenchStore.workspaceOpen"
          class="workbench-shell__splitter workbench-shell__splitter--conversation"
          role="separator"
          aria-orientation="vertical"
          @pointerdown="startResize('conversation', $event)"
        ></div>

        <WorkspaceEditorPane
          v-if="workbenchStore.workspaceOpen"
          :open-files="workbenchStore.openedWorkspaceFiles"
          :active-file-id="workbenchStore.activeWorkspaceFileId"
          :active-file="workbenchStore.activeWorkspaceFile"
          :is-running="workbenchStore.isRunning"
          @select-file="workbenchStore.openWorkspaceFile"
          @request-rename-file="handleRequestWorkspaceRename"
          @copy-file-name="handleCopyWorkspaceFileName"
          @download-file="handleDownloadWorkspaceFile"
          @delete-file="handleDeleteWorkspaceFile"
          @update-content="workbenchStore.updateWorkspaceFileContent"
          @update-mml-metadata="workbenchStore.updateWorkspaceMmlMetadata"
          @save-file="workbenchStore.saveWorkspaceFile"
          @blur-file="workbenchStore.autoSaveWorkspaceFile"
          @close-file="workbenchStore.closeWorkspaceFile"
        />
      </main>

      <div
        v-if="!effectiveWorkspaceSidebarCollapsed"
        class="workbench-shell__splitter workbench-shell__splitter--sidebar"
        role="separator"
        aria-orientation="vertical"
        @pointerdown="startResize('sidebar', $event)"
      ></div>

      <div v-show="!effectiveWorkspaceSidebarCollapsed" class="workbench-shell__sidebar-slot">
        <WorkspaceSidebar
          :tasks="workbenchStore.workspaceTasks"
          :active-tab="workbenchStore.workspaceSidebarTab"
          :collapsed="effectiveWorkspaceSidebarCollapsed"
          :width-px="workspaceSidebarWidth"
          :external-rename-request="workspaceRenameRequest"
          :selected-file-id="workbenchStore.selectedWorkspaceFileId"
          :active-file-id="workbenchStore.activeWorkspaceFileId"
          :is-running="workbenchStore.isRunning"
          :dirty-file-ids="workbenchStore.workspaceDirtyFileIds"
          :submit-rename-file="handleSubmitWorkspaceRename"
          :submit-rename-folder="handleSubmitProjectFolderRename"
          :create-project-entry="handleCreateProjectEntry"
          @select-file="workbenchStore.selectWorkspaceFile"
          @open-file="workbenchStore.openWorkspaceFile"
          @copy-file-name="handleCopyWorkspaceFileName"
          @download-file="handleDownloadWorkspaceFile"
          @delete-file="handleDeleteWorkspaceFile"
          @toggle-collapse="handleWorkspaceSidebarToggle"
          @change-tab="workbenchStore.setWorkspaceSidebarTab"
        />
      </div>

      <button
        v-if="effectiveWorkspaceSidebarCollapsed"
        class="workbench-shell__sidebar-expand"
        type="button"
        aria-label="展开工作空间侧栏"
        @click="handleWorkspaceSidebarToggle(false)"
      >
        <svg viewBox="0 0 24 24" class="icon-svg">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
    </div>

    <input
      ref="fileInput"
      class="workbench-shell__hidden-input"
      type="file"
      :accept="COMPOSER_UPLOAD_ACCEPT"
      multiple
      @change="handleFileChange"
    />

    <Teleport to="body">
      <div v-if="uploadConflictConfirmation" class="workbench-shell__confirm-layer">
        <div class="workbench-shell__confirm-backdrop" @click="handleCancelUploadConflict"></div>
        <div class="workbench-shell__confirm-shell">
          <SessionRailConfirmSurface
            variant="dialog"
            title="覆盖已有文件？"
            :detail-lines="uploadConflictDetailLines"
            confirm-label="确认覆盖"
            @cancel="handleCancelUploadConflict"
            @confirm="handleConfirmUploadConflict"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AdminSkillManagement from './AdminSkillManagement.vue'
import ConversationPane from './ConversationPane.vue'
import HeaderUserMenu from './HeaderUserMenu.vue'
import SessionRailConfirmSurface from './SessionRailConfirmSurface.vue'
import SessionRail from './SessionRail.vue'
import WorkspaceEditorPane from './WorkspaceEditorPane.vue'
import WorkspaceSidebar from './WorkspaceSidebar.vue'
import type { ProtocolAction } from '@/api/types'
import { COMPOSER_UPLOAD_ACCEPT } from './composerUpload'
import type { ProtocolMessageState } from './protocolRuntime'
import { useAuthStore } from '@/auth/authStore'
import { useWorkbenchStore } from '@/stores/workbenchStore'

const authStore = useAuthStore()
const workbenchStore = useWorkbenchStore()
const bodyHost = ref<HTMLElement | null>(null)
const workspaceHost = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const currentView = ref<'workbench' | 'admin'>('workbench')
const autoCollapseWorkspaceSidebar = ref(false)
const workspaceSidebarPinnedOpen = ref(false)
const conversationFr = ref(4)
const BASE_EDITOR_FR = 8
const workspaceSidebarWidth = ref(320)
const workspaceRenameRequest = ref<{ fileId: string; requestKey: number } | null>(null)
let resizeObserver: ResizeObserver | null = null
let activeResizeCleanup: (() => void) | null = null
let workspaceRenameRequestKey = 0

const DESKTOP_LAYOUT_MIN_WIDTH = 1120
const RESIZE_HANDLE_SIZE = 8
const CONVERSATION_PANE_MIN_WIDTH = 320
const EDITOR_PANE_MIN_WIDTH = 560
const WORKSPACE_SIDEBAR_MIN_WIDTH = 280
const WORKSPACE_SIDEBAR_MAX_WIDTH = 420

const isAdmin = computed(() => {
  return (authStore.currentUser?.user.roles || []).some(role => ['admin', 'super_admin'].includes(role.roleKey))
})

const agentTitle = computed(() => {
  return workbenchStore.activeAgent?.presentation?.title || workbenchStore.activeAgent?.name || '等待加载智能体'
})

const agentSubtitle = computed(() => {
  return workbenchStore.activeAgent?.presentation?.summary || workbenchStore.activeAgent?.description || '连接已迁移的 agent backend。'
})

const userDisplayName = computed(() => {
  return authStore.currentUser?.user.userAccount
    || authStore.currentUser?.user.userCode
    || authStore.currentUser?.user.displayName
    || '账户'
})

const userAvatarUrl = computed(() => {
  return authStore.currentUser?.user.avatarUrl || ''
})

const userAvatarInitial = computed(() => {
  const avatarFallbackSource = authStore.currentUser?.user.userAccount
    || authStore.currentUser?.user.userCode
    || authStore.currentUser?.user.displayName
    || '账户'
  return avatarFallbackSource.slice(0, 1).toUpperCase()
})

const effectiveWorkspaceSidebarCollapsed = computed(() => {
  return (workbenchStore.workspaceSidebarCollapsed || autoCollapseWorkspaceSidebar.value) && !workspaceSidebarPinnedOpen.value
})

const workspaceLayoutStyle = computed(() => {
  if (!workbenchStore.workspaceOpen) return undefined
  return {
    '--workbench-conversation-fr': `${conversationFr.value}fr`,
    '--workbench-editor-fr': `${BASE_EDITOR_FR}fr`
  }
})

const uploadConflictConfirmation = computed(() => workbenchStore.uploadConflictConfirmation)
const uploadConflictDetailLines = computed(() => {
  const conflict = uploadConflictConfirmation.value
  if (!conflict) {
    return []
  }
  return [
    '确认覆盖后将覆盖当前工作空间中的同名文件。'
  ]
})

watch(
  () => workbenchStore.workspaceSidebarCollapsed,
  collapsed => {
    if (collapsed) {
      workspaceSidebarPinnedOpen.value = false
    }
  }
)

watch(
  () => workbenchStore.workspaceOpen,
  open => {
    if (!open) {
      autoCollapseWorkspaceSidebar.value = false
      workspaceSidebarPinnedOpen.value = false
      conversationFr.value = 4
      return
    }
    syncWorkspaceSidebarCollapse()
  },
  { immediate: true }
)

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    syncWorkspaceSidebarCollapse()
  })
  if (bodyHost.value) {
    resizeObserver.observe(bodyHost.value)
    syncWorkspaceSidebarCollapse()
  }
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  activeResizeCleanup?.()
  activeResizeCleanup = null
  document.removeEventListener('keydown', handleDocumentKeydown)
})

function handleNewConversation(): void {
  workbenchStore.startNewConversation()
}

function handleSelectSession(sessionId: string): void {
  void workbenchStore.selectSession(sessionId)
}

function handleDeleteSession(sessionId: string): void {
  void workbenchStore.deleteSession(sessionId)
}

function handleRequestSessionUsage(sessionIds: string[]): void {
  if (!isAdmin.value) {
    return
  }
  for (const sessionId of sessionIds) {
    void workbenchStore.loadSessionUsage(sessionId)
  }
}

function handleSendPrompt(prompt: string): void {
  void workbenchStore.sendPrompt(prompt)
}

function handleDeleteWorkspaceFile(fileId: string): void {
  void workbenchStore.deleteWorkspaceFile(fileId)
}

function handleSubmitWorkspaceRename(fileId: string, nextFileName: string): Promise<boolean> {
  return workbenchStore.renameWorkspaceFile(fileId, nextFileName)
}

function handleSubmitProjectFolderRename(folderKey: string, nextFolderName: string): Promise<boolean> {
  return workbenchStore.renameProjectFolder(folderKey, nextFolderName)
}

function handleDownloadWorkspaceFile(fileId: string): void {
  void workbenchStore.downloadWorkspaceFile(fileId)
}

function handleCopyWorkspaceFileName(fileId: string): void {
  void workbenchStore.copyWorkspaceFileName(fileId)
}

async function handleRequestWorkspaceRename(fileId: string): Promise<void> {
  workbenchStore.selectWorkspaceFile(fileId)
  if (effectiveWorkspaceSidebarCollapsed.value) {
    handleWorkspaceSidebarToggle(false)
    await nextTick()
  }
  workspaceRenameRequestKey += 1
  workspaceRenameRequest.value = {
    fileId,
    requestKey: workspaceRenameRequestKey
  }
}

function handleCreateProjectEntry(
  kind: 'folder' | 'txt' | 'md',
  fileName: string,
  parentPath?: string | null
): Promise<boolean> {
  return workbenchStore.createProjectEntry(kind, fileName, parentPath)
}

function handleProtocolAction(messageId: string, action: ProtocolAction): void {
  void workbenchStore.executeProtocolAction(messageId, action)
}

function handleProtocolState(messageId: string, state: ProtocolMessageState): void {
  void workbenchStore.applyProtocolState(messageId, state)
}

function handleOpenArtifactFile(fileId: string): void {
  void workbenchStore.openWorkspaceFile(fileId)
}

function triggerFilePicker(): void {
  if (workbenchStore.isSessionInputBlocked) {
    return
  }
  fileInput.value?.click()
}

function handleUploadFiles(files?: File[]): void {
  if (files?.length) {
    void workbenchStore.uploadFiles(files)
    return
  }
  triggerFilePicker()
}

function handleFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  void workbenchStore.uploadFiles(target.files)
  target.value = ''
}

function handleConfirmUploadConflict(): void {
  workbenchStore.confirmUploadConflict()
}

function handleCancelUploadConflict(): void {
  workbenchStore.cancelUploadConflict()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !uploadConflictConfirmation.value) {
    return
  }
  event.preventDefault()
  handleCancelUploadConflict()
}

function handleWorkspaceSidebarToggle(nextValue: boolean): void {
  workbenchStore.setWorkspaceSidebarCollapsed(nextValue)
  workspaceSidebarPinnedOpen.value = !nextValue && autoCollapseWorkspaceSidebar.value
}

function syncWorkspaceSidebarCollapse(): void {
  if (!bodyHost.value) {
    autoCollapseWorkspaceSidebar.value = false
    return
  }

  const bodyWidth = bodyHost.value.clientWidth
  const workspaceWidth = workspaceHost.value?.clientWidth || 0

  const maxSidebarWidth = Math.max(
    WORKSPACE_SIDEBAR_MIN_WIDTH,
    bodyWidth - CONVERSATION_PANE_MIN_WIDTH - EDITOR_PANE_MIN_WIDTH - (RESIZE_HANDLE_SIZE * 2)
  )
  workspaceSidebarWidth.value = clamp(
    workspaceSidebarWidth.value,
    WORKSPACE_SIDEBAR_MIN_WIDTH,
    Math.min(WORKSPACE_SIDEBAR_MAX_WIDTH, maxSidebarWidth)
  )

  if (!workbenchStore.workspaceOpen) {
    autoCollapseWorkspaceSidebar.value = false
    return
  }

  const requiredWidth = CONVERSATION_PANE_MIN_WIDTH
    + RESIZE_HANDLE_SIZE
    + EDITOR_PANE_MIN_WIDTH
    + RESIZE_HANDLE_SIZE
    + workspaceSidebarWidth.value

  autoCollapseWorkspaceSidebar.value = bodyHost.value.clientWidth < requiredWidth
}

function startResize(target: 'conversation' | 'sidebar', event: PointerEvent): void {
  if (!bodyHost.value || bodyHost.value.clientWidth < DESKTOP_LAYOUT_MIN_WIDTH) return
  const bodyWidth = bodyHost.value.clientWidth
  const workspaceWidth = workspaceHost.value?.clientWidth || 0
  const startX = event.clientX
  const startFr = conversationFr.value
  const startSidebarWidth = workspaceSidebarWidth.value

  const handlePointerMove = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX

    if (target === 'conversation' && workbenchStore.workspaceOpen) {
      const totalFr = startFr + BASE_EDITOR_FR
      const currentConversationPx = (startFr / totalFr) * (workspaceWidth - RESIZE_HANDLE_SIZE)
      const newConversationPx = currentConversationPx + delta
      const newEditorPx = workspaceWidth - RESIZE_HANDLE_SIZE - newConversationPx
      if (newEditorPx > EDITOR_PANE_MIN_WIDTH && newConversationPx > CONVERSATION_PANE_MIN_WIDTH) {
        conversationFr.value = clamp((newConversationPx / newEditorPx) * BASE_EDITOR_FR, 1, 20)
      }
    } else if (target === 'sidebar') {
      const maxSidebarWidth = Math.max(
        WORKSPACE_SIDEBAR_MIN_WIDTH,
        bodyWidth - CONVERSATION_PANE_MIN_WIDTH - EDITOR_PANE_MIN_WIDTH - (RESIZE_HANDLE_SIZE * 2)
      )
      workspaceSidebarWidth.value = clamp(startSidebarWidth - delta, WORKSPACE_SIDEBAR_MIN_WIDTH, Math.min(WORKSPACE_SIDEBAR_MAX_WIDTH, maxSidebarWidth))
    }

    syncWorkspaceSidebarCollapse()
  }

  const stopResize = () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopResize)
    activeResizeCleanup = null
  }

  activeResizeCleanup?.()
  activeResizeCleanup = stopResize
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopResize)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
</script>

<style scoped>
.workbench-shell {
  block-size: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workbench-shell__header {
  min-block-size: var(--chrome-primary-b);
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--section-gap);
  padding-block: calc(var(--pane-block) * 0.35);
  padding-inline: var(--pane-inline);
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--line-subtle);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
  overflow: visible;
}

.workbench-shell__header-left,
.workbench-shell__brand,
.workbench-shell__header-right {
  display: flex;
  align-items: center;
  gap: calc(var(--section-gap) * 0.9);
}

.workbench-shell__header-left {
  grid-column: 1;
  min-width: 0;
  gap: var(--section-gap);
  justify-self: start;
}

.workbench-shell__header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.workbench-shell__header-right {
  grid-column: 3;
  min-width: 0;
  justify-content: flex-end;
  justify-self: end;
}

.workbench-shell__primary-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(243, 246, 250, 0.72);
  overflow: visible;
}

.workbench-shell__icon-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.workbench-shell__icon-action {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
  cursor: pointer;
}

.workbench-shell__icon-action:hover,
.workbench-shell__icon-action:focus-visible {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  outline: none;
}

.workbench-shell__icon-entry:hover .workbench-shell__icon-tooltip,
.workbench-shell__icon-entry:focus-within .workbench-shell__icon-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.workbench-shell__icon-tooltip {
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

.workbench-shell__nav {
  flex-shrink: 0;
}

.workbench-shell__nav-btn {
  border: 0;
}

.workbench-shell__brand-copy {
  min-width: 0;
}

.workbench-shell__brand-identity {
  justify-content: flex-start;
}

.workbench-shell__brand-title {
  display: block;
  font-size: var(--font-title);
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: var(--line-title);
  color: var(--text-primary);
}

.workbench-shell__header-right {
  gap: calc(var(--section-gap) * 0.75);
}

.workbench-shell__admin-body,
.workbench-shell__body,
.workbench-shell__workspace,
.workbench-shell__sidebar-slot {
  flex: 1;
  min-height: 0;
}

.workbench-shell__admin-body,
.workbench-shell__body {
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.workbench-shell__body {
  position: relative;
  background: var(--bg-canvas);
}

.workbench-shell__workspace {
  min-width: 0;
  display: flex;
  overflow: hidden;
}

.workbench-shell__sidebar-slot {
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  overflow: hidden;
}

.workbench-shell__sidebar-slot > * {
  min-width: 0;
  min-height: 0;
  block-size: 100%;
}

.workbench-shell__workspace--workspace-open {
  display: grid;
  grid-template-columns: minmax(320px, var(--workbench-conversation-fr, 4fr)) 8px minmax(560px, var(--workbench-editor-fr, 8fr));
  align-items: stretch;
}

.workbench-shell__conversation-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  block-size: 100%;
  display: flex;
  overflow: hidden;
  justify-content: center;
}

.workbench-shell__conversation-column--workspace-open {
  flex: 1 1 auto;
}

.workbench-shell__splitter {
  flex: 0 0 8px;
  position: relative;
  background: transparent;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
}

.workbench-shell__workspace--workspace-open > .workbench-shell__splitter {
  min-width: 8px;
}

.workbench-shell__splitter::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(195, 207, 219, 0.5) center / 1px 100% no-repeat;
  transition: background 0.15s ease;
}

.workbench-shell__splitter:hover::before {
  background: rgba(37, 99, 235, 0.3) center / 1px 100% no-repeat;
}

.workbench-shell__sidebar-expand {
  position: absolute;
  top: 16px;
  right: 6px;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.workbench-shell__sidebar-expand:hover {
  background: var(--accent-lighter);
  color: var(--accent);
  border-color: var(--accent-light);
}

.workbench-shell :deep(.ghost-btn) {
  color: var(--text-tertiary);
}

.workbench-shell__hidden-input {
  display: none;
}

.workbench-shell__confirm-layer {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 36;
}

.workbench-shell__confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(8px);
}

.workbench-shell__confirm-shell {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  z-index: 1;
}

@media (max-width: 1120px) {
  .workbench-shell__body {
    flex-direction: column;
  }

  .workbench-shell__splitter {
    display: none;
  }

  .workbench-shell__workspace {
    display: flex;
    min-block-size: min(48dvh, 26rem);
  }
}

@media (max-width: 980px) {
  .workbench-shell__header {
    height: auto;
    padding: var(--pane-block) var(--pane-inline);
    grid-template-columns: 1fr;
  }

  .workbench-shell__header-left {
    grid-column: auto;
    width: 100%;
    flex-wrap: wrap;
  }

  .workbench-shell__header-center {
    position: static;
    left: auto;
    transform: none;
    width: 100%;
    justify-content: stretch;
  }

  .workbench-shell__nav {
    order: 3;
    width: 100%;
    justify-content: space-between;
  }

  .workbench-shell__nav-btn {
    flex: 1;
  }

  .workbench-shell__header-right {
    grid-column: auto;
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .workbench-shell__primary-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
