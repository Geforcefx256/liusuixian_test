<template>
  <aside
    class="workspace-sidebar"
    :style="widthPx ? { '--workspace-sidebar-width': `${widthPx}px` } : undefined"
  >
    <div class="workspace-sidebar__shell">
      <div class="workspace-sidebar__head agent-bar-surface">
        <div class="workspace-sidebar__tabs segmented-control segmented-control--compact segmented-control--fill" role="tablist" aria-label="右侧栏视图">
          <button
            class="workspace-sidebar__tab segmented-control__item"
            :class="{ 'workspace-sidebar__tab--active segmented-control__item--active': activeTab === 'workspace' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'workspace'"
            @click="$emit('change-tab', 'workspace')"
          >
            工作空间
          </button>
          <button
            class="workspace-sidebar__tab segmented-control__item"
            :class="{ 'workspace-sidebar__tab--active segmented-control__item--active': activeTab === 'templates' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'templates'"
            @click="$emit('change-tab', 'templates')"
          >
            模板
          </button>
        </div>
        <button class="workspace-sidebar__toggle" type="button" aria-label="收起侧栏" @click="$emit('toggle-collapse', true)">
          <svg viewBox="0 0 24 24" class="icon-svg">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div class="workspace-sidebar__panels">
        <div v-if="activeTab === 'workspace'" class="workspace-sidebar__panel" role="tabpanel">
          <section class="workspace-sidebar__section">
            <div class="workspace-sidebar__tree">
              <section v-for="task in tasks" :key="task.id" class="workspace-sidebar__task">
                <div class="workspace-sidebar__group-wrap">
                  <div v-for="group in task.groups" :key="group.id" class="workspace-sidebar__group">
                    <button
                      class="workspace-sidebar__group-row"
                      type="button"
                      :aria-label="collapsedGroupIds.has(group.id) ? '展开' : '收起'"
                      @click="toggleGroupCollapse(group.id)"
                    >
                      <div class="workspace-sidebar__group-meta">
                        <span class="workspace-sidebar__group-caret">
                          {{ collapsedGroupIds.has(group.id) ? '▸' : '▾' }}
                        </span>
                        <svg viewBox="0 0 24 24" class="icon-svg" aria-hidden="true">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>{{ group.label }}</span>
                        <span v-if="group.entries.length > 0" class="workspace-sidebar__group-count">{{ group.entries.length }}</span>
                      </div>
                      <div v-if="group.id === 'project'" class="workspace-sidebar__group-actions" @click.stop>
                        <div class="workspace-sidebar__new-menu">
                          <button
                            :ref="setNewMenuTriggerRef"
                            class="workspace-sidebar__new-trigger workspace-sidebar__context-new-trigger"
                            type="button"
                            aria-label="新建 project 内容"
                            @click="toggleNewMenu"
                          >
                            +
                          </button>
                          <div v-if="newMenuOpen" :ref="setNewMenuDropdownRef" class="workspace-sidebar__new-dropdown">
                            <button type="button" @click="handleCreateProject('folder', null)">新建文件夹</button>
                            <button type="button" @click="handleCreateProject('txt', null)">新建 TXT</button>
                            <button type="button" @click="handleCreateProject('md', null)">新建 MD</button>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div
                      v-if="!collapsedGroupIds.has(group.id) && (groupVisibleNodeMap[group.id].length > 0 || (group.id === 'project' && creatingKind))"
                      class="workspace-sidebar__group-tree"
                    >
                      <div
                        v-if="group.id === 'project' && creatingKind && createParentPath === null"
                        class="workspace-sidebar__file-row"
                        :style="{ '--workspace-node-depth': 0 }"
                      >
                        <div class="workspace-sidebar__file workspace-sidebar__file--editing">
                          <svg viewBox="0 0 24 24" class="icon-svg">
                            <path
                              v-if="creatingKind === 'folder'"
                              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                            />
                            <template v-else>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </template>
                          </svg>
                          <div class="workspace-sidebar__rename-stack">
                            <div class="workspace-sidebar__rename-editor">
                              <input
                                :ref="setCreateInputRef"
                                class="workspace-sidebar__rename-input"
                                :value="createDraft"
                                :disabled="isSubmittingCreate"
                                :aria-label="creatingKind === 'folder' ? '新建文件夹' : '新建文件'"
                                @input="updateCreateDraft(($event.target as HTMLInputElement).value)"
                                @keydown.enter.prevent="submitProjectCreate()"
                                @keydown.escape.prevent="cancelProjectCreate()"
                                @click.stop
                                @dblclick.stop
                                @blur="submitProjectCreate()"
                              />
                              <span v-if="createExtension" class="workspace-sidebar__rename-extension" aria-hidden="true">
                                {{ createExtension }}
                              </span>
                            </div>
                            <p v-if="createError" class="workspace-sidebar__rename-error">{{ createError }}</p>
                          </div>
                        </div>
                      </div>
                      <template v-for="node in groupVisibleNodeMap[group.id]" :key="node.nodeId">
                        <div
                          class="workspace-sidebar__file-row"
                          :class="{ 'workspace-sidebar__file-row--folder': node.nodeType === 'folder' }"
                          :style="{ '--workspace-node-depth': node.depth }"
                        >
                          <button
                            v-if="!isInlineRenaming(node.nodeId)"
                            class="workspace-sidebar__file"
                            :class="{
                              'workspace-sidebar__file--selected': (node.nodeType === 'folder' ? node.nodeId : node.fileId) === selectedFileId,
                              'workspace-sidebar__file--active': node.nodeType === 'file' && node.fileId === activeFileId
                            }"
                            type="button"
                            :aria-label="node.label"
                            @click="handleNodeClick(node)"
                            @dblclick="handleNodeDoubleClick(node)"
                          >
                            <span v-if="node.nodeType === 'folder'" class="workspace-sidebar__caret">
                              {{ expandedFolderIds.has(node.nodeId) ? '▾' : '▸' }}
                            </span>
                            <svg viewBox="0 0 24 24" class="icon-svg">
                              <path
                                v-if="node.nodeType === 'folder'"
                                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                              />
                              <template v-else>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </template>
                            </svg>
                            <span class="workspace-sidebar__file-label">
                              <span class="workspace-sidebar__file-name">
                                <span class="workspace-sidebar__file-stem">{{ node.namePresentation.stem }}</span><span v-if="node.namePresentation.hasSuffix" class="workspace-sidebar__file-suffix">{{ node.namePresentation.suffix }}</span>
                              </span>
                              <span
                                v-if="node.namePresentation.needsReveal"
                                class="workspace-sidebar__file-reveal"
                                role="tooltip"
                              >
                                {{ node.label }}
                              </span>
                            </span>
                          </button>
                          <div
                            v-else
                            class="workspace-sidebar__file workspace-sidebar__file--editing"
                            :class="{
                              'workspace-sidebar__file--selected': (node.nodeType === 'folder' ? node.nodeId : node.fileId) === selectedFileId,
                              'workspace-sidebar__file--active': node.nodeType === 'file' && node.fileId === activeFileId
                            }"
                          >
                            <svg viewBox="0 0 24 24" class="icon-svg">
                              <path
                                v-if="node.nodeType === 'folder'"
                                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                              />
                              <template v-else>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </template>
                            </svg>
                            <div class="workspace-sidebar__rename-stack">
                              <div class="workspace-sidebar__rename-editor">
                                <input
                                  :ref="setRenameInputRef"
                                  class="workspace-sidebar__rename-input"
                                  :value="renameDraft"
                                  :disabled="isSubmittingRename"
                                  :aria-label="node.nodeType === 'folder' ? '重命名文件夹' : '重命名文件'"
                                  @input="updateRenameDraft(($event.target as HTMLInputElement).value)"
                                  @keydown.enter.prevent="submitInlineRename()"
                                  @keydown.escape.prevent="cancelInlineRename()"
                                  @click.stop
                                  @dblclick.stop
                                  @blur="submitInlineRename()"
                                />
                                <span v-if="renameExtension" class="workspace-sidebar__rename-extension" aria-hidden="true">
                                  {{ renameExtension }}
                                </span>
                              </div>
                              <p v-if="renameError" class="workspace-sidebar__rename-error">{{ renameError }}</p>
                            </div>
                          </div>
                          <div class="workspace-sidebar__row-actions">
                            <div v-if="isCreateContextProjectFolder(node)" class="workspace-sidebar__context-new-menu">
                              <button
                                class="workspace-sidebar__context-new-trigger"
                                type="button"
                                aria-label="在当前文件夹中新增"
                                @click.stop="toggleContextCreateMenu(node)"
                              >
                                +
                              </button>
                              <div v-if="isContextCreateMenuOpen(node.nodeId)" class="workspace-sidebar__context-new-dropdown">
                                <button type="button" @click.stop="handleCreateProject('folder', node.relativePath)">新建文件夹</button>
                                <button type="button" @click.stop="handleCreateProject('txt', node.relativePath)">新建 TXT</button>
                                <button type="button" @click.stop="handleCreateProject('md', node.relativePath)">新建 MD</button>
                              </div>
                            </div>
                            <WorkspaceFileActionMenu
                              v-if="hasActionMenu(node)"
                              :file-name="node.label"
                              :copy-visible="node.nodeType === 'file'"
                              :rename-visible="node.nodeType === 'file' || isTrackedProjectFolder(node)"
                              :download-visible="node.nodeType === 'file'"
                              :delete-visible="node.nodeType === 'file' || isTrackedProjectFolder(node)"
                              :rename-disabled="isRenameDisabled(node)"
                              :rename-disabled-reason="getRenameDisabledReason(node)"
                              :delete-disabled="isEntryDeleteDisabled(node)"
                              :delete-disabled-reason="node.nodeType === 'file' ? getWorkspaceActionDisabledReason(node.fileId, node.label, '删除') : undefined"
                              @copy-file-name="node.nodeType === 'file' ? emitCopyFileName(node.fileId) : undefined"
                              @rename="startInlineRename(node)"
                              @download="node.nodeType === 'file' ? emitDownloadFile(node.fileId) : undefined"
                              @delete="emitDeleteEntry(node)"
                            />
                          </div>
                        </div>
                        <div
                          v-if="group.id === 'project' && creatingKind && createParentPath === node.relativePath"
                          class="workspace-sidebar__file-row"
                          :style="{ '--workspace-node-depth': node.depth + 1 }"
                        >
                          <div class="workspace-sidebar__file workspace-sidebar__file--editing">
                            <svg viewBox="0 0 24 24" class="icon-svg">
                              <path
                                v-if="creatingKind === 'folder'"
                                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                              />
                              <template v-else>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </template>
                            </svg>
                            <div class="workspace-sidebar__rename-stack">
                              <div class="workspace-sidebar__rename-editor">
                                <input
                                  :ref="setCreateInputRef"
                                  class="workspace-sidebar__rename-input"
                                  :value="createDraft"
                                  :disabled="isSubmittingCreate"
                                  :aria-label="creatingKind === 'folder' ? '在当前文件夹中新建文件夹' : '在当前文件夹中新建文件'"
                                  @input="updateCreateDraft(($event.target as HTMLInputElement).value)"
                                  @keydown.enter.prevent="submitProjectCreate()"
                                  @keydown.escape.prevent="cancelProjectCreate()"
                                  @click.stop
                                  @dblclick.stop
                                  @blur="submitProjectCreate()"
                                />
                                <span v-if="createExtension" class="workspace-sidebar__rename-extension" aria-hidden="true">
                                  {{ createExtension }}
                                </span>
                              </div>
                              <p v-if="createError" class="workspace-sidebar__rename-error">{{ createError }}</p>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>

        <div v-else class="workspace-sidebar__panel workspace-sidebar__panel--templates" role="tabpanel">
          <section class="workspace-sidebar__section">
            <p class="workspace-sidebar__coming-soon">功能建设中，敬请期待...</p>
          </section>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { AgentWorkspacePayload, WorkspaceSidebarEntry } from '@/api/types'
