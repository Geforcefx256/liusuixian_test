<template>
  <div class="mml-workbook-grid">
    <div ref="host" class="mml-workbook-grid__host" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import jspreadsheet from 'jspreadsheet-ce'
import 'jsuites/dist/jsuites.css'
import 'jspreadsheet-ce/dist/jspreadsheet.css'

import type {
  MmlGridRow,
  MmlGridSheet,
  MmlIncompleteRowState,
  MmlPersistedGridRow,
  MmlWorkbookColumn,
  MmlWorkbookRow
} from './mmlWorkbook'
import { isEditableMmlCell, isPersistedMmlGridRow, validateMmlWorkbookCell } from './mmlWorkbook'

export interface MmlGridSelectionRange {
  x1: number
  y1: number
  x2: number
  y2: number
}

const props = defineProps<{
  sheet: MmlGridSheet
  selectedRange: MmlGridSelectionRange | null
  incompleteRows?: Record<number, MmlIncompleteRowState>
  readOnly?: boolean
}>()

const emit = defineEmits<{
  (event: 'selection-change', value: MmlGridSelectionRange | null): void
  (event: 'cell-change', rowId: string, columnKey: string, nextValue: string): void
  (event: 'spare-cell-change', payload: { rowNumber: number; columnKey: string; nextValue: string }): void
  (event: 'range-paste', payload: { startColumnIndex: number; startRowIndex: number; values: string[][]; targetRange: MmlGridSelectionRange | null }): void
  (event: 'blocked-edit', message: string): void
  (event: 'composite-edit-request', payload: { rowId: string; columnKey: string }): void
}>()

const host = ref<HTMLDivElement | null>(null)

let spreadsheet: ReturnType<typeof jspreadsheet> | null = null
let rebuildToken = 0
let destroyed = false
let rebuildPending = false
let syncingIncompleteRows = false
let previousIncompleteRowSignatures: Record<number, string> = {}
let currentSelection: MmlGridSelectionRange | null = null
const pendingFrameHandles = new Set<number>()

onMounted(() => {
  void rebuildSpreadsheet()
})

onBeforeUnmount(() => {
  destroyed = true
  for (const handle of pendingFrameHandles) {
    cancelScheduledFrame(handle)
  }
  pendingFrameHandles.clear()
  destroySpreadsheet()
})

watch(
  () => [
    props.sheet.key,
    props.readOnly ?? false,
    props.sheet.rows.map(row => `${row.id}:${Object.values(row.values).join('\u0001')}`).join('\u0002'),
    props.sheet.columns.map(column => `${column.key}:${column.label}:${column.controlType}:${column.editable}:${column.known}`).join('\u0002')
  ],
  () => {
    void rebuildSpreadsheet()
  },
  { deep: false }
)

watch(
  () => props.selectedRange,
  () => {
    if (rebuildPending) return
    syncSelection()
  },
  { deep: true, flush: 'post' }
)

watch(
  () => props.incompleteRows,
  () => {
    if (rebuildPending) return
    syncIncompleteRows()
    syncReadonlyCells()
  },
  { deep: true, flush: 'post' }
)

