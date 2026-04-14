import { defineComponent, h, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import workbenchShellSource from './WorkbenchShell.vue?raw'

const authStore = reactive({
  currentUser: {
    user: {
      roles: [] as Array<{ roleKey: string }>
    }
  }
})

const workbenchStore = reactive({
  sessions: [],
  sessionUsageById: {},
  activeSessionId: null as string | null,
  isInitializing: false,
  workspaceOpen: true,
  openedWorkspaceFiles: [],
  activeWorkspaceFileId: 'file-1',
  activeWorkspaceFile: null,
  workspaceTasks: [],
  workspaceDirtyFileIds: [],
  workspaceSidebarTab: 'workspace' as const,
  workspaceSidebarCollapsed: false,
  selectedWorkspaceFileId: null as string | null,
  isUploading: false,
  uploadConflictConfirmation: null as { conflictPath: string; fileName: string } | null,
  messages: [],
  isRunning: false,
  isActiveSessionRunning: false,
  canStopActiveRun: false,
  isStopPending: false,
  error: null as string | null,
  composerDraft: '',
  editableUserMessageId: null as number | null,
  editRerunTarget: null as { messageId: number; text: string } | null,
  starterGroups: [],
  searchableSkills: [],
  skillSearchQuery: '',
  workspaceFiles: [],
  isSessionInputBlocked: false,
  isWorkspaceOccupiedByAnotherSession: false,
  composerLockReason: null as string | null,
  historyLockReason: null as string | null,
  sharedWorkspaceLockReason: null as string | null,
  workspaceOccupancy: {
    occupied: false,
    state: 'idle',
    ownerSessionId: null,
    runId: null
  },
  workspaceOwnerSession: null as { sessionId: string; title: string } | null,
  activeAgent: null as { presentation?: { title?: string; summary?: string }; name?: string; description?: string } | null,
  startNewConversation: vi.fn(),
  selectSession: vi.fn(),
  loadSessionUsage: vi.fn(),
  deleteSession: vi.fn(),
  clearHistorySessions: vi.fn(),
  sendPrompt: vi.fn(),
  stopCurrentRun: vi.fn(),
  startEditRerun: vi.fn(),
  cancelEditRerun: vi.fn(),
  submitEditRerun: vi.fn(),
  setComposerDraft: vi.fn(),
  toggleAssistantReadingMode: vi.fn(),
  setSkillSearchQuery: vi.fn(),
  executeProtocolAction: vi.fn(),
  applyProtocolState: vi.fn(),
  openWorkspaceFile: vi.fn(),
  updateWorkspaceFileContent: vi.fn(),
  updateWorkspaceMmlMetadata: vi.fn(),
  saveWorkspaceFile: vi.fn(),
  closeWorkspaceFile: vi.fn(),
  renameWorkspaceFile: vi.fn().mockResolvedValue(true),
  copyWorkspaceFileName: vi.fn(),
  downloadWorkspaceFile: vi.fn(),
  deleteWorkspaceFile: vi.fn(),
  uploadFiles: vi.fn(),
  confirmUploadConflict: vi.fn(),
  cancelUploadConflict: vi.fn(),
  selectWorkspaceFile: vi.fn(),
  setWorkspaceSidebarCollapsed: vi.fn((nextValue: boolean) => {
    workbenchStore.workspaceSidebarCollapsed = nextValue
  }),
  setWorkspaceSidebarTab: vi.fn()
})

vi.mock('./AdminSkillManagement.vue', () => ({
  default: defineComponent({ name: 'AdminSkillManagementStub', setup: () => () => h('div', { class: 'admin-skill-management-stub' }) })
}))

vi.mock('./ConversationPane.vue', () => ({
  default: defineComponent({
    name: 'ConversationPaneStub',
    props: {
      isRunning: {
        type: Boolean,
        default: false
      }
    },
    setup(props) {
      return () => h('div', {
        class: 'conversation-pane-stub',
        'data-is-running': String(props.isRunning)
      }, [
        h('div', { class: 'conversation-pane-stub__body' })
      ])
    }
  })
}))

vi.mock('./HeaderUserMenu.vue', () => ({
  default: defineComponent({ name: 'HeaderUserMenuStub', setup: () => () => h('div', { class: 'header-user-menu-stub' }) })
}))

vi.mock('./SessionRail.vue', () => ({
  default: defineComponent({
    name: 'SessionRailStub',
    emits: ['request-session-usage'],
    setup(_, { emit }) {
      return () => h('div', { class: 'session-rail-stub-wrap' }, [
        h('button', {
          class: 'session-rail-stub',
          type: 'button',
          'aria-label': '\u5386\u53f2\u4f1a\u8bdd',
          onClick: () => emit('request-session-usage', ['session-1'])
        }),
        h('span', {
          class: 'session-rail-stub__tooltip'
        }, '\u5386\u53f2\u4f1a\u8bdd')
      ])
    }
  })
}))

vi.mock('./WorkspaceEditorPane.vue', () => ({
  default: defineComponent({
    name: 'WorkspaceEditorPaneStub',
    emits: ['request-rename-file', 'copy-file-name', 'download-file', 'delete-file'],
    setup(_, { emit }) {
      return () => h('div', { class: 'workspace-editor-pane-stub' }, [
        h('button', {
          class: 'workspace-editor-pane-stub__rename',
          type: 'button',
          onClick: () => emit('request-rename-file', 'file-1')
        }),
        h('button', {
          class: 'workspace-editor-pane-stub__copy',
          type: 'button',
          onClick: () => emit('copy-file-name', 'file-1')
        }),
        h('button', {
          class: 'workspace-editor-pane-stub__download',
          type: 'button',
          onClick: () => emit('download-file', 'file-1')
        }),
        h('button', {
          class: 'workspace-editor-pane-stub__delete',
          type: 'button',
          onClick: () => emit('delete-file', 'file-1')
        })
      ])
    }
  })
}))

vi.mock('./WorkspaceSidebar.vue', () => ({
  default: defineComponent({
    name: 'WorkspaceSidebarStub',
    props: {
      collapsed: {
        type: Boolean,
        required: true
      },
      submitRenameFile: {
        type: Function,
        required: true
      },
      externalRenameRequest: {
        type: Object,
        default: null
      },
      widthPx: {
        type: Number,
        default: 0
      }
    },
    emits: ['toggle-collapse', 'copy-file-name', 'download-file', 'delete-file'],
    setup(props, { emit }) {
      return () => h('div', {
        class: 'workspace-sidebar-stub',
        'data-collapsed': String(props.collapsed),
        'data-width': String(props.widthPx),
        'data-rename-request': props.externalRenameRequest?.fileId || ''
      }, [
        h('button', {
          class: 'workspace-sidebar-stub__toggle',
          type: 'button',
          onClick: () => emit('toggle-collapse', true)
        }),
        h('button', {
          class: 'workspace-sidebar-stub__expand',
          type: 'button',
          onClick: () => emit('toggle-collapse', false)
        }),
        h('button', {
          class: 'workspace-sidebar-stub__rename',
          type: 'button',
          onClick: () => void props.submitRenameFile('file-1', 'input-renamed.csv')
        }),
        h('button', {
          class: 'workspace-sidebar-stub__copy',
          type: 'button',
          onClick: () => emit('copy-file-name', 'file-1')
        }),
        h('button', {
          class: 'workspace-sidebar-stub__download',
          type: 'button',
          onClick: () => emit('download-file', 'file-1')
        }),
        h('button', {
          class: 'workspace-sidebar-stub__delete',
          type: 'button',
          onClick: () => emit('delete-file', 'file-1')
        })
      ])
    }
  })
}))

vi.mock('@/auth/authStore', () => ({
  useAuthStore: () => authStore
}))

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => workbenchStore
}))

