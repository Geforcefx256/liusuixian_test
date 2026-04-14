<template>
  <section class="workspace-editor">
    <div class="workspace-editor__contextbar">
      <div class="workspace-editor__tab-row">
        <div class="workspace-editor__tab-strip">
          <button
            v-for="file in openFiles"
            :key="file.fileId"
            class="workspace-editor__tab"
            :class="{ 'workspace-editor__tab--active': file.fileId === activeFileId }"
            type="button"
            @click="$emit('select-file', file.fileId)"
            @mouseenter="showTabTooltip(file.fileName, $event)"
            @mouseleave="hideTabTooltip"
          >
            <span class="workspace-editor__tab-title">
              <span class="workspace-editor__tab-title__base">{{ splitFileName(file.fileName).base }}</span>
              <span v-if="splitFileName(file.fileName).ext" class="workspace-editor__tab-title__ext">{{ splitFileName(file.fileName).ext }}</span>
              <small v-if="file.isDirty || hasIncompleteRowsForFile(file.fileId)" class="workspace-editor__dirty-dot">●</small>
            </span>
            <span
              class="workspace-editor__tab-close"
              role="button"
              tabindex="0"
              @click.stop="$emit('close-file', file.fileId)"
              @keydown.enter.stop="$emit('close-file', file.fileId)"
            >
              ×
            </span>
          </button>
          <Teleport to="body">
            <Transition name="tab-tooltip">
              <span
                v-if="tabTooltip.visible"
                class="workspace-editor__tab-tooltip"
                aria-hidden="true"
                :style="{ left: tabTooltip.x + 'px', top: tabTooltip.y + 'px' }"
              >{{ tabTooltip.text }}</span>
            </Transition>
          </Teleport>
        </div>
        <WorkspaceFileActionMenu
          v-if="activeFile"
          class="workspace-editor__tab-actions"
          :file-name="activeFile.fileName"
          :copy-visible="true"
          :rename-visible="true"
          :download-visible="true"
          :delete-visible="true"
          :rename-disabled="selectedFileRenameDisabled"
          :rename-disabled-reason="selectedFileRenameDisabledReason"
          :delete-disabled="selectedFileDeleteDisabled"
          :delete-disabled-reason="selectedFileDeleteDisabledReason"
          @copy-file-name="emit('copy-file-name', activeFile.fileId)"
          @rename="emit('request-rename-file', activeFile.fileId)"
          @download="emit('download-file', activeFile.fileId)"
          @delete="emit('delete-file', activeFile.fileId)"
        />
      </div>

      <div class="workspace-editor__toolbar">
        <div class="workspace-editor__toolbar-main">
          <div class="workspace-editor__toolbar-group workspace-editor__toolbar-group--views">
            <div class="workspace-editor__toolbar-switch segmented-control segmented-control--compact">
              <button
                class="workspace-editor__tool-btn segmented-control__item"
                :class="{ 'workspace-editor__tool-btn--active segmented-control__item--active': viewMode === 'text' }"
                :aria-pressed="viewMode === 'text'"
                type="button"
                @click="setPrimaryView()"
              >
                {{ primaryViewLabel }}
              </button>
              <button
                class="workspace-editor__tool-btn segmented-control__item"
                :class="{ 'workspace-editor__tool-btn--active segmented-control__item--active': viewMode === secondaryViewMode }"
                :disabled="!activeFile || !supportsSecondaryView"
                :aria-pressed="viewMode === secondaryViewMode"
                type="button"
                @click="setSecondaryView()"
              >
                {{ secondaryViewLabel }}
              </button>
            </div>
          </div>
        </div>

        <div class="workspace-editor__toolbar-actions">
          <button
            v-if="showsMmlParsingEntry"
            class="workspace-editor__mml-entry"
            :class="{ 'workspace-editor__mml-entry--open': isMmlConfigOpen }"
            type="button"
            @click="toggleMmlConfig"
          >
            {{ isMmlConfigOpen ? '收起 MML 配置' : mmlParsingSummaryLabel }}
          </button>
          <span
            v-if="saveStateLabel"
            class="workspace-editor__save-state"
            :class="`workspace-editor__save-state--${saveTone}`"
          >
            {{ saveStateLabel }}
          </span>
          <button
            v-if="supportsTextEditorActions"
            class="workspace-editor__action-btn"
            type="button"
            @click="openTextSearch()"
          >
            搜索
          </button>
          <button
            class="workspace-editor__action-btn"
            :disabled="!activeFile || !activeFile.writable || activeFile.saveStatus === 'saving'"
            type="button"
            @click="handleSave()"
          >
            {{ activeFile?.saveStatus === 'saving' ? '保存中...' : activeFile?.writable === false ? '只读' : '保存' }}
          </button>
          <div v-if="supportsTextEditorActions" class="workspace-editor__more-menu">
            <button class="workspace-editor__action-btn" type="button" @click="toggleTextMoreMenu()">
              更多
            </button>
            <div v-if="isTextMoreMenuOpen" class="workspace-editor__more-menu-panel">
              <button
                class="workspace-editor__more-menu-item"
                type="button"
                :disabled="activeFile?.writable === false"
                @click="handleTextUndo()"
              >
                撤销
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showsMmlConfigArea" class="workspace-editor__mml-config">
        <div class="workspace-editor__mml-config-copy">
          <strong>按 MML 解析</strong>
          <p>{{ mmlConfigDescription }}</p>
        </div>
        <div class="workspace-editor__mml-config-grid">
          <label class="workspace-editor__mml-field">
            <span class="workspace-editor__mml-field-label">网元类型</span>
            <select
              class="workspace-editor__mml-field-select"
              :value="currentMmlNetworkType"
              :disabled="activeFile?.writable === false"
              @change="handleMetadataSelect('networkType', $event)"
            >
              <option value="">请选择</option>
              <option
                v-for="networkType in currentMmlNetworkTypeOptions"
                :key="networkType"
                :value="networkType"
              >
                {{ networkType }}
              </option>
            </select>
          </label>
          <label class="workspace-editor__mml-field">
            <span class="workspace-editor__mml-field-label">网元版本</span>
            <select
              class="workspace-editor__mml-field-select"
              :value="currentMmlNetworkVersion"
              :disabled="activeFile?.writable === false || !currentMmlNetworkType.trim()"
              @change="handleMetadataSelect('networkVersion', $event)"
            >
              <option value="">请选择</option>
              <option
                v-for="networkVersion in currentMmlNetworkVersionOptions"
                :key="networkVersion"
                :value="networkVersion"
              >
                {{ networkVersion }}
              </option>
            </select>
          </label>
        </div>
        <div class="workspace-editor__mml-config-status">
          <span class="workspace-editor__summary-pill">{{ mmlConfigStatusLabel }}</span>
        </div>
      </div>
    </div>

      <div v-if="activeFile" class="workspace-editor__body">
      <div v-show="viewMode === 'text'" class="workspace-editor__text-view">
        <WorkspaceTextSearchBar
          v-if="supportsTextEditorActions && isTextSearchOpen"
          :model-value="textSearchQuery"
          :replace-value="textReplaceQuery"
          :replace-expanded="isTextReplaceOpen"
          :can-replace="canUseTextReplaceActions"
          @update:model-value="handleTextSearchQueryInput"
          @update:replace-value="textReplaceQuery = $event"
          @toggle-replace="toggleTextReplace"
          @previous="handleTextSearchPrevious"
          @next="handleTextSearchNext"
          @close="closeTextSearch"
          @replace-current="handleTextReplaceCurrent"
          @replace-all="handleTextReplaceAll"
        />
        <WorkspaceTextEditor
          v-if="shouldMountTextEditor"
          :key="activeFile.fileId"
          ref="textEditorRef"
          class="workspace-editor__text-editor-surface"
          :model-value="activeFile.content"
          :file-mode="activeTextEditorFileMode"
          :mml-schema="activeFile.mode === 'mml' ? mmlSchema : null"
          :active-diagnostic-id="activeTextDiagnosticId"
          @update:model-value="handleTextEditorUpdate"
          @diagnostics-change="handleTextDiagnosticsChange"
          @blur="handleEditorBlur"
        />
        <textarea
          v-else
          class="workspace-editor__textarea workspace-editor__text-editor-surface"
          :value="activeFile.content"
          :readonly="activeFile.writable === false"
          spellcheck="false"
          @input="handleContentInput"
          @blur="handleEditorBlur"
        />
      </div>

      <div v-show="viewMode === 'preview'" class="workspace-editor__preview-view">
        <WorkspaceMarkdownPreview
          v-if="activeFile.mode === 'markdown'"
          :source="activeFile.content"
        />
        <div v-else class="workspace-editor__empty-state workspace-editor__empty-state--sheet">
          <h3>当前文件不支持预览视图</h3>
          <p>{{ previewViewHint }}</p>
        </div>
      </div>

      <div
        v-show="viewMode === 'table'"
        class="workspace-editor__table-view"
        :class="{ 'workspace-editor__table-view--mml': activeFile.mode === 'mml' }"
      >
        <template v-if="activeFile.mode === 'csv'">
          <div class="workspace-editor__summary">
            <div>
              <h3>汇总</h3>
              <p>{{ tableRows.length }} 行，{{ tableColumns.length }} 列</p>
            </div>
          </div>
          <div class="workspace-editor__table-wrap">
            <table class="workspace-editor__table">
              <thead>
                <tr>
                  <th v-for="column in tableColumns" :key="column">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in tableRows" :key="rowIndex">
                  <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="activeFile.mode === 'mml'">
          <div class="workspace-editor__mml-workbook">
            <div class="workspace-editor__mml-shell">
              <div class="workspace-editor__mml-tabs">
                <button
                  class="workspace-editor__mml-tab workspace-editor__mml-tab--summary"
                  :class="{ 'workspace-editor__mml-tab--active': isMmlSummarySheetActive }"
                  type="button"
                  @click="selectMmlSheet(MML_SUMMARY_SHEET_KEY)"
                >
                  汇总
                </button>
                <button
                  v-for="sheet in mmlWorkbook?.sheets || []"
                  :key="sheet.key"
                  class="workspace-editor__mml-tab"
                  :class="{ 'workspace-editor__mml-tab--active': sheet.key === activeMmlSheetKey }"
                  type="button"
                  @click="selectMmlSheet(sheet.key)"
                >
                  {{ sheet.commandHead }}
                </button>
              </div>

              <div
                v-if="isMmlSummarySheetActive"
                class="workspace-editor__mml-summary-page workspace-editor__mml-sheet-surface workspace-editor__mml-sheet-surface--summary"
              >
                <div class="workspace-editor__mml-summary-hero">
                  <div>
                    <h3>汇总</h3>
                    <p>{{ mmlWorkbookSummary }}</p>
                  </div>
                  <div class="workspace-editor__summary-meta">
                    <span class="workspace-editor__summary-pill">{{ mmlConfigStatusLabel }}</span>
                  </div>
                </div>

                <input
                  v-if="mmlWorkbook?.sheets.length"
                  class="workspace-editor__mml-summary-search"
                  type="text"
                  placeholder="搜索命令..."
                  :value="mmlSummarySearchQuery"
                  @input="mmlSummarySearchQuery = ($event.target as HTMLInputElement).value"
                >

                <div v-if="mmlWorkbook?.sheets.length && filteredMmlSheets.length" class="workspace-editor__mml-summary-grid">
                  <button
                    v-for="sheet in filteredMmlSheets"
                    :key="sheet.key"
                    class="workspace-editor__mml-summary-card"
                    type="button"
                    @click="selectMmlSheet(sheet.key)"
                  >
                    <strong>{{ sheet.commandHead }}</strong>
                    <span>{{ sheet.rows.length }} 条语句</span>
                    <span>{{ sheet.editableRowCount }} 可编辑 / {{ sheet.readOnlyRowCount }} 只读</span>
                  </button>
                </div>

                <div v-else-if="mmlWorkbook?.sheets.length && !filteredMmlSheets.length && mmlSummarySearchQuery.trim()" class="workspace-editor__empty-state workspace-editor__empty-state--sheet">
                  <h3>未找到匹配的命令</h3>
                </div>

                <div v-else class="workspace-editor__empty-state workspace-editor__empty-state--sheet">
                  <h3>未识别到任何MML命令，请在文本视图下增加命令。</h3>
                </div>
              </div>

              <div
                v-else
                class="workspace-editor__mml-grid-panel workspace-editor__mml-sheet-surface workspace-editor__mml-sheet-surface--grid"
              >
                <div v-if="activeMmlGridSheet" class="workspace-editor__table-wrap workspace-editor__table-wrap--mml-grid">
                  <MmlWorkbookGrid
                    :key="`${activeFile.fileId}:${activeMmlGridSheet.key}`"
                    :sheet="activeMmlGridSheet"
                    :selected-range="activeMmlSelection"
                    :incomplete-rows="activeMmlIncompleteRows"
                    :read-only="activeFile.writable === false"
                    @selection-change="handleMmlSelectionChange"
                    @cell-change="handleMmlCellChange"
                    @spare-cell-change="handleMmlSpareCellChange"
                    @range-paste="handleMmlRangePaste"
                    @blocked-edit="handleMmlGridBlockedEdit"
                    @composite-edit-request="handleCompositeEditRequest"
                  />
                </div>

                <div v-else class="workspace-editor__empty-state workspace-editor__empty-state--sheet">
                  <h3>未识别到任何MML命令，请在文本视图下增加命令。</h3>
                </div>
              </div>
            </div>

            <div v-if="compositeEditorState" class="workspace-editor__composite-editor">
              <div class="workspace-editor__composite-editor-header">
                <strong>{{ compositeEditorState.columnLabel }}</strong>
                <span>R{{ compositeEditorState.rowNumber }} · 模板化编辑</span>
              </div>
              <div class="workspace-editor__composite-editor-actions">
                <button type="button" class="workspace-editor__tool-btn" @click="enableAllCompositeOptions">Enable All</button>
                <button type="button" class="workspace-editor__tool-btn" @click="disableAllCompositeOptions">Disable All</button>
              </div>
              <div class="workspace-editor__composite-editor-grid">
                <label
                  v-for="option in compositeEditorState.options"
                  :key="option"
                  class="workspace-editor__composite-option"
                >
                  <input
                    type="checkbox"
                    :checked="compositeEditorEnabledSet.has(option)"
                    @change="toggleCompositeOption(option)"
                  >
                  <span>{{ option }}</span>
                </label>
              </div>
              <div class="workspace-editor__composite-editor-footer">
                <button type="button" class="workspace-editor__tool-btn" @click="closeCompositeEditor">取消</button>
                <button type="button" class="workspace-editor__action-btn" @click="applyCompositeEditor">应用</button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="workspace-editor__empty-state workspace-editor__empty-state--sheet">
            <h3>当前文件暂不可用表格视图</h3>
            <p>{{ tableViewHint }}</p>
          </div>
        </template>
      </div>

      <div class="workspace-editor__statusbar">
        <div class="workspace-editor__status-left">
          <span v-if="shouldShowStatusFileName">{{ activeFile.fileName }}</span>
          <span v-if="viewMode === 'table' && activeFile.mode === 'mml'">{{ mmlConfigStatusLabel }}</span>
          <span v-if="viewMode === 'table' && activeFile.mode === 'mml' && isMmlSummarySheetActive">
            汇总 · {{ mmlWorkbookSummary }}
          </span>
          <span v-else-if="viewMode === 'table' && activeFile.mode === 'mml' && activeMmlSheet">
            {{ activeMmlSheet.commandHead }} · {{ activeMmlSheet.editableRowCount }} 可编辑 / {{ activeMmlSheet.readOnlyRowCount }} 只读
          </span>
        </div>
        <div class="workspace-editor__status-right">
          <button
            v-if="viewMode === 'text' && activeFile.mode === 'mml' && activeTextDiagnostics.length"
            class="workspace-editor__status-action"
            type="button"
            @click="toggleTextDiagnosticsPanel"
          >
            {{ textDiagnosticSummaryLabel }} {{ textDiagnosticsExpanded ? '▾' : '▸' }}
          </button>
          <span v-if="viewMode === 'table' && activeFile.mode === 'mml' && mmlTableStatusMessage">
            {{ mmlTableStatusMessage }}
          </span>
          <span v-if="saveStateLabel">{{ saveStateLabel }}</span>
        </div>
      </div>

      <div
        v-if="viewMode === 'text' && activeFile.mode === 'mml' && textDiagnosticsExpanded && activeTextDiagnostics.length"
        class="workspace-editor__diagnostic-panel"
      >
        <div class="workspace-editor__diagnostic-panel-header">
          <strong>诊断</strong>
          <button class="workspace-editor__status-action" type="button" @click="toggleTextDiagnosticsPanel">收起</button>
        </div>
        <div class="workspace-editor__diagnostic-list">
          <button
            v-for="diagnostic in activeTextDiagnostics"
            :key="diagnostic.id"
            class="workspace-editor__diagnostic-item"
            :class="{ 'workspace-editor__diagnostic-item--active': diagnostic.id === activeTextDiagnosticId }"
            type="button"
            @click="selectTextDiagnostic(diagnostic.id)"
          >
            <span
              class="workspace-editor__diagnostic-severity"
              :class="`workspace-editor__diagnostic-severity--${diagnostic.severity}`"
            >
              {{ diagnostic.severity === 'error' ? 'Error' : 'Warning' }}
            </span>
            <span class="workspace-editor__diagnostic-location">L{{ diagnostic.startLineNumber }} · {{ diagnostic.commandHead }}</span>
            <span class="workspace-editor__diagnostic-message">{{ diagnostic.message }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import MmlWorkbookGrid from './MmlWorkbookGrid.vue'
import WorkspaceMarkdownPreview from './WorkspaceMarkdownPreview.vue'
import WorkspaceTextSearchBar from './WorkspaceTextSearchBar.vue'
import WorkspaceTextEditor from './WorkspaceTextEditor.vue'
import { mmlSchemaApi } from '@/api/mmlSchemaApi'
import type { MmlSchemaResponse, MmlTypeVersionOptions, WorkspaceMmlMetadata } from '@/api/types'
import type { WorkspaceEditorFileState } from '@/stores/workbenchStore'
import {
  applyMmlCellEdit,
  applyMmlRangePaste,
  appendMmlStatementsToSheet,
  buildMmlGridSheet,
  buildMmlWorkbook,
  materializeMmlDraftRow,
  normalizePasteMatrix,
  type MmlIncompleteRowState,
  type MmlPasteTargetRange,
  type MmlSchemaAvailability,
  type MmlSelectionRange
} from './mmlWorkbook'
import { parseCompositeFlagSetValue, serializeCompositeFlagSetValue } from './mmlSemantics'

interface WorkspaceTextEditorDiagnostic {
  id: string
  commandHead: string
  message: string
  severity: 'warning' | 'error'
  start: number
  end: number
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

type IncompleteMmlRowsBySheet = Record<string, Record<number, MmlIncompleteRowState>>
type WorkspaceTextEditorHandle = {
  clearSearch: () => void
  findNextMatch: () => boolean
  findPreviousMatch: () => boolean
  replaceAllMatches: (replaceQuery: string) => boolean
  replaceCurrentMatch: (replaceQuery: string) => boolean
  setSearchQuery: (searchQuery: string) => boolean
  undo: () => void
}

const props = defineProps<{
  openFiles: WorkspaceEditorFileState[]
  activeFileId: string | null
  activeFile: WorkspaceEditorFileState | null
  isRunning?: boolean
}>()

const emit = defineEmits<{
  (event: 'select-file', fileId: string): void
  (event: 'update-content', fileId: string, content: string): void
  (event: 'update-mml-metadata', fileId: string, metadata: WorkspaceMmlMetadata): void
  (event: 'save-file', fileId?: string): void
  (event: 'blur-file', fileId: string): void
  (event: 'close-file', fileId: string): void
  (event: 'copy-file-name', fileId: string): void
  (event: 'request-rename-file', fileId: string): void
  (event: 'download-file', fileId: string): void
  (event: 'delete-file', fileId: string): void
}>()

const viewMode = ref<'text' | 'table' | 'preview'>('text')
const isMmlConfigOpen = ref(false)
const mmlOptions = ref<MmlTypeVersionOptions>({
  networkTypes: [],
  networkVersionsByType: {}
})
const mmlSchemaState = ref<MmlSchemaAvailability>('idle')
const mmlSchema = ref<MmlSchemaResponse | null>(null)
const MML_SUMMARY_SHEET_KEY = '__summary__'
const activeMmlSheetKey = ref('')
const activeMmlSelection = ref<MmlSelectionRange | null>(null)
const mmlGridFeedback = ref('')
const incompleteMmlRows = ref<Record<string, IncompleteMmlRowsBySheet>>({})
const saveBlockMessage = ref('')
const textEditorRef = ref<WorkspaceTextEditorHandle | null>(null)
const isTextSearchOpen = ref(false)
const isTextReplaceOpen = ref(false)
const isTextMoreMenuOpen = ref(false)
const textSearchQuery = ref('')
const textReplaceQuery = ref('')
const compositeEditorState = ref<{
  rowId: string
  rowNumber: number
  columnKey: string
  columnLabel: string
  options: string[]
  enabled: string[]
} | null>(null)
const textDiagnostics = ref<WorkspaceTextEditorDiagnostic[]>([])
const textDiagnosticsExpanded = ref(false)
const activeTextDiagnosticId = ref<string | null>(null)
const mmlSummarySearchQuery = ref('')
let mmlOptionsRequestId = 0
let mmlSchemaRequestId = 0

function getIncompleteRowsForSheet(fileId: string, sheetKey: string): Record<number, MmlIncompleteRowState> {
  return incompleteMmlRows.value[fileId]?.[sheetKey] || {}
}

function hasIncompleteRowsForFile(fileId: string): boolean {
  return Object.values(incompleteMmlRows.value[fileId] || {}).some(rows => Object.keys(rows).length > 0)
}

function splitFileName(fileName: string): { base: string; ext: string } {
  const dotIdx = fileName.lastIndexOf('.')
  if (dotIdx <= 0) return { base: fileName, ext: '' }
  return { base: fileName.slice(0, dotIdx), ext: fileName.slice(dotIdx) }
}

const tabTooltip = ref({ visible: false, text: '', x: 0, y: 0 })

function showTabTooltip(fileName: string, event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tabTooltip.value = {
    visible: true,
    text: fileName,
    x: rect.left + rect.width / 2,
    y: rect.bottom + 6,
  }
}

function hideTabTooltip(): void {
  tabTooltip.value.visible = false
}

function setIncompleteRowsForSheet(fileId: string, sheetKey: string, rows: MmlIncompleteRowState[]): void {
  const nextFileRows: IncompleteMmlRowsBySheet = { ...(incompleteMmlRows.value[fileId] || {}) }
  if (!rows.length) {
    delete nextFileRows[sheetKey]
  } else {
    nextFileRows[sheetKey] = Object.fromEntries(rows.map(row => [row.rowNumber, row]))
  }

  if (Object.keys(nextFileRows).length === 0) {
    const nextState = { ...incompleteMmlRows.value }
    delete nextState[fileId]
    incompleteMmlRows.value = nextState
  } else {
    incompleteMmlRows.value = {
      ...incompleteMmlRows.value,
      [fileId]: nextFileRows
    }
  }
}

function clearSaveBlockMessage(): void {
  saveBlockMessage.value = ''
}

function resolveDefaultViewMode(file: WorkspaceEditorFileState | null): 'text' | 'table' | 'preview' {
  if (file?.mode === 'markdown') return 'preview'
  return 'text'
}

watch(
  () => props.activeFile?.fileId || '',
  () => {
    viewMode.value = resolveDefaultViewMode(props.activeFile)
  },
  { immediate: true }
)

watch(
  () => props.activeFile?.fileId || '',
  () => {
    isMmlConfigOpen.value = false
    resetTextEditorActionState()
    textDiagnostics.value = []
    textDiagnosticsExpanded.value = false
    activeTextDiagnosticId.value = null
    clearSaveBlockMessage()
  }
)

watch(
  () => viewMode.value,
  mode => {
    if (mode === 'text') return
    resetTextEditorActionState()
  }
)

watch(
  () => props.openFiles.map(file => file.fileId).join('|'),
  () => {
    const openFileIds = new Set(props.openFiles.map(file => file.fileId))
    incompleteMmlRows.value = Object.fromEntries(
      Object.entries(incompleteMmlRows.value).filter(([fileId]) => openFileIds.has(fileId))
    )
  },
  { immediate: true }
)

watch(
  () => props.activeFile?.fileId || '',
  async () => {
    const file = props.activeFile
    mmlOptionsRequestId += 1
    const requestId = mmlOptionsRequestId

    if (!file || (file.mode !== 'text' && file.mode !== 'mml')) {
      mmlOptions.value = {
        networkTypes: [],
        networkVersionsByType: {}
      }
      return
    }

    try {
      const nextOptions = await mmlSchemaApi.getOptions()
      if (requestId !== mmlOptionsRequestId) return
      mmlOptions.value = nextOptions
    } catch {
      if (requestId !== mmlOptionsRequestId) return
      mmlOptions.value = {
        networkTypes: [],
        networkVersionsByType: {}
      }
    }
  },
  { immediate: true }
)

watch(
  [
    () => props.activeFile?.fileId || '',
    () => props.activeFile?.mode || '',
    () => props.activeFile?.mmlMetadata?.networkType || '',
    () => props.activeFile?.mmlMetadata?.networkVersion || ''
  ],
  async () => {
    const file = props.activeFile
    activeMmlSelection.value = null
    activeMmlSheetKey.value = MML_SUMMARY_SHEET_KEY
    mmlGridFeedback.value = ''
    compositeEditorState.value = null
    mmlSchemaRequestId += 1
    const requestId = mmlSchemaRequestId

    if (!file || file.mode !== 'mml') {
      mmlSchemaState.value = 'idle'
      mmlSchema.value = null
      return
    }

    const networkType = file.mmlMetadata?.networkType?.trim() || ''
    const networkVersion = file.mmlMetadata?.networkVersion?.trim() || ''
    if (!networkType || !networkVersion) {
      mmlSchemaState.value = 'unavailable'
      mmlSchema.value = null
      return
    }

    mmlSchemaState.value = 'loading'
    mmlSchema.value = null

    try {
      const schema = await mmlSchemaApi.getSchema(networkType, networkVersion)
      if (requestId !== mmlSchemaRequestId) return
      mmlSchema.value = schema
      mmlSchemaState.value = schema ? 'ready' : 'unavailable'
    } catch {
      if (requestId !== mmlSchemaRequestId) return
      mmlSchema.value = null
      mmlSchemaState.value = 'error'
    }
  },
  { immediate: true }
)

const currentMmlNetworkType = computed(() => props.activeFile?.mmlMetadata?.networkType || '')
const currentMmlNetworkVersion = computed(() => props.activeFile?.mmlMetadata?.networkVersion || '')
const currentMmlNetworkTypeOptions = computed(() => mmlOptions.value.networkTypes)
const currentMmlNetworkVersionOptions = computed(() => {
  const networkType = currentMmlNetworkType.value.trim()
  if (!networkType) return []
  return mmlOptions.value.networkVersionsByType[networkType] || []
})
const showsMmlParsingEntry = computed(() => props.activeFile?.mode === 'text' || props.activeFile?.mode === 'mml')
const isMarkdownFile = computed(() => props.activeFile?.mode === 'markdown')
const primaryViewLabel = computed(() => isMarkdownFile.value ? '编辑' : '文本视图')
const secondaryViewLabel = computed(() => isMarkdownFile.value ? '预览' : '表格视图')
const secondaryViewMode = computed(() => isMarkdownFile.value ? 'preview' : 'table')
const hasCompleteMmlConfig = computed(() => {
  return Boolean(currentMmlNetworkType.value.trim() && currentMmlNetworkVersion.value.trim())
})
const supportsSecondaryView = computed(() => {
  return props.activeFile?.mode === 'markdown'
    || props.activeFile?.mode === 'csv'
    || props.activeFile?.mode === 'text'
    || props.activeFile?.mode === 'mml'
})
const canEnterTableView = computed(() => {
  if (props.activeFile?.mode === 'csv') return true
  return props.activeFile?.mode === 'mml' && hasCompleteMmlConfig.value && mmlSchemaState.value === 'ready'
})
const canEnterSecondaryView = computed(() => {
  if (props.activeFile?.mode === 'markdown') return true
  return canEnterTableView.value
})
const currentFileHasIncompleteRows = computed(() => {
  if (!props.activeFile) return false
  return hasIncompleteRowsForFile(props.activeFile.fileId)
})
const tableViewHint = computed(() => {
  if (!props.activeFile) return '请先选择一个文件。'
  if (props.activeFile.mode === 'text') {
    return '当前文件尚未启用 MML 解析，请在上方完成配置后继续使用表格视图。'
  }
  if (props.activeFile.mode === 'markdown') {
    return 'Markdown 文件请切换到预览视图查看渲染结果。'
  }
  if (props.activeFile.mode === 'mml') {
    return mmlConfigStatusLabel.value
  }
  return '当前文件类型暂不支持表格视图。'
})
const previewViewHint = computed(() => {
  if (props.activeFile?.mode === 'text' || props.activeFile?.mode === 'mml' || props.activeFile?.mode === 'csv') {
    return '可切换到文本视图或表格视图继续处理。'
  }
  return '请切换到支持的视图继续处理当前文件。'
})
const shouldMountTextEditor = computed(() => {
  const file = props.activeFile
  if (!file) return false
  if (file.mode === 'mml') return viewMode.value === 'text'
  return file.mode === 'text' || file.mode === 'markdown'
})
const supportsTextEditorActions = computed(() => {
  if (viewMode.value !== 'text') return false
  const file = props.activeFile
  if (!file) return false
  return file.mode === 'text' || file.mode === 'markdown' || file.mode === 'mml'
})
const canUseTextReplaceActions = computed(() => {
  return supportsTextEditorActions.value
    && props.activeFile?.writable !== false
    && textSearchQuery.value.length > 0
})
const selectedFileRenameDisabledReason = computed(() => {
  const file = props.activeFile
  if (!file) return undefined
  if (props.isRunning) {
    return '当前会话正在运行，暂不支持重命名。'
  }
  if (file.isDirty) {
    return `文件“${file.fileName}”有未保存修改，请先保存。`
  }
  return undefined
})
const selectedFileDeleteDisabledReason = computed(() => {
  const file = props.activeFile
  if (!file) return undefined
  if (props.isRunning) {
    return '当前会话正在运行，暂不支持删除工作区文件。'
  }
  if (file.isDirty) {
    return `文件“${file.fileName}”有未保存修改，请先保存后再删除。`
  }
  return undefined
})
const selectedFileRenameDisabled = computed(() => selectedFileRenameDisabledReason.value !== undefined)
const selectedFileDeleteDisabled = computed(() => selectedFileDeleteDisabledReason.value !== undefined)
const shouldShowStatusFileName = computed(() => {
  const mode = props.activeFile?.mode
  return mode !== 'text' && mode !== 'markdown'
})
const activeTextEditorFileMode = computed<'text' | 'markdown' | 'mml'>(() => {
  const file = props.activeFile
  if (!file || file.mode === 'csv') return 'text'
  return file.mode
})
const showsMmlConfigArea = computed(() => showsMmlParsingEntry.value && isMmlConfigOpen.value)
const mmlParsingSummaryLabel = computed(() => {
  if (!showsMmlParsingEntry.value) return ''
  if (props.activeFile?.mode === 'text') {
    return '按 MML 解析：未启用'
  }
  if (!hasCompleteMmlConfig.value) {
    return '按 MML 解析：待配置'
  }
  const base = `按 MML 解析：${currentMmlNetworkType.value.trim()} · ${currentMmlNetworkVersion.value.trim()}`
  if (mmlSchemaState.value === 'error' || mmlSchemaState.value === 'unavailable') {
    return `${base} · 暂不可用`
  }
  return base
})

const saveStateLabel = computed(() => {
  if (!props.activeFile) return ''
  if (saveBlockMessage.value) return saveBlockMessage.value
  if (currentFileHasIncompleteRows.value) return '存在未完成表格行'
  if (!props.activeFile.writable) return '只读文件'
  if (props.activeFile.saveStatus === 'saving') return '保存中...'
  if (props.activeFile.saveStatus === 'error') return props.activeFile.saveError || '保存失败'
  if (props.activeFile.isDirty) return '未保存修改'
  if (props.activeFile.saveStatus === 'saved') return '已保存'
  return ''
})

const saveTone = computed(() => {
  if (!props.activeFile) return 'idle'
  if (saveBlockMessage.value || currentFileHasIncompleteRows.value) return 'error'
  if (props.activeFile.saveStatus === 'error') return 'error'
  if (props.activeFile.isDirty) return 'dirty'
  if (props.activeFile.saveStatus === 'saved') return 'saved'
  return 'idle'
})

const parsedTable = computed(() => {
  if (props.activeFile?.mode !== 'csv') return []
  return parseCsv(props.activeFile.content)
})

const tableColumns = computed(() => parsedTable.value[0] || [])
const tableRows = computed(() => parsedTable.value.slice(1))
const mmlWorkbook = computed(() => {
  if (props.activeFile?.mode !== 'mml') return null
  return buildMmlWorkbook(props.activeFile.content, mmlSchema.value, mmlSchemaState.value)
})
const filteredMmlSheets = computed(() => {
  const sheets = mmlWorkbook.value?.sheets || []
  const query = mmlSummarySearchQuery.value.trim()
  if (!query) return sheets
  const upperQuery = query.toUpperCase()
  return sheets.filter(sheet => sheet.commandHead.toUpperCase().includes(upperQuery))
})
const isMmlSummarySheetActive = computed(() => activeMmlSheetKey.value === MML_SUMMARY_SHEET_KEY)
const activeMmlSheet = computed(() => {
  if (!mmlWorkbook.value || isMmlSummarySheetActive.value) return null
  return mmlWorkbook.value.sheets.find(sheet => sheet.key === activeMmlSheetKey.value) || null
})
const activeMmlIncompleteRows = computed<Record<number, MmlIncompleteRowState>>(() => {
  if (!props.activeFile || !activeMmlSheet.value) return {}
  return getIncompleteRowsForSheet(props.activeFile.fileId, activeMmlSheet.value.key)
})
const activeMmlGridSheet = computed(() => {
  if (!activeMmlSheet.value) return null
  return buildMmlGridSheet(activeMmlSheet.value)
})
const mmlWorkbookSummary = computed(() => {
  if (!mmlWorkbook.value) return '等待 MML 文件加载'
  const sheetCount = mmlWorkbook.value.sheets.length
  const rowCount = mmlWorkbook.value.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)
  return `${sheetCount} 个命令页，${rowCount} 条语句`
})
const mmlConfigDescription = computed(() => {
  if (props.activeFile?.mode === 'text') {
    return '将当前文本按 MML 方式处理。完成配置后可使用表格视图。'
  }
  return '当前文本已按 MML 方式处理，可在这里调整网元类型和网元版本。'
})
const mmlConfigStatusLabel = computed(() => {
  if (props.activeFile?.mode === 'text') return '完成配置后可使用表格视图'
  if (!hasCompleteMmlConfig.value) return '缺少网元类型或网元版本'
  switch (mmlSchemaState.value) {
    case 'loading':
      return '正在准备表格视图'
    case 'ready':
      return '当前配置可用于表格视图'
    case 'error':
    case 'unavailable':
      return '当前版本暂不支持表格解析'
    default:
      return '完成配置后可使用表格视图'
  }
})
const mmlTableStatusMessage = computed(() => {
  if (isMmlSummarySheetActive.value) {
    if (!mmlWorkbook.value?.sheets.length) return '当前没有可投影的命令页，可切换到文本视图继续处理'
    return '从汇总中选择命令页进入表格视图'
  }
  const sheet = activeMmlSheet.value
  const gridSheet = activeMmlGridSheet.value
  if (!sheet) return mmlConfigStatusLabel.value
  if (mmlGridFeedback.value) {
    return mmlGridFeedback.value
  }
  if (compositeEditorState.value) {
    return `R${compositeEditorState.value.rowNumber} ${compositeEditorState.value.columnLabel} · 使用模板化位域编辑`
  }
  if (!activeMmlSelection.value) {
    if (mmlSchemaState.value === 'ready') return '选择单元格即可编辑安全语句'
    return '当前为只读投影，可切换到文本视图继续处理'
  }

  const { x1, y1, x2, y2 } = activeMmlSelection.value
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const right = Math.max(x1, x2)
  const bottom = Math.max(y1, y2)
  const row = gridSheet?.rows[top]
  const column = sheet.columns[left]
  if (!row || !column) return mmlConfigStatusLabel.value
  if (left === right && top === bottom) {
    if (row.kind === 'spare') {
      const incompleteRow = activeMmlIncompleteRows.value[row.rowNumber]
      if (incompleteRow) {
        return formatIncompleteRowMessage(row.rowNumber, incompleteRow, sheet.columns)
      }
      return `R${row.rowNumber} · 空白行，可继续填写新语句`
    }
    if (row.readOnly) {
      return `R${row.rowNumber} ${column.label} · ${row.readOnlyReasons.join(' · ')}`
    }
    if (!column.known || !column.editable) {
      return `R${row.rowNumber} ${column.label} · 当前单元格不支持表格编辑`
    }
    return `R${row.rowNumber} ${column.label} · 可编辑`
  }

  const cellCount = (right - left + 1) * (bottom - top + 1)
  return `R${top + 1}C${left + 1}:R${bottom + 1}C${right + 1} · 已选择 ${cellCount} 格`
})
const compositeEditorEnabledSet = computed(() => new Set(compositeEditorState.value?.enabled || []))
const activeTextDiagnostics = computed(() => props.activeFile?.mode === 'mml' ? textDiagnostics.value : [])
const textDiagnosticSummaryLabel = computed(() => {
  const diagnostics = activeTextDiagnostics.value
  if (!diagnostics.length) return ''
  const errorCount = diagnostics.filter(item => item.severity === 'error').length
  const warningCount = diagnostics.filter(item => item.severity === 'warning').length
  const parts = [`${diagnostics.length} 条诊断`]
  if (errorCount) parts.push(`${errorCount} error`)
  if (warningCount) parts.push(`${warningCount} warning`)
  return parts.join(' · ')
})

watch(
  () => mmlWorkbook.value?.sheets.map(sheet => sheet.key).join('|') || '',
  () => {
    const sheets = mmlWorkbook.value?.sheets || []
    if (!sheets.length) {
      activeMmlSheetKey.value = MML_SUMMARY_SHEET_KEY
      return
    }
    if (activeMmlSheetKey.value !== MML_SUMMARY_SHEET_KEY && !sheets.some(sheet => sheet.key === activeMmlSheetKey.value)) {
      activeMmlSheetKey.value = MML_SUMMARY_SHEET_KEY
    }
  },
  { immediate: true }
)

watch(
  () => currentFileHasIncompleteRows.value,
  hasIncompleteRows => {
    if (!hasIncompleteRows) {
      clearSaveBlockMessage()
    }
  }
)

function handleMetadataSelect(field: keyof WorkspaceMmlMetadata, event: Event): void {
  if (!props.activeFile) return
  const nextValue = (event.target as HTMLSelectElement).value
  const nextNetworkType = field === 'networkType'
    ? nextValue
    : (props.activeFile.mmlMetadata?.networkType || '')
  emit('update-mml-metadata', props.activeFile.fileId, {
    networkType: nextNetworkType,
    networkVersion: field === 'networkVersion'
      ? nextValue
      : ''
  })
}

function toggleMmlConfig(): void {
  if (!showsMmlParsingEntry.value) return
  isMmlConfigOpen.value = !isMmlConfigOpen.value
}

function resetTextEditorActionState(): void {
  isTextSearchOpen.value = false
  isTextReplaceOpen.value = false
  isTextMoreMenuOpen.value = false
  textSearchQuery.value = ''
  textReplaceQuery.value = ''
  textEditorRef.value?.clearSearch()
}

function openTextSearch(): void {
  if (!supportsTextEditorActions.value) return
  isTextSearchOpen.value = true
  isTextMoreMenuOpen.value = false
  if (textSearchQuery.value) {
    textEditorRef.value?.setSearchQuery(textSearchQuery.value)
  }
}

function closeTextSearch(): void {
  isTextSearchOpen.value = false
  isTextReplaceOpen.value = false
  textSearchQuery.value = ''
  textReplaceQuery.value = ''
  textEditorRef.value?.clearSearch()
}

function handleTextSearchQueryInput(value: string): void {
  textSearchQuery.value = value
  if (!value) {
    textEditorRef.value?.clearSearch()
    return
  }
  textEditorRef.value?.setSearchQuery(value)
}

function toggleTextReplace(): void {
  if (!canUseTextReplaceActions.value) return
  isTextReplaceOpen.value = !isTextReplaceOpen.value
}

function handleTextSearchPrevious(): void {
  textEditorRef.value?.findPreviousMatch()
}

function handleTextSearchNext(): void {
  textEditorRef.value?.findNextMatch()
}

function handleTextReplaceCurrent(): void {
  if (!canUseTextReplaceActions.value) return
  textEditorRef.value?.replaceCurrentMatch(textReplaceQuery.value)
}

function handleTextReplaceAll(): void {
  if (!canUseTextReplaceActions.value) return
  textEditorRef.value?.replaceAllMatches(textReplaceQuery.value)
}

function toggleTextMoreMenu(): void {
  if (!supportsTextEditorActions.value) return
  isTextMoreMenuOpen.value = !isTextMoreMenuOpen.value
}

function handleTextUndo(): void {
  if (props.activeFile?.writable === false) return
  textEditorRef.value?.undo()
  isTextMoreMenuOpen.value = false
}

function setPrimaryView(): void {
  viewMode.value = 'text'
}

function setSecondaryView(): void {
  if (!props.activeFile) return
  if (props.activeFile.mode === 'markdown') {
    viewMode.value = 'preview'
    return
  }
  if (props.activeFile.mode === 'csv') {
    viewMode.value = 'table'
    return
  }
  if (canEnterSecondaryView.value) {
    viewMode.value = 'table'
    return
  }
  if (showsMmlParsingEntry.value) {
    isMmlConfigOpen.value = true
  }
  viewMode.value = 'table'
}

function handleContentInput(event: Event): void {
  if (!props.activeFile) return
  emit('update-content', props.activeFile.fileId, (event.target as HTMLTextAreaElement).value)
}

function handleTextEditorUpdate(content: string): void {
  if (!props.activeFile) return
  emit('update-content', props.activeFile.fileId, content)
}

function handleTextDiagnosticsChange(nextDiagnostics: WorkspaceTextEditorDiagnostic[]): void {
  if (props.activeFile?.mode === 'mml' && viewMode.value !== 'text') {
    return
  }
  textDiagnostics.value = nextDiagnostics
  if (!nextDiagnostics.length) {
    textDiagnosticsExpanded.value = false
    activeTextDiagnosticId.value = null
    return
  }
  if (activeTextDiagnosticId.value && !nextDiagnostics.some(item => item.id === activeTextDiagnosticId.value)) {
    activeTextDiagnosticId.value = null
  }
}

function toggleTextDiagnosticsPanel(): void {
  if (!activeTextDiagnostics.value.length) return
  textDiagnosticsExpanded.value = !textDiagnosticsExpanded.value
}

function selectTextDiagnostic(diagnosticId: string): void {
  activeTextDiagnosticId.value = diagnosticId
}

function formatIncompleteRowMessage(
  rowNumber: number,
  rowState: MmlIncompleteRowState,
  columns: Array<{ key: string; label: string }>
): string {
  const firstInvalid = Object.entries(rowState.invalidCells)[0]
  if (firstInvalid) {
    const column = columns.find(item => item.key === firstInvalid[0])
    return `R${rowNumber} ${column?.label || firstInvalid[0]} · ${firstInvalid[1]}`
  }
  const firstMissingRequired = rowState.missingRequired[0]
  if (firstMissingRequired) {
    const column = columns.find(item => item.key === firstMissingRequired)
    return `R${rowNumber} · 缺少必选参数: ${column?.label || firstMissingRequired}`
  }
  const firstMissingConditional = rowState.missingConditionalRequired[0]
  if (firstMissingConditional) {
    const column = columns.find(item => item.key === firstMissingConditional)
    return `R${rowNumber} · 缺少条件必选参数: ${column?.label || firstMissingConditional}`
  }
  return `R${rowNumber} · 空白行，可继续填写新语句`
}

function applyIncompleteRowUpdates(
  rowUpdates: Array<{ rowNumber: number; values: Record<string, string> }>
): { insertedRowCount: number; blockedReason: string | null } {
  if (!props.activeFile || props.activeFile.mode !== 'mml' || !mmlWorkbook.value || !activeMmlSheet.value) {
    return { insertedRowCount: 0, blockedReason: '当前命令页不存在，无法更新空白行。' }
  }

  const fileId = props.activeFile.fileId
  const sheetKey = activeMmlSheet.value.key
  const existingRows = Object.values(getIncompleteRowsForSheet(fileId, sheetKey)).sort((left, right) => left.rowNumber - right.rowNumber)
  const nextRowMap = new Map<number, MmlIncompleteRowState>(existingRows.map(row => [row.rowNumber, row]))
  const statementsToAppend: Array<{ rowNumber: number; statementText: string }> = []

  for (const update of rowUpdates.sort((left, right) => left.rowNumber - right.rowNumber)) {
    const nextValues = { ...(nextRowMap.get(update.rowNumber)?.values || {}) }
    for (const [columnKey, nextValue] of Object.entries(update.values)) {
      if (nextValue) {
        nextValues[columnKey] = nextValue
      } else {
        delete nextValues[columnKey]
      }
    }

    const materialized = materializeMmlDraftRow({
      sheetKey,
      values: nextValues,
      rowNumber: update.rowNumber,
      schema: mmlSchema.value
    })
    if (materialized.blockedReason) {
      return {
        insertedRowCount: 0,
        blockedReason: materialized.blockedReason
      }
    }
    if (materialized.statementText) {
      nextRowMap.delete(update.rowNumber)
      statementsToAppend.push({
        rowNumber: update.rowNumber,
        statementText: materialized.statementText
      })
      continue
    }
    if (!Object.keys(materialized.values).length) {
      nextRowMap.delete(update.rowNumber)
      continue
    }
    nextRowMap.set(update.rowNumber, {
      rowNumber: update.rowNumber,
      values: materialized.values,
      invalidCells: materialized.invalidCells,
      missingRequired: materialized.missingRequired,
      missingConditionalRequired: materialized.missingConditionalRequired
    })
  }

  let nextContent = props.activeFile.content
  if (statementsToAppend.length > 0) {
    const appended = appendMmlStatementsToSheet({
      content: nextContent,
      workbook: mmlWorkbook.value,
      sheetKey,
      statements: statementsToAppend.map(item => item.statementText)
    })
    if (appended.blockedReason) {
      return {
        insertedRowCount: 0,
        blockedReason: appended.blockedReason
      }
    }
    nextContent = appended.content
  }

  const shiftedRows = [...nextRowMap.values()]
    .map(row => ({
      ...row,
      rowNumber: row.rowNumber + statementsToAppend.length
    }))
    .sort((left, right) => left.rowNumber - right.rowNumber)
  setIncompleteRowsForSheet(fileId, sheetKey, shiftedRows)
  clearSaveBlockMessage()

  if (nextContent !== props.activeFile.content) {
    emit('update-content', fileId, nextContent)
  }

  return {
    insertedRowCount: statementsToAppend.length,
    blockedReason: null
  }
}

function selectMmlSheet(sheetKey: string): void {
  activeMmlSheetKey.value = sheetKey
  activeMmlSelection.value = null
  mmlGridFeedback.value = ''
  compositeEditorState.value = null
}

function handleSave(): void {
  if (!props.activeFile) return
  if (hasIncompleteRowsForFile(props.activeFile.fileId)) {
    saveBlockMessage.value = '存在未完成表格行，补齐或清除后再保存'
    return
  }
  clearSaveBlockMessage()
  emit('save-file', props.activeFile.fileId)
}

function handleEditorBlur(): void {
  if (!props.activeFile) return
  emit('blur-file', props.activeFile.fileId)
}

function handleMmlCellChange(rowId: string, columnKey: string, nextValue: string): void {
  if (!props.activeFile || props.activeFile.mode !== 'mml' || !mmlWorkbook.value || !activeMmlSheet.value) return
  mmlGridFeedback.value = ''
  clearSaveBlockMessage()
  const nextContent = applyMmlCellEdit({
    content: props.activeFile.content,
    workbook: mmlWorkbook.value,
    sheetKey: activeMmlSheet.value.key,
    rowId,
    columnKey,
    nextValue,
    schema: mmlSchema.value
  })
  if (nextContent !== props.activeFile.content) {
    emit('update-content', props.activeFile.fileId, nextContent)
  }
}

function handleMmlSpareCellChange(payload: { rowNumber: number; columnKey: string; nextValue: string }): void {
  if (!props.activeFile || !activeMmlSheet.value) return
  mmlGridFeedback.value = ''
  const result = applyIncompleteRowUpdates([
    {
      rowNumber: payload.rowNumber,
      values: {
        [payload.columnKey]: payload.nextValue
      }
    }
  ])
  if (result.blockedReason) {
    mmlGridFeedback.value = result.blockedReason
    return
  }
  if (result.insertedRowCount > 0) {
    mmlGridFeedback.value = `已新增 ${result.insertedRowCount} 行`
    return
  }
  const nextRowState = activeMmlSheet.value
    ? getIncompleteRowsForSheet(props.activeFile.fileId, activeMmlSheet.value.key)[payload.rowNumber]
    : null
  if (nextRowState) {
    mmlGridFeedback.value = formatIncompleteRowMessage(payload.rowNumber, nextRowState, activeMmlSheet.value.columns)
  } else {
    mmlGridFeedback.value = '已清除空白行输入'
  }
}

function handleMmlRangePaste(payload: { startColumnIndex: number; startRowIndex: number; values: string[][]; targetRange: MmlPasteTargetRange | null }): void {
  if (!props.activeFile || props.activeFile.mode !== 'mml' || !mmlWorkbook.value || !activeMmlSheet.value || !activeMmlGridSheet.value) return
  clearSaveBlockMessage()
  const normalized = normalizePasteMatrix(payload.values, payload.targetRange)
  if (normalized.blockedReason) {
    mmlGridFeedback.value = normalized.blockedReason
    return
  }
  const result = applyMmlRangePaste({
    content: props.activeFile.content,
    workbook: mmlWorkbook.value,
    gridSheet: activeMmlGridSheet.value,
    sheetKey: activeMmlSheet.value.key,
    startColumnIndex: payload.startColumnIndex,
    startRowIndex: payload.startRowIndex,
    values: normalized.values,
    schema: mmlSchema.value,
    existingIncompleteRows: Object.values(getIncompleteRowsForSheet(props.activeFile.fileId, activeMmlSheet.value.key))
  })

  if (result.blockedReason) {
    mmlGridFeedback.value = result.blockedReason
    return
  }

  setIncompleteRowsForSheet(props.activeFile.fileId, activeMmlSheet.value.key, result.incompleteRows)
  mmlGridFeedback.value = formatMmlPasteResultMessage(result)
  if (result.content !== props.activeFile.content) {
    emit('update-content', props.activeFile.fileId, result.content)
  }
}

function handleMmlSelectionChange(value: MmlSelectionRange | null): void {
  activeMmlSelection.value = value
  mmlGridFeedback.value = ''
}

function handleMmlGridBlockedEdit(message: string): void {
  mmlGridFeedback.value = message
}

function handleCompositeEditRequest(payload: { rowId: string; columnKey: string }): void {
  const sheet = activeMmlSheet.value
  if (!sheet) return
  const row = sheet.rows.find(item => item.id === payload.rowId)
  const column = sheet.columns.find(item => item.key === payload.columnKey)
  if (!row || !column || column.controlType !== 'composite') {
    return
  }

  compositeEditorState.value = {
    rowId: row.id,
    rowNumber: row.rowNumber,
    columnKey: column.key,
    columnLabel: column.label,
    options: column.compositeFlagSetOptions,
    enabled: parseCompositeFlagSetValue(column.compositeFlagSetOptions, row.values[column.key] || '').enabledOptions
  }
  mmlGridFeedback.value = ''
}

function closeCompositeEditor(): void {
  compositeEditorState.value = null
}

function toggleCompositeOption(option: string): void {
  if (!compositeEditorState.value) return
  const enabled = new Set(compositeEditorState.value.enabled)
  if (enabled.has(option)) {
    enabled.delete(option)
  } else {
    enabled.add(option)
  }
  compositeEditorState.value = {
    ...compositeEditorState.value,
    enabled: compositeEditorState.value.options.filter(item => enabled.has(item))
  }
}

function enableAllCompositeOptions(): void {
  if (!compositeEditorState.value) return
  compositeEditorState.value = {
    ...compositeEditorState.value,
    enabled: [...compositeEditorState.value.options]
  }
}

function disableAllCompositeOptions(): void {
  if (!compositeEditorState.value) return
  compositeEditorState.value = {
    ...compositeEditorState.value,
    enabled: []
  }
}

function applyCompositeEditor(): void {
  if (!compositeEditorState.value) return
  handleMmlCellChange(
    compositeEditorState.value.rowId,
    compositeEditorState.value.columnKey,
    serializeCompositeFlagSetValue(compositeEditorState.value.options, compositeEditorState.value.enabled)
  )
  compositeEditorState.value = null
}

function formatMmlPasteResultMessage(result: { updatedRowCount: number; insertedRowCount: number; incompleteRows?: MmlIncompleteRowState[] }): string {
  if (result.updatedRowCount > 0 && result.insertedRowCount > 0) {
    return `已更新 ${result.updatedRowCount} 行，新增 ${result.insertedRowCount} 行`
  }
  if (result.insertedRowCount > 0) {
    return `已新增 ${result.insertedRowCount} 行`
  }
  if (result.updatedRowCount > 0) {
    return `已更新 ${result.updatedRowCount} 行`
  }
  if ((result.incompleteRows?.length || 0) > 0) {
    return '已更新空白行，待补齐必填参数'
  }
  return '粘贴未产生变更'
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}
</script>

<style scoped>
.workspace-editor {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-panel);
}