async function rebuildSpreadsheet(): Promise<void> {
  const token = ++rebuildToken
  rebuildPending = true
  await nextTick()
  if (destroyed || token !== rebuildToken || !host.value) return

  destroySpreadsheet()
  if (destroyed || token !== rebuildToken || !host.value) return

  spreadsheet = jspreadsheet(host.value, {
    data: buildGridData(),
    columns: buildGridColumns(),
    rows: props.sheet.rows.map(row => ({ title: String(row.rowNumber) })),
    editable: !(props.readOnly ?? false),
    allowInsertColumn: false,
    allowInsertRow: false,
    allowDeleteColumn: false,
    allowDeleteRow: false,
    allowRenameColumn: false,
    allowManualInsertColumn: false,
    allowManualInsertRow: false,
    tableOverflow: true,
    tableWidth: '100%',
    tableHeight: '100%',
    copyCompatibility: true,
    freezeColumns: props.sheet.columns.length > 0 ? 1 : 0,
    onbeforechange: (_element, _cell, colIndex, rowIndex, newValue) => {
      const x = Number(colIndex)
      const y = Number(rowIndex)
      const row = props.sheet.rows[y]
      const column = props.sheet.columns[x]
      if (props.readOnly) {
        emitDeferred('blocked-edit', '当前文件为只读，不能修改。')
        return getCurrentCellValue(x, y)
      }
      if (!row || !column) {
        emitDeferred('blocked-edit', describeBlockedCell(row, column, x, y))
        return getCurrentCellValue(x, y)
      }
      const isPersistedRow = isPersistedMmlGridRow(row)
      if (isPersistedRow && !isEditableMmlCell(toWorkbookRow(row), column)) {
        emitDeferred('blocked-edit', describeBlockedCell(row, column, x, y))
        return getCurrentCellValue(x, y)
      }
      if (!isPersistedRow && (!column.known || !column.editable)) {
        emitDeferred('blocked-edit', describeBlockedCell(row, column, x, y))
        return getCurrentCellValue(x, y)
      }
      if (isPersistedRow && column.controlType === 'composite') {
        emitDeferred('composite-edit-request', { rowId: row.persistedRowId, columnKey: column.key })
        return getCurrentCellValue(x, y)
      }

      const validationMessage = validateMmlWorkbookCell(column, normalizeCellValue(newValue))
      if (validationMessage) {
        emitDeferred('blocked-edit', `R${row.rowNumber} ${column.label} · ${validationMessage}`)
        return getCurrentCellValue(x, y)
      }

      return normalizeCellValue(newValue)
    },
    onchange: (_element, _cell, colIndex, rowIndex, newValue, oldValue) => {
      if (syncingIncompleteRows) return
      const x = Number(colIndex)
      const y = Number(rowIndex)
      const row = props.sheet.rows[y]
      const column = props.sheet.columns[x]
      if (props.readOnly) return
      if (!row || !column) return
      const isPersistedRow = isPersistedMmlGridRow(row)
      if (isPersistedRow && !isEditableMmlCell(toWorkbookRow(row), column)) return
      if (!isPersistedRow && (!column.known || !column.editable)) return

      const nextValue = normalizeCellValue(newValue)
      const previousValue = normalizeCellValue(oldValue)
      if (nextValue === previousValue) return

      if (isPersistedRow) {
        emitDeferred('cell-change', row.persistedRowId, column.key, nextValue)
        return
      }
      emitDeferred('spare-cell-change', {
        rowNumber: row.rowNumber,
        columnKey: column.key,
        nextValue
      })
    },
    onbeforepaste: (_element, copiedText, colIndex, rowIndex) => {
      const x = Number(colIndex)
      const y = Number(rowIndex)
      const values = parseClipboardText(copiedText)
      if (!values.length) return false
      if (props.readOnly) {
        emitDeferred('blocked-edit', '当前文件为只读，不能修改。')
        return false
      }

      for (let rowOffset = 0; rowOffset < values.length; rowOffset += 1) {
        const row = props.sheet.rows[y + rowOffset]
        if (!row) {
          emitDeferred('blocked-edit', '粘贴区域超出当前命令页范围。')
          return false
        }

        for (let columnOffset = 0; columnOffset < values[rowOffset].length; columnOffset += 1) {
          const column = props.sheet.columns[x + columnOffset]
          if (!column) {
            emitDeferred('blocked-edit', '粘贴区域超出当前命令页范围。')
            return false
          }
          if (isPersistedMmlGridRow(row) && !isEditableMmlCell(toWorkbookRow(row), column)) {
            emitDeferred('blocked-edit', describeBlockedCell(row, column, x + columnOffset, y + rowOffset))
            return false
          }
          if (!isPersistedMmlGridRow(row) && (!column.known || !column.editable)) {
            emitDeferred('blocked-edit', describeBlockedCell(row, column, x + columnOffset, y + rowOffset))
            return false
          }
          const validationMessage = validateMmlWorkbookCell(column, normalizeCellValue(values[rowOffset][columnOffset]))
          if (validationMessage) {
            emitDeferred('blocked-edit', `R${row.rowNumber} ${column.label} · ${validationMessage}`)
            return false
          }
        }
      }

      emitDeferred('range-paste', {
        startColumnIndex: x,
        startRowIndex: y,
        values,
        targetRange: currentSelection ? { ...currentSelection } : null
      })
      return false
    },
    onselection: (_element, x1, y1, x2, y2, origin) => {
      if (origin === 'external-sync') return
      currentSelection = { x1, y1, x2, y2 }
      if (x1 === x2 && y1 === y2) {
        const row = props.sheet.rows[y1]
        const column = props.sheet.columns[x1]
        if (row && column && isPersistedMmlGridRow(row) && isEditableMmlCell(toWorkbookRow(row), column) && column.controlType === 'composite') {
          emitDeferred('composite-edit-request', { rowId: row.persistedRowId, columnKey: column.key })
        }
      }
      emitDeferred('selection-change', { x1, y1, x2, y2 })
    }
  })

  if (destroyed || token !== rebuildToken) {
    destroySpreadsheet()
    return
  }

  rebuildPending = false
  syncIncompleteRows({ forceFullSync: true })
  syncReadonlyCells()
  syncSelection()
}