import WorkspaceFileActionMenu from './WorkspaceFileActionMenu.vue'
import {
  buildWorkspaceFileNamePresentation,
  type WorkspaceFileNamePresentation
} from './workspaceFileNamePresentation'
import type { WorkspaceSidebarTab } from '@/stores/workbenchStore'
import { buildWorkspaceRenameTarget, resolveWorkspaceRenameParts } from '@/stores/workspaceRename'

interface TreeNodeBase {
  nodeId: string
  groupId: 'upload' | 'project'
  relativePath: string
  label: string
  depth: number
  addedAt: number
  namePresentation: WorkspaceFileNamePresentation
}

interface TreeFileNode extends TreeNodeBase {
  nodeType: 'file'
  fileId: string
  fileKey: string
}

interface TreeFolderNode extends TreeNodeBase {
  nodeType: 'folder'
  folderKey: string
  explicit: boolean
  children: TreeNode[]
}

type TreeNode = TreeFileNode | TreeFolderNode

const props = defineProps<{
  tasks: AgentWorkspacePayload['tasks']
  activeTab: WorkspaceSidebarTab
  collapsed: boolean
  widthPx?: number
  externalRenameRequest?: {
    fileId: string
    requestKey: number
  } | null
  selectedFileId: string | null
  activeFileId: string | null
  isRunning: boolean
  dirtyFileIds: string[]
  submitRenameFile: (fileId: string, nextFileName: string) => Promise<boolean>
  submitRenameFolder: (folderKey: string, nextFolderName: string) => Promise<boolean>
  createProjectEntry: (
    kind: 'folder' | 'txt' | 'md',
    fileName: string,
    parentPath?: string | null
  ) => Promise<boolean>
}>()