.workspace-editor__contextbar {
  border-bottom: 1px solid var(--line-subtle);
  background: var(--surface-panel);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 12px 10px;
}

.workspace-editor__tab-row,
.workspace-editor__toolbar,
.workspace-editor__toolbar-main,
.workspace-editor__toolbar-group,
.workspace-editor__toolbar-actions,
.workspace-editor__statusbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workspace-editor__tab-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.workspace-editor__tab-strip {
  min-width: 0;
  flex: 1;
  height: 36px;
  display: flex;
  align-items: stretch;
  overflow-x: auto;
}

.workspace-editor__tab-actions {
  flex: 0 0 auto;
  justify-self: end;
}

.workspace-editor__tab {
  position: relative;
  min-width: 0;
  max-width: 240px;
  height: 100%;
  padding: 0 12px 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  border: 0;
  border-left: 1px solid var(--line-subtle);
  background: transparent;
  color: var(--text-secondary);
}

.workspace-editor__tab:first-child {
  border-left: none;
}

.workspace-editor__tab {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.workspace-editor__tab--active {
  background: var(--surface-subtle);
  color: var(--text-primary);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.workspace-editor__tab-title {
  min-width: 0;
  display: flex;
  align-items: baseline;
  overflow: hidden;
}

.workspace-editor__tab-title__base {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 2ch;
}

.workspace-editor__tab-title__ext {
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-tooltip-enter-active,
.tab-tooltip-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.tab-tooltip-enter-from,
.tab-tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.workspace-editor__tab-tooltip {
  position: fixed;
  transform: translateX(-50%);
  z-index: 9999;
  max-inline-size: min(36ch, calc(100vw - 96px));
  padding: 6px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-md);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  white-space: normal;
  word-break: break-all;
  pointer-events: none;
}

.workspace-editor__dirty-dot {
  color: var(--accent);
  font-size: var(--font-overline);
  line-height: var(--line-overline);
}

.workspace-editor__tab-close {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.workspace-editor__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.workspace-editor__toolbar-main {
  min-width: 0;
}

.workspace-editor__toolbar-switch {
  flex-shrink: 0;
}

.workspace-editor__action-btn {
  padding: 6px 12px;
}

.workspace-editor__toolbar-group--views {
  min-width: 0;
}

.workspace-editor__mml-entry,
.workspace-editor__save-state {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--text-primary);
  font-size: var(--font-meta);
  font-weight: 600;
  line-height: var(--line-meta);
}

.workspace-editor__mml-entry {
  border: 1px solid var(--line-subtle);
  min-width: 0;
  max-width: min(100%, 26rem);
  text-align: left;
}

.workspace-editor__mml-entry--open {
  border-color: var(--accent-light);
  background: var(--accent-lighter);
  color: var(--accent);
}

.workspace-editor__save-state--dirty {
  color: #8a5200;
  background: #fff4df;
}

.workspace-editor__save-state--saved {
  color: #0a6a3f;
  background: #e9f7ef;
}

.workspace-editor__save-state--error {
  color: #a32222;
  background: #fdecec;
}

.workspace-editor__action-btn {
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  color: var(--text-secondary);
  border-color: var(--line-subtle);
  background: var(--surface-subtle);
}

.workspace-editor__toolbar-actions {
  min-width: 0;
  justify-content: flex-end;
  gap: 8px;
}

.workspace-editor__more-menu {
  position: relative;
}

.workspace-editor__more-menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 5;
  min-width: 132px;
  padding: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

.workspace-editor__more-menu-item {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}

.workspace-editor__mml-config {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(247, 250, 253, 0.96), rgba(255, 255, 255, 0.96));
}

.workspace-editor__mml-config-copy strong,
.workspace-editor__mml-config-copy p {
  margin: 0;
}

.workspace-editor__mml-config-copy p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.workspace-editor__mml-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.workspace-editor__mml-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.workspace-editor__mml-field-label {
  font-size: var(--font-meta);
  color: var(--text-secondary);
  font-weight: 600;
  line-height: var(--line-meta);
}

.workspace-editor__mml-field-input,
.workspace-editor__mml-field-select {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.workspace-editor__mml-config-status {
  display: flex;
  justify-content: flex-start;
}

.workspace-editor__body {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.workspace-editor__text-view,
.workspace-editor__preview-view,
.workspace-editor__table-view {
  min-height: 0;
  flex: 1;
}

.workspace-editor__text-view {
  display: flex;
  flex-direction: column;
  background: #fff;
}

.workspace-editor__text-editor-surface {
  min-height: 0;
  flex: 1;
}

.workspace-editor__preview-view {
  display: flex;
  flex-direction: column;
  overflow: auto;
  background: #fff;
}

.workspace-editor__textarea {
  width: 100%;
  height: 100%;
  border: 0;
  resize: none;
  padding: 18px;
  background: #fff;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: var(--font-editor);
  line-height: var(--line-editor);
}

.workspace-editor__table-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #fbfcfe;
}

.workspace-editor__table-view--mml {
  padding: 4px;
}

.workspace-editor__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--line-subtle);
  background: rgba(255, 255, 255, 0.82);
}