function destroySpreadsheet(): void {
  spreadsheet?.destroy()
  spreadsheet = null
}

function emitDeferred(event: 'selection-change', value: MmlGridSelectionRange | null): void
function emitDeferred(event: 'cell-change', rowId: string, columnKey: string, nextValue: string): void
function emitDeferred(event: 'spare-cell-change', payload: { rowNumber: number; columnKey: string; nextValue: string }): void
function emitDeferred(event: 'range-paste', payload: { startColumnIndex: number; startRowIndex: number; values: string[][]; targetRange: MmlGridSelectionRange | null }): void
function emitDeferred(event: 'blocked-edit', message: string): void
function emitDeferred(event: 'composite-edit-request', payload: { rowId: string; columnKey: string }): void
function emitDeferred(event: string, ...args: unknown[]): void {
  const handle = scheduleFrame(() => {
    if (destroyed) return
    if (event === 'selection-change') {
      emit('selection-change', args[0] as MmlGridSelectionRange | null)
      return
    }
    if (event === 'cell-change') {
      emit('cell-change', args[0] as string, args[1] as string, args[2] as string)
      return
    }
    if (event === 'spare-cell-change') {
      emit('spare-cell-change', args[0] as { rowNumber: number; columnKey: string; nextValue: string })
      return
    }
    if (event === 'range-paste') {
      emit('range-paste', args[0] as { startColumnIndex: number; startRowIndex: number; values: string[][]; targetRange: MmlGridSelectionRange | null })
      return
    }
    if (event === 'blocked-edit') {
      emit('blocked-edit', args[0] as string)
      return
    }
    if (event === 'composite-edit-request') {
      emit('composite-edit-request', args[0] as { rowId: string; columnKey: string })
    }
  })
  pendingFrameHandles.add(handle)
}

function scheduleFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') {
    let handle = 0
    handle = requestAnimationFrame(() => {
      pendingFrameHandles.delete(handle)
      callback()
    })
    return handle
  }
  const handle = window.setTimeout(() => {
    pendingFrameHandles.delete(handle)
    callback()
  }, 0)
  return handle
}

function cancelScheduledFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle)
    return
  }
  window.clearTimeout(handle)
}

function buildGridData(): string[][] {
  return props.sheet.rows.map(row => props.sheet.columns.map(column => getCellValue(row, column)))
}

function buildGridColumns(): Array<Record<string, unknown>> {
  return props.sheet.columns.map(column => ({
    type: column.controlType === 'select' ? 'dropdown' : 'text',
    title: column.label,
    width: column.controlType === 'select' ? 150 : 180,
    source: column.controlType === 'select' ? column.enumValues : undefined,
    autocomplete: column.controlType === 'select',
    readOnly: !column.known || !column.editable,
    wordWrap: false
  }))
}

function syncReadonlyCells(): void {
  if (!spreadsheet) return

  const renderedRows = getRenderedRows()
  for (let y = 0; y < renderedRows.length; y += 1) {
    const renderedRow = renderedRows[y]
    if (!renderedRow) continue
    for (let x = 0; x < renderedRow.length; x += 1) {
      const cell = renderedRow[x]
      if (!cell) continue
      const row = props.sheet.rows[y]
      const column = props.sheet.columns[x]
      if (!row || !column) continue
      const blocked = !row || !column
        ? true
        : isPersistedMmlGridRow(row)
          ? !isEditableMmlCell(toWorkbookRow(row), column)
          : !column.known || !column.editable
      const rowIssue = row ? resolveCellIssue(row, column) : ''
      cell.classList.toggle('readonly', blocked)
      cell.classList.toggle('mml-workbook-grid__cell--readonly', blocked)
      cell.classList.toggle('mml-workbook-grid__cell--spare', Boolean(row && !isPersistedMmlGridRow(row)))
      cell.classList.toggle('mml-workbook-grid__cell--invalid', Boolean(rowIssue))
      cell.title = blocked ? describeBlockedCell(row, column, x, y) : rowIssue
    }
  }
}