const emit = defineEmits<{
  (event: 'select-file', fileId: string): void
  (event: 'open-file', fileId: string): void
  (event: 'copy-file-name', fileId: string): void
  (event: 'download-file', fileId: string): void
  (event: 'delete-file', fileId: string): void
  (event: 'toggle-collapse', nextValue: boolean): void
  (event: 'change-tab', tab: WorkspaceSidebarTab): void
}>()

const dirtyFileIdSet = computed(() => new Set(props.dirtyFileIds))
const editingNodeId = ref<string | null>(null)
const renameDraft = ref('')
const renameExtension = ref('')
const renameError = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const isSubmittingRename = ref(false)
const creatingKind = ref<'folder' | 'txt' | 'md' | null>(null)
const createDraft = ref('')
const createExtension = ref('')
const createError = ref('')
const createInput = ref<HTMLInputElement | null>(null)
const isSubmittingCreate = ref(false)
const createParentPath = ref<string | null>(null)
const expandedFolderIds = ref(new Set<string>())
const collapsedGroupIds = ref(new Set<string>())
const newMenuOpen = ref(false)
const newMenuTrigger = ref<HTMLElement | null>(null)
const newMenuDropdown = ref<HTMLElement | null>(null)
const contextualCreateFolderId = ref<string | null>(null)