.workspace-editor__summary h3,
.workspace-editor__summary p {
  margin: 0;
}

.workspace-editor__summary h3,
.workspace-editor__mml-summary-hero h3 {
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.workspace-editor__summary p,
.workspace-editor__mml-summary-hero p {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  color: var(--text-secondary);
}

.workspace-editor__summary--mml {
  gap: 16px;
  align-items: flex-start;
}

.workspace-editor__summary-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-editor__summary-pill {
  display: inline-flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: #224b87;
  font-size: var(--font-table-meta);
  font-weight: 600;
  line-height: var(--line-meta);
}

.workspace-editor__mml-workbook {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-editor__mml-shell {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(243, 246, 250, 0.96) 0, rgba(243, 246, 250, 0.96) 26px, rgba(255, 255, 255, 0.98) 26px, rgba(255, 255, 255, 0.98) 100%);
  overflow: hidden;
}

.workspace-editor__mml-tab {
  position: relative;
  z-index: 0;
  border: 1px solid transparent;
  background: linear-gradient(180deg, #f7f9fc, #edf2f7);
  color: var(--text-secondary);
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.workspace-editor__mml-tabs {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 4px 0;
  border-bottom: 1px solid var(--line-subtle);
}

.workspace-editor__mml-tab {
  padding: 3px 8px;
  margin-bottom: -1px;
  border-radius: 6px 6px 0 0;
  white-space: nowrap;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.workspace-editor__mml-tab:hover {
  color: var(--text-primary);
  border-color: rgba(195, 207, 219, 0.9);
  background: linear-gradient(180deg, #ffffff, #f7f9fc);
}

.workspace-editor__mml-tab--active {
  background: #152239;
  color: #fff;
  border-color: #152239;
  z-index: 1;
  box-shadow: none;
}

.workspace-editor__mml-summary-page,
.workspace-editor__mml-grid-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.workspace-editor__mml-sheet-surface {
  background: transparent;
}

.workspace-editor__mml-sheet-surface--summary {
  padding: 10px 12px;
}

.workspace-editor__mml-sheet-surface--grid {
  padding: 0;
}

.workspace-editor__mml-summary-page {
  gap: 12px;
}

.workspace-editor__mml-summary-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));
}

.workspace-editor__mml-summary-hero h3,
.workspace-editor__mml-summary-hero p {
  margin: 0;
}

.workspace-editor__mml-summary-search {
  padding: 8px 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: #fff;
  width: 100%;
  font-size: inherit;
  color: var(--text-primary);
  outline: none;
}

.workspace-editor__mml-summary-search:focus {
  border-color: var(--line-strong);
}

.workspace-editor__mml-summary-search::placeholder {
  color: var(--text-secondary);
}

.workspace-editor__mml-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.workspace-editor__mml-summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--line-subtle);
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: var(--text-primary);
  text-align: left;
  box-shadow: none;
}

