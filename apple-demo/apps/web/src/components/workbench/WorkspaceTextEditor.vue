<template>
  <div class="workspace-text-editor-shell">
    <div ref="container" class="workspace-text-editor" data-editor-engine="monaco" />
    <div v-if="compositeEditorState" class="workspace-text-editor__composite-editor">
      <div class="workspace-text-editor__composite-header">
        <strong>{{ compositeEditorState.label }}</strong>
        <span>{{ compositeEditorState.paramName }}</span>
      </div>
      <div class="workspace-text-editor__composite-actions">
        <button type="button" @click="enableAllCompositeOptions">Enable All</button>
        <button type="button" @click="disableAllCompositeOptions">Disable All</button>
      </div>
      <div class="workspace-text-editor__composite-grid">
        <label v-for="option in compositeEditorState.options" :key="option" class="workspace-text-editor__composite-option">
          <input
            type="checkbox"
            :checked="compositeEditorEnabledSet.has(option)"
            @change="toggleCompositeOption(option)"
          >
          <span>{{ option }}</span>
        </label>
      </div>
      <div class="workspace-text-editor__composite-actions">
        <button type="button" @click="closeCompositeEditor">Cancel</button>
        <button type="button" @click="applyCompositeEditor">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { MML_LANGUAGE_ID, WORKSPACE_EDITOR_THEME } from './textEditor/mmlLanguage'
import { loadMonaco } from './textEditor/monacoRuntime'
import type { MmlSchemaResponse } from '@/api/types'
import {
  buildMmlDiagnostics,
  findCompositeEditTarget,
  getHoverSchemaParameter,
  type MmlDiagnostic,
  getMmlCompletionItems,
  serializeCompositeEditResult
} from './textEditor/mmlAssistance'

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

type WorkspaceSearchMatch = ReturnType<Monaco.editor.ITextModel['findMatches']>[number]

const props = defineProps<{
  modelValue: string
  fileMode: 'text' | 'markdown' | 'mml'
  mmlSchema?: MmlSchemaResponse | null
  activeDiagnosticId?: string | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'diagnostics-change', value: WorkspaceTextEditorDiagnostic[]): void
  (event: 'blur'): void
}>()

const container = ref<HTMLElement | null>(null)

let monaco: typeof Monaco | null = null
let model: Monaco.editor.ITextModel | null = null
let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let changeSubscription: Monaco.IDisposable | null = null
let assistanceDisposables: Monaco.IDisposable[] = []
let applyingExternalValue = false
let disposed = false
let activeSearchQuery = ''
let activeSearchMatchIndex = -1
const diagnostics = ref<WorkspaceTextEditorDiagnostic[]>([])

const SEARCH_MATCH_LIMIT = 19_999
const SEARCH_WORD_SEPARATORS: string | null = null

const compositeEditorState = ref<{
  paramName: string
  label: string
  options: string[]
  enabled: string[]
  valueStart: number
  valueEnd: number
} | null>(null)
const compositeEditorEnabledSet = computed(() => new Set(compositeEditorState.value?.enabled || []))

function resolveLanguage(fileMode: 'text' | 'markdown' | 'mml'): string {
  if (fileMode === 'mml') return MML_LANGUAGE_ID
  if (fileMode === 'markdown') return 'markdown'
  return 'plaintext'
}

onMounted(async () => {
  if (!container.value) return

  monaco = await loadMonaco()
  if (disposed || !container.value) return
  const monacoApi = monaco
  if (!monacoApi) return

  model = monacoApi.editor.createModel(props.modelValue, resolveLanguage(props.fileMode))
  editor = monacoApi.editor.create(container.value, {
    model,
    theme: WORKSPACE_EDITOR_THEME,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 12,
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    hover: {
      enabled: true,
      sticky: true
    },
    fontSize: 13,
    fontFamily: 'SFMono-Regular, Consolas, monospace',
    padding: {
      top: 16,
      bottom: 16
    }
  })
  verifyHoverContribution()

  changeSubscription = model.onDidChangeContent(() => {
    if (applyingExternalValue || !model) return
    refreshDiagnostics()
    refreshSearchMatchIndex()
    emit('update:modelValue', model.getValue())
  })

  refreshMmlAssistance()
  refreshDiagnostics()
  editor.onDidBlurEditorText(() => {
    emit('blur')
  })
})