const groupTreeMap = computed<Record<'upload' | 'project', TreeNode[]>>(() => {
  const groups = props.tasks.flatMap(task => task.groups)
  return {
    upload: buildGroupTree(groups.find(group => group.id === 'upload')?.entries || [], 'upload'),
    project: buildGroupTree(groups.find(group => group.id === 'project')?.entries || [], 'project')
  }
})

const groupVisibleNodeMap = computed<Record<'upload' | 'project', TreeNode[]>>(() => ({
  upload: flattenVisibleNodes(groupTreeMap.value.upload, expandedFolderIds.value),
  project: flattenVisibleNodes(groupTreeMap.value.project, expandedFolderIds.value)
}))

function resolveLeafLabel(relativePath: string): string {
  return relativePath.split('/').filter(Boolean).at(-1) || relativePath
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .sort((left, right) => {
      if (left.nodeType !== right.nodeType) {
        return left.nodeType === 'folder' ? -1 : 1
      }
      return right.addedAt - left.addedAt
    })
    .map(node => {
      if (node.nodeType === 'folder') {
        return {
          ...node,
          children: sortNodes([...node.children])
        }
      }
      return node
    })
}

function createNamePresentation(label: string): WorkspaceFileNamePresentation {
  return buildWorkspaceFileNamePresentation(label)
}