.workspace-editor__mml-summary-card:hover {
  border-color: var(--line-strong);
  background: #fff;
}

.workspace-editor__mml-summary-card span {
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
  color: var(--text-secondary);
}

.workspace-editor__table-wrap {
  min-height: 0;
  flex: 1;
  overflow: auto;
  border: 1px solid var(--line-subtle);
  border-radius: 14px;
  background: #fff;
}

.workspace-editor__table-wrap--mml-grid {
  padding: 0;
  border-radius: 2px;
  background: var(--surface-panel);
  box-shadow: none;
}

.workspace-editor__composite-editor {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-editor__composite-editor-header,
.workspace-editor__composite-editor-actions,
.workspace-editor__composite-editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.workspace-editor__composite-editor-header span {
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
  color: var(--text-secondary);
}

.workspace-editor__composite-editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 8px;
}

.workspace-editor__composite-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: #fff;
  font-family: var(--font-family-mono);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.workspace-editor__table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.workspace-editor__table th,
.workspace-editor__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
  text-align: left;
  vertical-align: top;
  white-space: pre-wrap;
}

.workspace-editor__table th {
  background: rgba(246, 248, 251, 0.96);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.workspace-editor__table--mml .workspace-editor__rowhead {
  width: 72px;
  min-width: 72px;
}

.workspace-editor__rowhead {
  position: sticky;
  left: 0;
  z-index: 1;
  background: rgba(246, 248, 251, 0.98);
}

.workspace-editor__rowhead small {
  display: block;
  margin-top: 2px;
  color: #8a5200;
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.workspace-editor__table-row--readonly td,
.workspace-editor__table-row--readonly .workspace-editor__rowhead {
  background: #fff8ea;
}

.workspace-editor__table-cell--readonly {
  color: var(--text-secondary);
}

.workspace-editor__table-input {
  width: 100%;
  min-width: 140px;
  height: 34px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  color: var(--text-primary);
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.workspace-editor__table-value {
  display: inline-block;
  min-height: 20px;
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.workspace-editor__empty-state {
  padding: 24px;
  border: 1px dashed var(--line-subtle);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
}

.workspace-editor__empty-state--sheet {
  flex: 1;
}

.workspace-editor__empty-state h3,
.workspace-editor__empty-state p {
  margin: 0;
}

.workspace-editor__empty-state p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.workspace-editor__statusbar {
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-top: 1px solid var(--line-subtle);
  background: var(--surface-subtle);
  color: var(--text-secondary);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.workspace-editor__status-left,
.workspace-editor__status-right {
  min-width: 0;
  flex-wrap: wrap;
}

.workspace-editor__status-action {
  border: none;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.workspace-editor__diagnostic-panel {
  padding: 12px;
  border-top: 1px solid var(--line-subtle);
  background: color-mix(in srgb, var(--surface-subtle) 76%, white);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-editor__diagnostic-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.workspace-editor__diagnostic-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-editor__diagnostic-item {
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  color: var(--text-primary);
  text-align: left;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.workspace-editor__diagnostic-item--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
}

.workspace-editor__diagnostic-severity {
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  font-weight: 600;
}

.workspace-editor__diagnostic-severity--warning {
  color: #b45309;
}

.workspace-editor__diagnostic-severity--error {
  color: #b91c1c;
}

.workspace-editor__diagnostic-location {
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.workspace-editor__diagnostic-message {
  flex: 1 1 240px;
}

@media (max-width: 880px) {
  .workspace-editor__contextbar {
    gap: 8px;
  }

  .workspace-editor__tab-row {
    align-items: start;
  }

  .workspace-editor__toolbar {
    grid-template-columns: 1fr;
  }

  .workspace-editor__toolbar-main {
    overflow-x: auto;
  }

  .workspace-editor__toolbar-actions {
    justify-content: flex-start;
  }

  .workspace-editor__mml-config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