import WorkbenchShell from './WorkbenchShell.vue'

let currentBodyWidth = 1440
let currentWorkspaceWidth = 980
let originalClientWidthDescriptor: PropertyDescriptor | undefined
let resizeCallback: ResizeObserverCallback | null = null
const mountedWrappers: VueWrapper<any>[] = []

function mountWorkbenchShell(options?: Parameters<typeof mount>[1]) {
  const wrapper = mount(WorkbenchShell, options)
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('WorkbenchShell', () => {
  beforeEach(() => {
    authStore.currentUser.user.roles = []
    currentBodyWidth = 1440
    currentWorkspaceWidth = 980
    workbenchStore.workspaceSidebarCollapsed = false
    workbenchStore.workspaceOpen = true
    workbenchStore.isRunning = false
    workbenchStore.isActiveSessionRunning = false
    workbenchStore.uploadConflictConfirmation = null
    workbenchStore.setWorkspaceSidebarCollapsed.mockClear()
    workbenchStore.loadSessionUsage.mockClear()
    workbenchStore.confirmUploadConflict.mockClear()
    workbenchStore.cancelUploadConflict.mockClear()
    workbenchStore.renameWorkspaceFile.mockClear()
    workbenchStore.copyWorkspaceFileName.mockClear()
    workbenchStore.downloadWorkspaceFile.mockClear()
    workbenchStore.deleteWorkspaceFile.mockClear()
    workbenchStore.selectWorkspaceFile.mockClear()
    originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('workbench-shell__workspace')) {
          return currentWorkspaceWidth
        }
        return currentBodyWidth
      }
    })

    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe(): void {}

      disconnect(): void {}
    })
    vi.stubGlobal('PointerEvent', MouseEvent)
  })

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount()
    }
    if (originalClientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidthDescriptor)
    }
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    resizeCallback = null
  })

  it('auto-collapses the workspace sidebar when the body width becomes constrained', async () => {
    const wrapper = mountWorkbenchShell({ attachTo: document.body })

    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-collapsed')).toBe('false')
    expect(wrapper.get('.workspace-sidebar-stub').isVisible()).toBe(true)

    currentBodyWidth = 1100
    resizeCallback?.([], {} as ResizeObserver)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-collapsed')).toBe('true')
    expect(wrapper.get('.workspace-sidebar-stub').isVisible()).toBe(false)
    expect(wrapper.find('.workbench-shell__sidebar-expand').exists()).toBe(true)
  })

  it('lets the user re-open the sidebar even while auto-collapse is active', async () => {
    const wrapper = mountWorkbenchShell({ attachTo: document.body })

    currentBodyWidth = 1100
    resizeCallback?.([], {} as ResizeObserver)
    await wrapper.vm.$nextTick()
    await wrapper.get('.workbench-shell__sidebar-expand').trigger('click')

    expect(workbenchStore.setWorkspaceSidebarCollapsed).toHaveBeenLastCalledWith(false)
    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-collapsed')).toBe('false')
    expect(wrapper.get('.workspace-sidebar-stub').isVisible()).toBe(true)
  })

  it('lets the user manually collapse the sidebar without closing the active file', async () => {
    const wrapper = mountWorkbenchShell({ attachTo: document.body })

    expect(workbenchStore.activeWorkspaceFileId).toBe('file-1')

    await wrapper.get('.workspace-sidebar-stub__toggle').trigger('click')

    expect(workbenchStore.setWorkspaceSidebarCollapsed).toHaveBeenLastCalledWith(true)
    expect(workbenchStore.activeWorkspaceFileId).toBe('file-1')
    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-collapsed')).toBe('true')
    expect(wrapper.get('.workspace-sidebar-stub').isVisible()).toBe(false)
    expect(wrapper.find('.workbench-shell__sidebar-expand').exists()).toBe(true)
  })

  it('re-opens the sidebar after manual collapse without changing the active file', async () => {
    const wrapper = mountWorkbenchShell({ attachTo: document.body })

    await wrapper.get('.workspace-sidebar-stub__toggle').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('.workbench-shell__sidebar-expand').trigger('click')

    expect(workbenchStore.activeWorkspaceFileId).toBe('file-1')
    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-collapsed')).toBe('false')
    expect(wrapper.get('.workspace-sidebar-stub').isVisible()).toBe(true)
  })

  it('forwards delete-file actions from the sidebar to the store', async () => {
    const wrapper = mountWorkbenchShell()

    await wrapper.get('.workspace-sidebar-stub__delete').trigger('click')

    expect(workbenchStore.deleteWorkspaceFile).toHaveBeenCalledTimes(1)
    expect(workbenchStore.deleteWorkspaceFile).toHaveBeenNthCalledWith(1, 'file-1')
  })

  it('forwards submitted rename requests from the sidebar to the store', async () => {
    const wrapper = mountWorkbenchShell()

    await wrapper.get('.workspace-sidebar-stub__rename').trigger('click')

    expect(workbenchStore.renameWorkspaceFile).toHaveBeenCalledTimes(1)
    expect(workbenchStore.renameWorkspaceFile).toHaveBeenNthCalledWith(1, 'file-1', 'input-renamed.csv')
  })

  it('forwards copy-file-name actions from the sidebar to the store', async () => {
    const wrapper = mountWorkbenchShell()

    await wrapper.get('.workspace-sidebar-stub__copy').trigger('click')

    expect(workbenchStore.copyWorkspaceFileName).toHaveBeenCalledTimes(1)
    expect(workbenchStore.copyWorkspaceFileName).toHaveBeenNthCalledWith(1, 'file-1')
  })

  it('forwards download-file actions from the sidebar to the store', async () => {
    const wrapper = mountWorkbenchShell()

    await wrapper.get('.workspace-sidebar-stub__download').trigger('click')

    expect(workbenchStore.downloadWorkspaceFile).toHaveBeenCalledTimes(1)
    expect(workbenchStore.downloadWorkspaceFile).toHaveBeenNthCalledWith(1, 'file-1')
  })

  it('forwards selected-file copy, download, and delete actions from the editor context to the store', async () => {
    const wrapper = mountWorkbenchShell()

    await wrapper.get('.workspace-editor-pane-stub__copy').trigger('click')
    await wrapper.get('.workspace-editor-pane-stub__download').trigger('click')
    await wrapper.get('.workspace-editor-pane-stub__delete').trigger('click')

    expect(workbenchStore.copyWorkspaceFileName).toHaveBeenCalledWith('file-1')
    expect(workbenchStore.downloadWorkspaceFile).toHaveBeenCalledWith('file-1')
    expect(workbenchStore.deleteWorkspaceFile).toHaveBeenCalledWith('file-1')
  })

  it('reopens the sidebar and targets the active file when rename is requested from the editor context', async () => {
    const wrapper = mountWorkbenchShell({ attachTo: document.body })

    await wrapper.get('.workspace-sidebar-stub__toggle').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('.workspace-editor-pane-stub__rename').trigger('click')
    await wrapper.vm.$nextTick()

    expect(workbenchStore.selectWorkspaceFile).toHaveBeenCalledWith('file-1')
    expect(workbenchStore.setWorkspaceSidebarCollapsed).toHaveBeenLastCalledWith(false)
    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-rename-request')).toBe('file-1')
  })

  it('narrows the hidden upload input accept list to txt md and csv', () => {
    const wrapper = mountWorkbenchShell()

    expect(wrapper.get('.workbench-shell__hidden-input').attributes('accept')).toBe('.txt,.md,.csv')
  })

  it('renders upload conflict confirmation with product copy and confirms overwrite', async () => {
    workbenchStore.uploadConflictConfirmation = {
      conflictPath: 'upload/input.csv',
      fileName: 'input.csv'
    }

    const wrapper = mountWorkbenchShell({ attachTo: document.body })

    expect(document.body.textContent).toContain('\u8986\u76d6\u5df2\u6709\u6587\u4ef6\uff1f')
    expect(document.body.textContent).not.toContain('\u76ee\u6807\u8def\u5f84\uff1aupload/input.csv')
    expect(document.body.textContent).toContain('\u786e\u8ba4\u8986\u76d6\u540e\u5c06\u8986\u76d6\u5f53\u524d\u5de5\u4f5c\u7a7a\u95f4\u4e2d\u7684\u540c\u540d\u6587\u4ef6\u3002')
    expect(workbenchShellSource).not.toContain('conflict.conflictPath')
    expect(workbenchShellSource).toContain('\u786e\u8ba4\u8986\u76d6\u540e\u5c06\u8986\u76d6\u5f53\u524d\u5de5\u4f5c\u7a7a\u95f4\u4e2d\u7684\u540c\u540d\u6587\u4ef6\u3002')

    const confirmButton = document.body.querySelector('.session-rail-confirm__confirm')
    if (!(confirmButton instanceof HTMLElement)) {
      throw new Error('upload conflict confirm button not found')
    }

    confirmButton.click()

    expect(workbenchStore.confirmUploadConflict).toHaveBeenCalledTimes(1)
  })

  it('cancels upload conflict confirmation on backdrop click and Esc', async () => {
    workbenchStore.uploadConflictConfirmation = {
      conflictPath: 'upload/input.csv',
      fileName: 'input.csv'
    }

    mountWorkbenchShell({ attachTo: document.body })

    const backdrop = document.body.querySelector('.workbench-shell__confirm-backdrop')
    if (!(backdrop instanceof HTMLElement)) {
      throw new Error('upload conflict backdrop not found')
    }

    backdrop.click()
    expect(workbenchStore.cancelUploadConflict).toHaveBeenCalledTimes(1)

    workbenchStore.uploadConflictConfirmation = {
      conflictPath: 'upload/input.csv',
      fileName: 'input.csv'
    }
    await Promise.resolve()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(workbenchStore.cancelUploadConflict).toHaveBeenCalledTimes(2)
  })

  it('passes current-session running state to the composer instead of the global workspace running flag', () => {
    workbenchStore.isActiveSessionRunning = false

    const wrapper = mountWorkbenchShell()

    expect(wrapper.get('.conversation-pane-stub').attributes('data-is-running')).toBe('false')
  })

  it('keeps brand and session actions on the left, admin navigation centered, and help plus user actions on the right', () => {
    authStore.currentUser.user.roles = [{ roleKey: 'admin' }]

    const wrapper = mountWorkbenchShell()

    const left = wrapper.get('.workbench-shell__header-left')
    const center = wrapper.get('.workbench-shell__header-center')
    const right = wrapper.get('.workbench-shell__header-right')

    expect(left.find('.workbench-shell__brand').exists()).toBe(true)
    expect(left.get('.workbench-shell__new-conversation').attributes('title')).toBeUndefined()
    expect(left.get('.workbench-shell__new-conversation').attributes('aria-label')).toBe('\u65b0\u5efa\u4f1a\u8bdd')
    expect(left.get('.workbench-shell__new-conversation').text().trim()).toBe('')
    expect(left.get('.workbench-shell__icon-tooltip').text()).toBe('\u65b0\u5efa\u4f1a\u8bdd')
    expect(left.get('.session-rail-stub').attributes('title')).toBeUndefined()
    expect(left.get('.session-rail-stub__tooltip').text()).toBe('\u5386\u53f2\u4f1a\u8bdd')
    expect(center.find('.workbench-shell__nav').exists()).toBe(true)
    expect(right.text()).toContain('\u5e2e\u52a9')
    expect(right.find('.header-user-menu-stub').exists()).toBe(true)
  })

  it('only forwards history usage requests for admin users', async () => {
    const wrapper = mountWorkbenchShell()

    await wrapper.get('.session-rail-stub').trigger('click')
    expect(workbenchStore.loadSessionUsage).not.toHaveBeenCalled()

    authStore.currentUser.user.roles = [{ roleKey: 'super_admin' }]
    const adminWrapper = mountWorkbenchShell()

    await adminWrapper.get('.session-rail-stub').trigger('click')
    expect(workbenchStore.loadSessionUsage).toHaveBeenCalledWith('session-1')
  })

  it('anchors the center navigation independently so desktop centering does not drift with left or right content width', () => {
    const normalizedSource = workbenchShellSource.replace(/\r\n/g, '\n')

    expect(normalizedSource).toContain('.workbench-shell__header-center {')
    expect(normalizedSource).toContain('position: absolute;')
    expect(normalizedSource).toContain('left: 50%;')
    expect(normalizedSource).toContain('transform: translateX(-50%);')
    expect(normalizedSource).toContain('@media (max-width: 980px)')
    expect(normalizedSource).toContain('.workbench-shell__header-center {')
    expect(normalizedSource).toContain('position: static;')
    expect(normalizedSource).toContain('transform: none;')
    expect(normalizedSource).toContain('.workbench-shell__header-left {\n  grid-column: 1;')
    expect(normalizedSource).toContain('.workbench-shell__header-right {\n  grid-column: 3;')
    expect(normalizedSource).toContain('.workbench-shell__icon-action {')
    expect(normalizedSource).toContain('border: 0;')
    expect(normalizedSource).toContain('.workbench-shell__icon-tooltip {')
    expect(normalizedSource).toContain('pointer-events: none;')
  })

  it('keeps the sidebar slot shrinkable so the workspace panel can own internal scrolling', () => {
    const normalizedSource = workbenchShellSource.replace(/\r\n/g, '\n')

    expect(normalizedSource).toContain(`.workbench-shell__sidebar-slot {
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  overflow: hidden;
}`)
    expect(normalizedSource).toContain(`.workbench-shell__sidebar-slot > * {
  min-width: 0;
  min-height: 0;
  block-size: 100%;
}`)
  })

  it('does not render a permanent left rail splitter in the shell layout', () => {
    const wrapper = mountWorkbenchShell()

    expect(wrapper.find('.workbench-shell__splitter--rail').exists()).toBe(false)
    expect(wrapper.find('.session-rail-stub').exists()).toBe(true)
  })

  it('updates the workspace sidebar width when the right resize handle is dragged', async () => {
    const wrapper = mountWorkbenchShell()

    expect(wrapper.get('.workspace-sidebar-stub').attributes('data-width')).toBe('320')

    await wrapper.get('.workbench-shell__splitter--sidebar').trigger('pointerdown', { clientX: 900 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 860 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 860 }))
    await wrapper.vm.$nextTick()

    expect(Number(wrapper.get('.workspace-sidebar-stub').attributes('data-width'))).toBeGreaterThan(320)
  })
})