function buildGroupTree(entries: WorkspaceSidebarEntry[], groupId: 'upload' | 'project'): TreeNode[] {
  const root: TreeFolderNode = {
    nodeId: `root:${groupId}`,
    folderKey: `root:${groupId}`,
    nodeType: 'folder',
    groupId,
    relativePath: '',
    label: groupId,
    depth: -1,
    addedAt: 0,
    namePresentation: createNamePresentation(groupId),
    explicit: true,
    children: []
  }
  const folders = new Map<string, TreeFolderNode>([['', root]])

  function ensureFolder(path: string, explicitEntry?: WorkspaceSidebarEntry): TreeFolderNode {
    if (folders.has(path)) {
      const existing = folders.get(path)!
      if (explicitEntry?.nodeType === 'folder') {
        existing.nodeId = explicitEntry.nodeId
        existing.folderKey = explicitEntry.folderKey
      }
      return existing
    }
    const parentPath = path.split('/').slice(0, -1).join('/')
    const parent = ensureFolder(parentPath)
    const node: TreeFolderNode = {
      nodeId: explicitEntry?.nodeType === 'folder' ? explicitEntry.nodeId : `implicit:${groupId}:${path}`,
      folderKey: explicitEntry?.nodeType === 'folder' ? explicitEntry.folderKey : `implicit:${groupId}:${path}`,
      nodeType: 'folder',
      groupId,
      relativePath: path,
      label: resolveLeafLabel(path),
      depth: path ? path.split('/').length - 1 : 0,
      addedAt: explicitEntry?.addedAt ?? 0,
      namePresentation: createNamePresentation(resolveLeafLabel(path)),
      explicit: explicitEntry?.nodeType === 'folder',
      children: []
    }
    parent.children.push(node)
    folders.set(path, node)
    return node
  }

  for (const entry of entries.filter(item => item.nodeType === 'folder')) {
    ensureFolder(entry.relativePath, entry)
  }
  for (const entry of entries.filter(item => item.nodeType === 'file')) {
    const parentPath = entry.relativePath.split('/').slice(0, -1).join('/')
    const parent = ensureFolder(parentPath)
    parent.children.push({
      nodeId: entry.nodeId,
      fileId: entry.fileId,
      fileKey: entry.fileKey,
      nodeType: 'file',
      groupId,
      relativePath: entry.relativePath,
      label: resolveLeafLabel(entry.relativePath),
      depth: entry.relativePath.split('/').length - 1,
      addedAt: entry.addedAt,
      namePresentation: createNamePresentation(resolveLeafLabel(entry.relativePath))
    })
  }
  return sortNodes(root.children)
}

function walkTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap(node => node.nodeType === 'folder'
    ? [node, ...walkTree(node.children)]
    : [node])
}

function flattenVisibleNodes(nodes: TreeNode[], expandedIds: Set<string>): TreeNode[] {
  return nodes.flatMap(node => {
    if (node.nodeType !== 'folder') return [node]
    if (!expandedIds.has(node.nodeId)) return [node]
    return [node, ...flattenVisibleNodes(node.children, expandedIds)]
  })
}

function ensureFoldersExpanded(): void {
  const next = new Set(expandedFolderIds.value)
  for (const node of walkTree([...groupTreeMap.value.upload, ...groupTreeMap.value.project])) {
    if (node.nodeType === 'folder') {
      next.add(node.nodeId)
    }
  }
  expandedFolderIds.value = next
}

function emitDownloadFile(fileId: string): void {
  emit('download-file', fileId)
}

function emitCopyFileName(fileId: string): void {
  emit('copy-file-name', fileId)
}

function emitDeleteFile(fileId: string): void {
  emit('delete-file', fileId)
}

function emitDeleteEntry(node: TreeNode): void {
  emitDeleteFile(node.nodeType === 'file' ? node.fileId : node.nodeId)
}

function handleNodeClick(node: TreeNode): void {
  emit('select-file', node.nodeType === 'folder' ? node.nodeId : node.fileId)
  if (node.nodeType === 'folder') {
    toggleFolder(node.nodeId)
  }
}

function handleNodeDoubleClick(node: TreeNode): void {
  if (node.nodeType === 'folder') return
  emit('open-file', node.fileId)
}

function toggleFolder(nodeId: string): void {
  const next = new Set(expandedFolderIds.value)
  if (next.has(nodeId)) {
    next.delete(nodeId)
  } else {
    next.add(nodeId)
  }
  expandedFolderIds.value = next
}