function syncIncompleteRows(options: { forceFullSync?: boolean } = {}): void {
  if (!spreadsheet) return

  const nextSignatures = buildIncompleteRowSignatures(props.incompleteRows)
  const rowNumbers = options.forceFullSync
    ? props.sheet.rows
      .filter(row => !isPersistedMmlGridRow(row))
      .map(row => row.rowNumber)
    : getChangedIncompleteRowNumbers(previousIncompleteRowSignatures, nextSignatures)

  if (!rowNumbers.length) {
    previousIncompleteRowSignatures = nextSignatures
    return
  }

  syncingIncompleteRows = true
  try {
    for (const rowNumber of rowNumbers) {
      const y = resolveGridRowIndex(rowNumber)
      const row = props.sheet.rows[y]
      if (!row || isPersistedMmlGridRow(row)) continue
      for (let x = 0; x < props.sheet.columns.length; x += 1) {
        const column = props.sheet.columns[x]
        if (!column) continue
        const nextValue = getCellValue(row, column)
        const currentValue = getGridDataValue(x, y)
        if (currentValue === nextValue) continue
        setGridDataValue(x, y, nextValue)
      }
    }
  } finally {
    syncingIncompleteRows = false
    previousIncompleteRowSignatures = nextSignatures
  }
}

function buildIncompleteRowSignatures(rows?: Record<number, MmlIncompleteRowState>): Record<number, string> {
  return Object.fromEntries(
    Object.entries(rows || {}).map(([rowNumber, row]) => [
      Number(rowNumber),
      JSON.stringify({
        values: row.values,
        invalidCells: row.invalidCells,
        missingRequired: row.missingRequired,
        missingConditionalRequired: row.missingConditionalRequired
      })
    ])
  )
}

function getChangedIncompleteRowNumbers(
  previous: Record<number, string>,
  next: Record<number, string>
): number[] {
  const rowNumbers = new Set<number>([
    ...Object.keys(previous).map(value => Number(value)),
    ...Object.keys(next).map(value => Number(value))
  ])
  return [...rowNumbers]
    .filter(rowNumber => previous[rowNumber] !== next[rowNumber])
    .sort((left, right) => left - right)
}

function resolveGridRowIndex(rowNumber: number): number {
  const directIndex = rowNumber - 1
  if (props.sheet.rows[directIndex]?.rowNumber === rowNumber) {
    return directIndex
  }
  return props.sheet.rows.findIndex(row => row.rowNumber === rowNumber)
}

function getGridDataValue(x: number, y: number): string {
  return normalizeCellValue(getGridDataRows()?.[y]?.[x])
}

function setGridDataValue(x: number, y: number, value: string): void {
  const dataRows = getGridDataRows()
  if (!dataRows) return

  if (!dataRows[y]) {
    dataRows[y] = props.sheet.columns.map(() => '')
  }
  dataRows[y][x] = value

  const cell = getRenderedCell(x, y)
  if (!cell) return
  cell.textContent = value
}

function getGridDataRows(): string[][] | null {
  return (spreadsheet as (ReturnType<typeof jspreadsheet> & { options?: { data?: string[][] } }) | null)?.options?.data || null
}

function getRenderedRows(): Array<Array<HTMLTableCellElement | undefined> | undefined> {
  return (spreadsheet as (ReturnType<typeof jspreadsheet> & {
    records?: Array<Array<HTMLTableCellElement | undefined> | undefined>
  }) | null)?.records || []
}

function getRenderedCell(x: number, y: number): HTMLTableCellElement | null {
  return getRenderedRows()[y]?.[x] || null
}

function resolveCellIssue(row: MmlGridRow, column: MmlWorkbookColumn): string {
  if (isPersistedMmlGridRow(row)) {
    if (row.missingRequired.includes(column.key)) {
      return `R${row.rowNumber} ${column.label} · 缺少必选参数`
    }
    if (row.missingConditionalRequired.includes(column.key)) {
      return `R${row.rowNumber} ${column.label} · 缺少条件必选参数`
    }
    return ''
  }
  const incompleteRow = props.incompleteRows?.[row.rowNumber]
  if (!incompleteRow) return ''
  const invalidMessage = incompleteRow.invalidCells[column.key]
  if (invalidMessage) {
    return `R${row.rowNumber} ${column.label} · ${invalidMessage}`
  }
  if (incompleteRow.missingRequired.includes(column.key)) {
    return `R${row.rowNumber} ${column.label} · 缺少必选参数`
  }
  if (incompleteRow.missingConditionalRequired.includes(column.key)) {
    return `R${row.rowNumber} ${column.label} · 缺少条件必选参数`
  }
  return ''
}

function syncSelection(): void {
  if (!spreadsheet) return
  if (!props.selectedRange) {
    spreadsheet.resetSelection()
    return
  }

  spreadsheet.updateSelectionFromCoords(
    props.selectedRange.x1,
    props.selectedRange.y1,
    props.selectedRange.x2,
    props.selectedRange.y2,
    'external-sync'
  )
}