watch(
  () => props.modelValue,
  value => {
    if (!model || model.getValue() === value) return
    applyingExternalValue = true
    model.setValue(value)
    applyingExternalValue = false
    refreshDiagnostics()
    refreshSearchMatchIndex()
  }
)

watch(
  () => props.fileMode,
  mode => {
    if (!monaco || !model) return
    const nextLanguage = resolveLanguage(mode)
    if (model.getLanguageId() === nextLanguage) return
    monaco.editor.setModelLanguage(model, nextLanguage)
    refreshMmlAssistance()
    refreshDiagnostics()
  }
)

watch(
  () => props.mmlSchema,
  () => {
    refreshMmlAssistance()
    refreshDiagnostics()
  },
  { deep: true }
)

watch(
  () => props.activeDiagnosticId || null,
  diagnosticId => {
    revealDiagnostic(diagnosticId)
  }
)

onBeforeUnmount(() => {
  disposed = true
  changeSubscription?.dispose()
  disposeAssistance()
  editor?.dispose()
  model?.dispose()
})

defineExpose({
  clearSearch,
  findNextMatch,
  findPreviousMatch,
  replaceAllMatches,
  replaceCurrentMatch,
  setSearchQuery,
  undo
})

function refreshMmlAssistance(): void {
  disposeAssistance()
  closeCompositeEditor()
  if (!monaco || !model || !editor || props.fileMode !== 'mml' || !props.mmlSchema) {
    return
  }

  assistanceDisposables.push(monaco.languages.registerCompletionItemProvider(MML_LANGUAGE_ID, {
    provideCompletionItems(textModel, position) {
      const offset = textModel.getOffsetAt(position)
      const word = textModel.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      return {
        suggestions: getMmlCompletionItems(props.mmlSchema || null, textModel.getValue(), offset).map(item => ({
          label: item.label,
          kind: resolveCompletionKind(monaco!, item.kind),
          insertText: item.insertText,
          detail: item.detail,
          range
        }))
      }
    }
  }))

  assistanceDisposables.push(monaco.languages.registerHoverProvider(MML_LANGUAGE_ID, {
    provideHover(textModel, position) {
      const offset = textModel.getOffsetAt(position)
      const schemaParam = getHoverSchemaParameter(props.mmlSchema || null, textModel.getValue(), offset)
      if (!schemaParam) {
        return null
      }
      const contents = [
        { value: `**${schemaParam.paramName}**` },
        { value: `类型: ${schemaParam.valueFormat || schemaParam.valueType}` },
        ...(schemaParam.enumValues.length ? [{ value: `枚举: ${schemaParam.enumValues.join(', ')}` }] : []),
        ...(schemaParam.compositeFlagSetOptions?.length
          ? [{ value: `位域项: ${schemaParam.compositeFlagSetOptions.join(', ')}` }]
          : [])
      ]
      return {
        contents
      }
    }
  }))

  const actionDisposable = editor.addAction({
    id: 'mml.openCompositeEditor',
    label: 'Open Structured Composite Editor',
    run: currentEditor => {
      if (!model) return
      const position = currentEditor.getPosition()
      if (!position) return
      const offset = model.getOffsetAt(position)
      const target = findCompositeEditTarget(props.mmlSchema || null, model.getValue(), offset)
      if (!target) return
      compositeEditorState.value = {
        paramName: target.paramName,
        label: target.label,
        options: target.options,
        enabled: [...target.enabledOptions],
        valueStart: target.valueStart,
        valueEnd: target.valueEnd
      }
    }
  })
  if (actionDisposable && typeof actionDisposable.dispose === 'function') {
    assistanceDisposables.push(actionDisposable)
  }
}