function toggleGroupCollapse(groupId: string): void {
  const next = new Set(collapsedGroupIds.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  collapsedGroupIds.value = next
}

function isTrackedProjectFolder(node: TreeNode): node is TreeFolderNode {
  return node.nodeType === 'folder' && node.groupId === 'project' && node.explicit
}

function isCreateContextProjectFolder(node: TreeNode): node is TreeFolderNode {
  return node.nodeType === 'folder' && node.groupId === 'project'
}

function hasActionMenu(node: TreeNode): boolean {
  return node.nodeType === 'file' || isTrackedProjectFolder(node)
}

function isContextCreateMenuOpen(nodeId: string): boolean {
  return contextualCreateFolderId.value === nodeId
}

function toggleContextCreateMenu(node: TreeFolderNode): void {
  contextualCreateFolderId.value = contextualCreateFolderId.value === node.nodeId ? null : node.nodeId
  closeNewMenu()
}

function isEntryDeleteDisabled(node: TreeNode): boolean {
  if (props.isRunning) return true
  return node.nodeType === 'file' && dirtyFileIdSet.value.has(node.fileId)
}

function getWorkspaceActionDisabledReason(
  fileId: string,
  fileName: string,
  actionLabel: '删除' | '重命名'
): string | undefined {
  if (props.isRunning) {
    return `当前会话正在运行，暂不支持${actionLabel}工作区文件。`
  }
  if (dirtyFileIdSet.value.has(fileId)) {
    return `文件“${fileName}”有未保存修改，请先保存后再${actionLabel}。`
  }
  return undefined
}

function isRenameDisabled(node: TreeNode): boolean {
  if (props.isRunning) return true
  return node.nodeType === 'file' && dirtyFileIdSet.value.has(node.fileId)
}

function getRenameDisabledReason(node: TreeNode): string | undefined {
  if (props.isRunning) {
    return '当前会话正在运行，暂不支持重命名。'
  }
  if (node.nodeType === 'file' && dirtyFileIdSet.value.has(node.fileId)) {
    return `文件“${node.label}”有未保存修改，请先保存。`
  }
  return undefined
}

function isInlineRenaming(nodeId: string): boolean {
  return editingNodeId.value === nodeId
}

function clearInlineRename(): void {
  editingNodeId.value = null
  renameDraft.value = ''
  renameExtension.value = ''
  renameError.value = ''
}

function clearProjectCreate(): void {
  creatingKind.value = null
  createDraft.value = ''
  createExtension.value = ''
  createError.value = ''
  createParentPath.value = null
}

function closeNewMenu(): void {
  newMenuOpen.value = false
}

function startInlineRename(node: TreeNode): void {
  if (isSubmittingRename.value || isRenameDisabled(node)) return
  const parts = node.nodeType === 'file'
    ? resolveWorkspaceRenameParts(node.label)
    : { editableStem: node.label, extension: '' }
  editingNodeId.value = node.nodeId
  renameDraft.value = parts.editableStem
  renameExtension.value = parts.extension
  renameError.value = ''
}

function resolveRenameTargetNode(fileId: string): TreeNode | undefined {
  return walkTree([...groupTreeMap.value.upload, ...groupTreeMap.value.project])
    .find(node => node.nodeType === 'file' && node.fileId === fileId)
}

function updateRenameDraft(value: string): void {
  renameDraft.value = value
  if (renameError.value) {
    renameError.value = ''
  }
}

function setRenameInputRef(element: Element | ComponentPublicInstance | null): void {
  renameInput.value = element instanceof HTMLInputElement ? element : null
}

function cancelInlineRename(): void {
  if (isSubmittingRename.value) return
  clearInlineRename()
}

async function submitInlineRename(): Promise<void> {
  if (!editingNodeId.value || isSubmittingRename.value) return
  const node = walkTree([...groupTreeMap.value.upload, ...groupTreeMap.value.project])
    .find(item => item.nodeId === editingNodeId.value)
  if (!node) {
    clearInlineRename()
    return
  }
  let nextName = ''
  try {
    nextName = buildWorkspaceRenameTarget(renameDraft.value.trim(), renameExtension.value)
  } catch (err) {
    renameError.value = (err as Error).message
    return
  }

  isSubmittingRename.value = true
  try {
    const success = node.nodeType === 'folder'
      ? await props.submitRenameFolder(node.folderKey, nextName)
      : await props.submitRenameFile(node.fileId, nextName)
    if (success) {
      clearInlineRename()
    }
  } finally {
    isSubmittingRename.value = false
  }
}

function startProjectCreate(
  kind: 'folder' | 'txt' | 'md',
  parentPath: string | null = null
): void {
  if (isSubmittingCreate.value) return
  creatingKind.value = kind
  createDraft.value = ''
  createExtension.value = kind === 'folder' ? '' : `.${kind}`
  createError.value = ''
  createParentPath.value = parentPath
  closeNewMenu()
  contextualCreateFolderId.value = null
}

function updateCreateDraft(value: string): void {
  createDraft.value = value
  if (createError.value) {
    createError.value = ''
  }
}

function setCreateInputRef(element: Element | ComponentPublicInstance | null): void {
  createInput.value = element instanceof HTMLInputElement ? element : null
}

function setNewMenuTriggerRef(element: Element | ComponentPublicInstance | null): void {
  newMenuTrigger.value = element instanceof HTMLElement ? element : null
}

function setNewMenuDropdownRef(element: Element | ComponentPublicInstance | null): void {
  newMenuDropdown.value = element instanceof HTMLElement ? element : null
}

function cancelProjectCreate(): void {
  if (isSubmittingCreate.value) return
  clearProjectCreate()
}

async function submitProjectCreate(): Promise<void> {
  if (!creatingKind.value || isSubmittingCreate.value) return
  let fileName = ''
  try {
    fileName = buildWorkspaceRenameTarget(createDraft.value.trim(), createExtension.value)
  } catch (err) {
    createError.value = (err as Error).message
    return
  }

  isSubmittingCreate.value = true
  try {
    const success = await props.createProjectEntry(creatingKind.value, fileName, createParentPath.value)
    if (success) {
      clearProjectCreate()
    }
  } finally {
    isSubmittingCreate.value = false
  }
}

function toggleNewMenu(): void {
  contextualCreateFolderId.value = null
  newMenuOpen.value = !newMenuOpen.value
}

function isWithinNewMenu(target: Node): boolean {
  return Boolean(
    newMenuTrigger.value?.contains(target) || newMenuDropdown.value?.contains(target)
  )
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!newMenuOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (isWithinNewMenu(target)) return
  closeNewMenu()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!newMenuOpen.value) return
  if (event.key !== 'Escape') return
  closeNewMenu()
}