function getCurrentCellValue(x: number, y: number): string {
  const row = props.sheet.rows[y]
  const column = props.sheet.columns[x]
  if (!row || !column) return ''
  return getCellValue(row, column)
}

function getCellValue(row: MmlGridRow, column: MmlWorkbookColumn): string {
  if (!isPersistedMmlGridRow(row)) {
    return props.incompleteRows?.[row.rowNumber]?.values[column.key] || ''
  }
  return row.values[column.key] || ''
}

function describeBlockedCell(
  row: MmlGridRow | undefined,
  column: MmlWorkbookColumn | undefined,
  x: number,
  y: number
): string {
  if (!row || !column) {
    return `R${y + 1} C${x + 1} · 当前单元格不可编辑`
  }
  if (!isPersistedMmlGridRow(row)) {
    if (!column.known || !column.editable) {
      return `R${row.rowNumber} ${column.label} · 当前单元格不支持表格新增`
    }
    const rowIssue = resolveCellIssue(row, column)
    if (rowIssue) return rowIssue
    return `R${row.rowNumber} ${column.label} · 可在空白行继续填写`
  }
  if (row.readOnly) {
    return `R${row.rowNumber} ${column.label} · ${row.readOnlyReasons.join(' · ')}`
  }
  if (!column.known || !column.editable) {
    return `R${row.rowNumber} ${column.label} · 当前单元格不支持表格编辑`
  }
  if (column.controlType === 'composite') {
    return `R${row.rowNumber} ${column.label} · 请使用模板化编辑器`
  }
  return `R${row.rowNumber} ${column.label} · 当前单元格不可编辑`
}

function parseClipboardText(copiedText: string): string[][] {
  return copiedText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((row, index, rows) => !(index === rows.length - 1 && row === ''))
    .map(row => row.split('\t'))
}

function normalizeCellValue(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

function toWorkbookRow(row: MmlPersistedGridRow): MmlWorkbookRow {
  return {
    id: row.persistedRowId,
    statementId: row.persistedRowId,
    rowNumber: row.rowNumber,
    commandHead: props.sheet.commandHead,
    values: row.values,
    knownParameters: [],
    unknownParameters: [],
    readOnly: row.readOnly,
    readOnlyReasons: row.readOnlyReasons,
    parseStatus: 'ok',
    missingRequired: row.missingRequired,
    missingConditionalRequired: row.missingConditionalRequired
  }
}
</script>

<style scoped>
.mml-workbook-grid {
  min-height: 0;
  flex: 1;
  display: flex;
}

.mml-workbook-grid__host {
  min-height: 0;
  flex: 1;
  background: transparent;
}

.mml-workbook-grid__host :deep(.jexcel_container) {
  border: none;
  font-family: var(--font-family-ui);
  background: transparent;
}

.mml-workbook-grid__host :deep(.jexcel_content_wrapper) {
  min-height: 0;
  background: transparent;
}

.mml-workbook-grid__host :deep(.jexcel) {
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
  border: none;
  background: var(--surface-panel);
  box-shadow: none;
}

.mml-workbook-grid__host :deep(.jexcel > thead > tr > td) {
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
  border-color: var(--line-subtle);
  color: var(--text-secondary);
}

.mml-workbook-grid__host :deep(.jexcel > tbody > tr > td) {
  font-size: var(--font-table);
  line-height: var(--line-table);
  border-color: var(--line-subtle);
  background-color: var(--surface-panel);
}

.mml-workbook-grid__host :deep(.jexcel > tbody > tr > td.mml-workbook-grid__cell--spare) {
  background: rgba(241, 245, 249, 0.82);
}

.mml-workbook-grid__host :deep(.jexcel > tbody > tr > td.mml-workbook-grid__cell--invalid) {
  background: #fdecec;
  box-shadow: inset 0 0 0 1px #d14343;
}

.mml-workbook-grid__host :deep(input),
.mml-workbook-grid__host :deep(textarea),
.mml-workbook-grid__host :deep(select) {
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.mml-workbook-grid__host :deep(.jexcel > tbody > tr > td.readonly),
.mml-workbook-grid__host :deep(.jexcel > tbody > tr > td.mml-workbook-grid__cell--readonly) {
  background: #fff8ea;
  color: var(--text-secondary);
}

.mml-workbook-grid__host :deep(.jexcel > thead > tr > td) {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.96));
  font-weight: 700;
}
</style>