function refreshDiagnostics(): void {
  if (!monaco || !model) {
    return
  }
  if (props.fileMode !== 'mml') {
    diagnostics.value = []
    emit('diagnostics-change', [])
    monaco.editor.setModelMarkers(model, 'mml-schema', [])
    return
  }
  const nextDiagnostics = buildMmlDiagnostics(props.mmlSchema || null, model.getValue()).map(issue =>
    toEditorDiagnostic(issue)
  )
  diagnostics.value = nextDiagnostics
  emit('diagnostics-change', nextDiagnostics)
  const markers = nextDiagnostics.map(issue => ({
    severity: issue.severity === 'error' ? monaco!.MarkerSeverity.Error : monaco!.MarkerSeverity.Warning,
    message: issue.message,
    startLineNumber: issue.startLineNumber,
    startColumn: issue.startColumn,
    endLineNumber: issue.endLineNumber,
    endColumn: issue.endColumn
  }))
  monaco.editor.setModelMarkers(model, 'mml-schema', markers)
  revealDiagnostic(props.activeDiagnosticId || null)
}

function disposeAssistance(): void {
  assistanceDisposables.forEach(item => item.dispose())
  assistanceDisposables = []
}

function closeCompositeEditor(): void {
  compositeEditorState.value = null
}

function setSearchQuery(searchQuery: string): boolean {
  activeSearchQuery = searchQuery
  const matches = getSearchMatches(searchQuery)
  if (!matches.length) {
    activeSearchMatchIndex = -1
    return false
  }
  activeSearchMatchIndex = 0
  revealSearchMatch(matches[0], false)
  return true
}

function clearSearch(): void {
  activeSearchQuery = ''
  activeSearchMatchIndex = -1
}

function findNextMatch(): boolean {
  return moveSearchMatch('next')
}

function findPreviousMatch(): boolean {
  return moveSearchMatch('previous')
}

function replaceCurrentMatch(replaceQuery: string): boolean {
  if (!model || !activeSearchQuery) return false
  const matches = getSearchMatches(activeSearchQuery)
  if (!matches.length) {
    activeSearchMatchIndex = -1
    return false
  }
  const matchIndex = resolveActiveSearchMatchIndex(matches)
  model.pushEditOperations([], [{
    range: matches[matchIndex].range,
    text: replaceQuery
  }], () => null)
  refreshDiagnostics()
  const nextMatches = getSearchMatches(activeSearchQuery)
  if (!nextMatches.length) {
    activeSearchMatchIndex = -1
    editor?.focus()
    return true
  }
  activeSearchMatchIndex = Math.min(matchIndex, nextMatches.length - 1)
  revealSearchMatch(nextMatches[activeSearchMatchIndex])
  return true
}

function replaceAllMatches(replaceQuery: string): boolean {
  if (!model || !activeSearchQuery) return false
  const matches = getSearchMatches(activeSearchQuery)
  if (!matches.length) {
    activeSearchMatchIndex = -1
    return false
  }
  model.pushEditOperations([], matches.map(match => ({
    range: match.range,
    text: replaceQuery
  })), () => null)
  refreshDiagnostics()
  const nextMatches = getSearchMatches(activeSearchQuery)
  if (!nextMatches.length) {
    activeSearchMatchIndex = -1
    editor?.focus()
    return true
  }
  activeSearchMatchIndex = 0
  revealSearchMatch(nextMatches[0])
  return true
}

function undo(): void {
  if (!editor) return
  editor.trigger('workspace-text-editor', 'undo', null)
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
  if (!monaco || !model || !editor || !compositeEditorState.value) return
  const nextValue = serializeCompositeEditResult({
    commandName: '',
    paramName: compositeEditorState.value.paramName,
    label: compositeEditorState.value.label,
    options: compositeEditorState.value.options,
    enabledOptions: compositeEditorState.value.enabled,
    valueStart: compositeEditorState.value.valueStart,
    valueEnd: compositeEditorState.value.valueEnd
  }, compositeEditorState.value.enabled)
  const start = model.getPositionAt(compositeEditorState.value.valueStart)
  const end = model.getPositionAt(compositeEditorState.value.valueEnd)
  model.pushEditOperations([], [{
    range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
    text: nextValue
  }], () => null)
  closeCompositeEditor()
  refreshDiagnostics()
}