async function handleCreateProject(
  kind: 'folder' | 'txt' | 'md',
  parentPath: string | null = null
): Promise<void> {
  startProjectCreate(kind, parentPath)
}

watch(groupTreeMap, () => {
  ensureFoldersExpanded()
}, { immediate: true })

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

watch(() => props.collapsed, collapsed => {
  if (!collapsed) return
  closeNewMenu()
  contextualCreateFolderId.value = null
  clearInlineRename()
  clearProjectCreate()
})

watch(editingNodeId, async nodeId => {
  if (!nodeId) return
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
})

watch(creatingKind, async kind => {
  if (!kind) return
  await nextTick()
  createInput.value?.focus()
  createInput.value?.select()
})

watch(
  () => props.externalRenameRequest?.requestKey,
  requestKey => {
    if (!requestKey || !props.externalRenameRequest) return
    const targetNode = resolveRenameTargetNode(props.externalRenameRequest.fileId)
    if (!targetNode) return
    startInlineRename(targetNode)
  },
  { immediate: true }
)
</script>

<style scoped>
.workspace-sidebar {
  width: var(--workspace-sidebar-width, 320px);
  display: flex;
  min-width: 0;
  min-height: 0;
  block-size: 100%;
  overflow: hidden;
}

.workspace-sidebar__shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  block-size: 100%;
  padding: 0;
  overflow: hidden;
}

.workspace-sidebar__head {
  min-block-size: var(--chrome-secondary-b);
  padding-inline: var(--pane-inline);
  padding-block: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.workspace-sidebar__tabs {
  flex: 1;
  min-width: 0;
}

.workspace-sidebar__tab {
  padding-inline: 10px;
  min-width: 0;
}

.workspace-sidebar__toggle {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: var(--surface-panel);
  color: var(--text-secondary);
}

.workspace-sidebar__toggle:hover,
.workspace-sidebar__toggle:focus-visible {
  border-color: var(--accent-light);
  background: var(--accent-lighter);
  color: var(--accent);
  outline: none;
}

.workspace-sidebar__panels {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace-sidebar__panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--pane-block) var(--pane-inline) 18px;
}

.workspace-sidebar__section,
.workspace-sidebar__tree,
.workspace-sidebar__task,
.workspace-sidebar__group-wrap {
  min-width: 0;
}

.workspace-sidebar__section-title,
.workspace-sidebar__file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-sidebar__section-title {
  font-size: var(--font-title);
}

.workspace-sidebar__group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-block: 12px 8px;
  font-size: var(--font-dense);
  width: 100%;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 4px 6px;
  cursor: pointer;
  color: inherit;
  text-align: left;
}

.workspace-sidebar__group-row:hover {
  background: var(--surface-subtle);
}