function moveSearchMatch(direction: 'next' | 'previous'): boolean {
  const matches = getSearchMatches(activeSearchQuery)
  if (!matches.length) {
    activeSearchMatchIndex = -1
    return false
  }
  const offset = direction === 'next' ? 1 : -1
  const nextIndex = resolveActiveSearchMatchIndex(matches) + offset
  activeSearchMatchIndex = (nextIndex + matches.length) % matches.length
  revealSearchMatch(matches[activeSearchMatchIndex])
  return true
}

function getSearchMatches(searchQuery: string): WorkspaceSearchMatch[] {
  if (!model || !searchQuery) {
    return []
  }
  return model.findMatches(
    searchQuery,
    true,
    false,
    false,
    SEARCH_WORD_SEPARATORS,
    false,
    SEARCH_MATCH_LIMIT
  )
}

function resolveActiveSearchMatchIndex(matches: WorkspaceSearchMatch[]): number {
  if (!matches.length) {
    return -1
  }
  if (activeSearchMatchIndex < 0) {
    return 0
  }
  return Math.min(activeSearchMatchIndex, matches.length - 1)
}

function refreshSearchMatchIndex(): void {
  if (!activeSearchQuery) {
    activeSearchMatchIndex = -1
    return
  }
  const matches = getSearchMatches(activeSearchQuery)
  if (!matches.length) {
    activeSearchMatchIndex = -1
    return
  }
  activeSearchMatchIndex = resolveActiveSearchMatchIndex(matches)
}

function revealSearchMatch(match: WorkspaceSearchMatch, focusEditor = true): void {
  if (!editor) {
    return
  }
  editor.setSelection(match.range)
  editor.revealRangeInCenter(match.range)
  if (focusEditor) {
    editor.focus()
  }
}

function resolveCompletionKind(
  monacoApi: typeof Monaco,
  kind: 'command' | 'param' | 'value' | 'action'
): Monaco.languages.CompletionItemKind {
  if (kind === 'command') return monacoApi.languages.CompletionItemKind.Keyword
  if (kind === 'param') return monacoApi.languages.CompletionItemKind.Field
  if (kind === 'action') return monacoApi.languages.CompletionItemKind.Function
  return monacoApi.languages.CompletionItemKind.Value
}

function verifyHoverContribution(): void {
  if (!editor || typeof editor.getContribution !== 'function') {
    return
  }
  const hoverContribution = editor.getContribution('editor.contrib.contentHover')
  if (!hoverContribution) {
    console.warn(
      'WorkspaceTextEditor: Monaco hover contribution is unavailable. Check the runtime entrypoint; hover support is not loaded.'
    )
  }
}

function toEditorDiagnostic(issue: MmlDiagnostic): WorkspaceTextEditorDiagnostic {
  const start = model!.getPositionAt(issue.start)
  const end = model!.getPositionAt(issue.end)
  return {
    id: buildDiagnosticId(issue),
    commandHead: issue.commandHead,
    message: issue.message,
    severity: issue.severity,
    start: issue.start,
    end: issue.end,
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column
  }
}

function buildDiagnosticId(issue: MmlDiagnostic): string {
  return [issue.commandHead, issue.start, issue.end, issue.message].join(':')
}

function revealDiagnostic(diagnosticId: string | null): void {
  if (!diagnosticId || !monaco || !editor) {
    return
  }
  const diagnostic = diagnostics.value.find(item => item.id === diagnosticId)
  if (!diagnostic) {
    return
  }
  const range = new monaco.Range(
    diagnostic.startLineNumber,
    diagnostic.startColumn,
    diagnostic.endLineNumber,
    diagnostic.endColumn
  )
  editor.setSelection(range)
  editor.revealRangeInCenter(range)
  editor.focus()
}
</script>

<style scoped>
.workspace-text-editor-shell {
  position: relative;
  width: 100%;
  height: 100%;
}

.workspace-text-editor {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.workspace-text-editor__composite-editor {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: min(520px, calc(100% - 32px));
  max-height: 50%;
  overflow: auto;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-text-editor__composite-header,
.workspace-text-editor__composite-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workspace-text-editor__composite-header span {
  color: #64748b;
  font-size: 12px;
}

.workspace-text-editor__composite-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.workspace-text-editor__composite-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #fff;
  font-family: SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
</style>