.workspace-sidebar__group-meta,
.workspace-sidebar__group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-sidebar__group-count {
  color: var(--text-tertiary);
  font-size: var(--font-meta);
}

.workspace-sidebar__group-caret {
  width: 16px;
  font-size: 14px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.workspace-sidebar__new-menu {
  position: relative;
}

.workspace-sidebar__new-dropdown {
  position: absolute;
  inset-block-start: calc(100% + 6px);
  inset-inline-end: 0;
  display: grid;
  gap: 4px;
  min-width: 132px;
  padding: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-md);
  z-index: 4;
}

.workspace-sidebar__new-dropdown button {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
}

.workspace-sidebar__group-tree {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.workspace-sidebar__file-row {
  min-width: 0;
  padding-inline-start: calc(var(--workspace-node-depth, 0) * 14px);
}

.workspace-sidebar__row-actions {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.workspace-sidebar__file {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  padding: 8px 10px;
  text-align: left;
  flex-wrap: nowrap;
}

.workspace-sidebar__file--selected {
  background: var(--surface-subtle);
}

.workspace-sidebar__file--active {
  border-color: var(--accent-light);
  background: var(--accent-lighter);
}

.workspace-sidebar__file--editing .icon-svg {
  flex-shrink: 0;
}

.workspace-sidebar__file-name {
  min-width: 0;
  max-width: 100%;
  display: flex;
  align-items: baseline;
  gap: 0;
  overflow: hidden;
  white-space: nowrap;
}

.workspace-sidebar__file-label {
  min-width: 0;
  flex: 1;
  position: relative;
}

.workspace-sidebar__file-stem {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-sidebar__file-suffix {
  flex: 0 0 auto;
  white-space: nowrap;
}

.workspace-sidebar__file-reveal {
  position: absolute;
  inset-inline-start: 0;
  inset-inline-end: 0;
  inset-block-end: calc(100% + 8px);
  z-index: 8;
  max-inline-size: min(36ch, calc(100vw - 96px));
  word-break: break-all;
  padding: 6px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-md);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 140ms ease, transform 140ms ease;
  white-space: normal;
}

.workspace-sidebar__file:hover .workspace-sidebar__file-reveal,
.workspace-sidebar__file:focus-visible .workspace-sidebar__file-reveal {
  opacity: 1;
  transform: translateY(0);
}

.workspace-sidebar__caret {
  width: 12px;
  color: var(--text-tertiary);
}

.workspace-sidebar__context-new-menu {
  position: relative;
}

.workspace-sidebar__context-new-trigger,
.workspace-sidebar__new-trigger {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
}

.workspace-sidebar__context-new-trigger:hover,
.workspace-sidebar__new-trigger:hover,
.workspace-sidebar__context-new-trigger:focus-visible,
.workspace-sidebar__new-trigger:focus-visible,
.workspace-sidebar__new-dropdown button:hover,
.workspace-sidebar__new-dropdown button:focus-visible,
.workspace-sidebar__context-new-dropdown button:hover,
.workspace-sidebar__context-new-dropdown button:focus-visible {
  border-color: var(--line-subtle);
  background: var(--surface-subtle);
  color: var(--text-primary);
}

.workspace-sidebar__context-new-dropdown {
  position: absolute;
  inset-block-start: calc(100% + 6px);
  inset-inline-end: 0;
  display: grid;
  gap: 4px;
  min-width: 132px;
  padding: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-md);
  z-index: 4;
}

.workspace-sidebar__context-new-dropdown button {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
}

.workspace-sidebar__rename-stack {
  flex: 1;
}

.workspace-sidebar__rename-editor {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.workspace-sidebar__rename-input {
  flex: 0 1 auto;
  min-width: 0;
}

.workspace-sidebar__rename-error {
  color: var(--danger, #d14343);
  font-size: var(--font-meta);
}

.workspace-sidebar__empty,
.workspace-sidebar__group-empty,
.workspace-sidebar__coming-soon {
  color: var(--text-tertiary);
  font-size: var(--font-meta);
}

@media (max-width: 1120px) {
  .workspace-sidebar__head {
    padding-inline: calc(var(--pane-inline) * 0.85);
    gap: 6px;
  }

  .workspace-sidebar__tab {
    padding-inline: 8px;
    font-size: var(--font-meta);
  }

  .workspace-sidebar__panel {
    padding-inline: calc(var(--pane-inline) * 0.85);
  }
}
</style>
