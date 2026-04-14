import type { MmlSchemaCommand, MmlSchemaParameter, MmlSchemaResponse } from '@/api/types'
import {
  buildCommandMap,
  detectTokenStyleFromValue,
  findInsertIndex,
  type MmlDocumentSegment,
  parseMmlDocument,
  type ParsedMmlParameter,
  type ParsedMmlStatement,
  parseCompositeFlagSetValue,
  serializeCompositeFlagSetValue,
  serializeParamValue,
  serializeStatement,
  validateParameterValue
} from './mmlSemantics'

export { parseMmlDocument } from './mmlSemantics'

export type MmlSchemaAvailability = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'

export interface MmlWorkbookColumn {
  key: string
  label: string
  controlType: 'text' | 'select' | 'composite'
  enumValues: string[]
  compositeFlagSetOptions: string[]
  editable: boolean
  known: boolean
  order: number
  valueType: MmlSchemaParameter['valueType']
  valueFormat?: MmlSchemaParameter['valueFormat']
  numberConstraints?: MmlSchemaParameter['numberConstraints']
  lengthConstraints?: MmlSchemaParameter['lengthConstraints']
  caseSensitive?: boolean
}

export interface MmlWorkbookRow {
  id: string
  statementId: string
  rowNumber: number
  commandHead: string
  values: Record<string, string>
  knownParameters: ParsedMmlParameter[]
  unknownParameters: ParsedMmlParameter[]
  readOnly: boolean
  readOnlyReasons: string[]
  parseStatus: ParsedMmlStatement['parseStatus']
  missingRequired: string[]
  missingConditionalRequired: string[]
}

export interface MmlWorkbookSheet {
  key: string
  commandHead: string
  rows: MmlWorkbookRow[]
  columns: MmlWorkbookColumn[]
  editableRowCount: number
  readOnlyRowCount: number
}

export interface MmlWorkbook {
  segments: MmlDocumentSegment[]
  statements: ParsedMmlStatement[]
  sheets: MmlWorkbookSheet[]
}

export interface MmlRangePasteResult {
  content: string
  blockedReason: string | null
  updatedRowCount: number
  insertedRowCount: number
  incompleteRows: MmlIncompleteRowState[]
}

export interface MmlSelectionRange {
  x1: number
  y1: number
  x2: number
  y2: number
}

export const DEFAULT_MML_GRID_SPARE_ROW_COUNT = 1000

export interface MmlPersistedGridRow {
  kind: 'persisted'
  id: string
  rowNumber: number
  values: Record<string, string>
  persistedRowId: string
  readOnly: boolean
  readOnlyReasons: string[]
  missingRequired: string[]
  missingConditionalRequired: string[]
}

export interface MmlSpareGridRow {
  kind: 'spare'
  id: string
  rowNumber: number
  values: Record<string, string>
}

export type MmlGridRow = MmlPersistedGridRow | MmlSpareGridRow

export interface MmlGridSheet {
  key: string
  commandHead: string
  rows: MmlGridRow[]
  columns: MmlWorkbookColumn[]
  editableRowCount: number
  readOnlyRowCount: number
  persistedRowCount: number
  spareRowCount: number
}

interface MmlNewRowPatch {
  rowNumber: number
  values: Record<string, string | null>
}

export interface MmlIncompleteRowState {
  rowNumber: number
  values: Record<string, string>
  invalidCells: Record<string, string>
  missingRequired: string[]
  missingConditionalRequired: string[]
}

export interface MmlNormalizedCellValueResult {
  value: string
  provided: boolean
  validationMessage: string | null
}

export function buildMmlWorkbook(
  content: string,
  schema: MmlSchemaResponse | null,
  schemaAvailability: MmlSchemaAvailability
): MmlWorkbook {
  const parsed = parseMmlDocument(content)
  const commandMap = buildCommandMap(schema)
  const rowsBySheet = new Map<string, MmlWorkbookRow[]>()

  for (const statement of parsed.statements) {
    const commandSchema = commandMap.get(statement.commandHead) || null
    const knownNames = new Set(commandSchema?.params.map(param => param.paramName) || [])
    const schemaReady = schemaAvailability === 'ready' && Boolean(commandSchema)
    const unknownParameters = schemaReady
      ? statement.params.filter(param => !knownNames.has(param.paramName))
      : []
    const knownParameters = schemaReady
      ? statement.params.filter(param => knownNames.has(param.paramName))
      : statement.params
    const values: Record<string, string> = {}

    for (const param of knownParameters) {
      values[param.paramName] = param.displayValue
    }
    if (unknownParameters.length) {
      values.__unknown__ = unknownParameters.map(param => `${param.paramName}=${param.rawValue}`).join(', ')
    }

    const readOnlyReasons = buildReadOnlyReasons({
      statement,
      unknownParameters,
      hasSchema: Boolean(commandSchema),
      schemaAvailability
    })
    const { missingRequired, missingConditionalRequired } = schemaReady && commandSchema
      ? computeMissingRequired(values, commandSchema)
      : { missingRequired: [] as string[], missingConditionalRequired: [] as string[] }
    const row: MmlWorkbookRow = {
      id: statement.id,
      statementId: statement.id,
      rowNumber: (rowsBySheet.get(statement.commandHead)?.length || 0) + 1,
      commandHead: statement.commandHead,
      values,
      knownParameters,
      unknownParameters,
      readOnly: readOnlyReasons.length > 0,
      readOnlyReasons,
      parseStatus: statement.parseStatus,
      missingRequired,
      missingConditionalRequired
    }

    const rows = rowsBySheet.get(statement.commandHead) || []
    rows.push(row)
    rowsBySheet.set(statement.commandHead, rows)
  }

  const sheets = [...rowsBySheet.entries()].map(([commandHead, rows]) => {
    const commandSchema = commandMap.get(commandHead) || null
    const columns = buildSheetColumns(rows, commandSchema, schemaAvailability)
    return {
      key: commandHead,
      commandHead,
      rows,
      columns,
      editableRowCount: rows.filter(row => !row.readOnly).length,
      readOnlyRowCount: rows.filter(row => row.readOnly).length
    }
  })

  return {
    segments: parsed.segments,
    statements: parsed.statements,
    sheets
  }
}

export function buildMmlGridSheet(
  sheet: MmlWorkbookSheet,
  options: {
    spareRowCount?: number
  } = {}
): MmlGridSheet {
  const spareRowCount = Math.max(0, options.spareRowCount ?? DEFAULT_MML_GRID_SPARE_ROW_COUNT)
  const persistedRows: MmlPersistedGridRow[] = sheet.rows.map(row => ({
    kind: 'persisted',
    id: row.id,
    rowNumber: row.rowNumber,
    values: row.values,
    persistedRowId: row.id,
    readOnly: row.readOnly,
    readOnlyReasons: row.readOnlyReasons,
    missingRequired: row.missingRequired,
    missingConditionalRequired: row.missingConditionalRequired
  }))
  const spareRows: MmlSpareGridRow[] = Array.from({ length: spareRowCount }, (_value, index) => ({
    kind: 'spare',
    id: `spare-${sheet.key}-${index + 1}`,
    rowNumber: sheet.rows.length + index + 1,
    values: {}
  }))

  return {
    key: sheet.key,
    commandHead: sheet.commandHead,
    rows: [...persistedRows, ...spareRows],
    columns: sheet.columns,
    editableRowCount: sheet.editableRowCount,
    readOnlyRowCount: sheet.readOnlyRowCount,
    persistedRowCount: sheet.rows.length,
    spareRowCount
  }
}

export function isPersistedMmlGridRow(row: MmlGridRow): row is MmlPersistedGridRow {
  return row.kind === 'persisted'
}

export function applyMmlCellEdit(params: {
  content: string
  workbook: MmlWorkbook
  sheetKey: string
  rowId: string
  columnKey: string
  nextValue: string
  schema: MmlSchemaResponse | null
}): string {
  const { content, workbook, sheetKey, rowId, columnKey, nextValue, schema } = params
  const sheet = workbook.sheets.find(item => item.key === sheetKey)
  const row = sheet?.rows.find(item => item.id === rowId)
  const statement = workbook.statements.find(item => item.id === rowId)
  const commandSchema = schema?.commands.find(command => command.commandName === sheetKey) || null
  const schemaParam = commandSchema?.params.find(param => param.paramName === columnKey) || null

  if (!sheet || !row || !statement || !commandSchema || !schemaParam || row.readOnly) {
    return content
  }

  const existingParams = [...statement.params]
  const existingIndex = existingParams.findIndex(param => param.paramName === columnKey)
  const normalizedResult = normalizeSchemaParamValue(schemaParam, nextValue)

  if (normalizedResult.validationMessage) {
    return content
  }

  if (!normalizedResult.provided) {
    if (existingIndex >= 0) {
      existingParams.splice(existingIndex, 1)
    }
  } else {
    const serializedDisplayValue = normalizedResult.value
    const serializedParam: ParsedMmlParameter = {
      paramName: columnKey,
      rawValue: serializeParamValue(
        schemaParam,
        serializedDisplayValue,
        existingIndex >= 0 ? existingParams[existingIndex] : null
      ),
      displayValue: serializedDisplayValue,
      tokenStyle: existingIndex >= 0 ? existingParams[existingIndex].tokenStyle : detectTokenStyleFromValue(schemaParam, serializedDisplayValue),
      originalIndex: existingIndex >= 0 ? existingParams[existingIndex].originalIndex : existingParams.length
    }

    if (existingIndex >= 0) {
      existingParams.splice(existingIndex, 1, serializedParam)
    } else {
      const insertAt = findInsertIndex(existingParams, commandSchema.params, schemaParam)
      existingParams.splice(insertAt, 0, serializedParam)
    }
  }

  const nextStatement = serializeStatement(statement.commandHead, existingParams)
  return `${content.slice(0, statement.start)}${nextStatement}${content.slice(statement.end)}`
}

export function isEditableMmlCell(row: MmlWorkbookRow, column: MmlWorkbookColumn): boolean {
  return !row.readOnly && column.known && column.editable
}

export function validateMmlWorkbookCell(column: MmlWorkbookColumn, nextValue: string): string | null {
  return normalizeMmlWorkbookCellValue(column, nextValue).validationMessage
}

export function normalizeMmlWorkbookCellValue(column: MmlWorkbookColumn, nextValue: string): MmlNormalizedCellValueResult {
  return normalizeSchemaParamValue(buildSchemaParamForColumn(column), nextValue)
}

export function applyMmlRangePaste(params: {
  content: string
  workbook: MmlWorkbook
  gridSheet?: MmlGridSheet | null
  sheetKey: string
  startColumnIndex: number
  startRowIndex: number
  values: string[][]
  schema: MmlSchemaResponse | null
  existingIncompleteRows?: MmlIncompleteRowState[]
}): MmlRangePasteResult {
  const {
    content,
    workbook,
    sheetKey,
    startColumnIndex,
    startRowIndex,
    values,
    schema,
    gridSheet,
    existingIncompleteRows = []
  } = params
  const sheet = workbook.sheets.find(item => item.key === sheetKey)
  if (!sheet) {
    return {
      content,
      blockedReason: '当前命令页不存在，无法粘贴。',
      updatedRowCount: 0,
      insertedRowCount: 0,
      incompleteRows: existingIncompleteRows
    }
  }
  if (!schema) {
    return {
      content,
      blockedReason: '当前版本暂不支持表格粘贴。',
      updatedRowCount: 0,
      insertedRowCount: 0,
      incompleteRows: existingIncompleteRows
    }
  }
  const activeGridSheet = gridSheet || buildMmlGridSheet(sheet)

  const sanitizedValues = values
    .map(row => row.map(cell => cell ?? ''))
    .filter(row => row.length > 0)
  if (!sanitizedValues.length) {
    return {
      content,
      blockedReason: null,
      updatedRowCount: 0,
      insertedRowCount: 0,
      incompleteRows: existingIncompleteRows
    }
  }

  const updates: Array<{ rowId: string; columnKey: string; nextValue: string }> = []
  const updatedRowIds = new Set<string>()
  const newRowPatches = new Map<number, MmlNewRowPatch>()

  for (let rowOffset = 0; rowOffset < sanitizedValues.length; rowOffset += 1) {
    const gridRow = activeGridSheet.rows[startRowIndex + rowOffset]
      if (!gridRow) {
        return {
          content,
          blockedReason: '粘贴区域超出当前命令页范围。',
          updatedRowCount: 0,
          insertedRowCount: 0,
          incompleteRows: existingIncompleteRows
        }
      }

    for (let columnOffset = 0; columnOffset < sanitizedValues[rowOffset].length; columnOffset += 1) {
      const column = sheet.columns[startColumnIndex + columnOffset]
      if (!column) {
        return {
          content,
          blockedReason: '粘贴区域超出当前命令页范围。',
          updatedRowCount: 0,
          insertedRowCount: 0,
          incompleteRows: existingIncompleteRows
        }
      }
      const normalizedResult = normalizeMmlWorkbookCellValue(column, sanitizedValues[rowOffset][columnOffset])
      if (normalizedResult.validationMessage) {
        return {
          content,
          blockedReason: `R${gridRow.rowNumber} ${column.label} · ${normalizedResult.validationMessage}`,
          updatedRowCount: 0,
          insertedRowCount: 0,
          incompleteRows: existingIncompleteRows
        }
      }

      if (isPersistedMmlGridRow(gridRow)) {
        const row = sheet.rows.find(item => item.id === gridRow.persistedRowId)
        if (!row || !isEditableMmlCell(row, column)) {
          return {
            content,
            blockedReason: row
              ? describeBlockedMmlCell(row, column)
              : `R${gridRow.rowNumber} ${column.label} · 当前单元格不可编辑`,
            updatedRowCount: 0,
            insertedRowCount: 0,
            incompleteRows: existingIncompleteRows
          }
        }
        updates.push({
          rowId: row.id,
          columnKey: column.key,
          nextValue: normalizedResult.value
        })
        updatedRowIds.add(row.id)
        continue
      }

      if (!column.known || !column.editable) {
        return {
          content,
          blockedReason: `R${gridRow.rowNumber} ${column.label} · 当前单元格不支持表格新增`,
          updatedRowCount: 0,
          insertedRowCount: 0,
          incompleteRows: existingIncompleteRows
        }
      }
      const patch = newRowPatches.get(gridRow.rowNumber) || {
        rowNumber: gridRow.rowNumber,
        values: {}
      }
      patch.values[column.key] = normalizedResult.provided ? normalizedResult.value : null
      newRowPatches.set(gridRow.rowNumber, patch)
    }
  }

  let nextContent = content
  let nextWorkbook = workbook
  for (const update of updates) {
    nextContent = applyMmlCellEdit({
      content: nextContent,
      workbook: nextWorkbook,
      sheetKey,
      rowId: update.rowId,
      columnKey: update.columnKey,
      nextValue: update.nextValue,
      schema
    })
    nextWorkbook = buildMmlWorkbook(nextContent, schema, 'ready')
  }

  const incompleteRowMap = new Map<number, MmlIncompleteRowState>(
    existingIncompleteRows.map(row => [row.rowNumber, cloneIncompleteRowState(row)])
  )
  const statementsToAppend: Array<{ rowNumber: number; statementText: string }> = []

  for (const patch of [...newRowPatches.values()].sort((left, right) => left.rowNumber - right.rowNumber)) {
    const baseValues = { ...(incompleteRowMap.get(patch.rowNumber)?.values || {}) }
    for (const [columnKey, nextValue] of Object.entries(patch.values)) {
      if (nextValue) {
        baseValues[columnKey] = nextValue
      } else {
        delete baseValues[columnKey]
      }
    }

    const materialized = materializeMmlDraftRow({
      sheetKey,
      values: baseValues,
      rowNumber: patch.rowNumber,
      schema
    })
    if (materialized.blockedReason) {
      return {
        content,
        blockedReason: materialized.blockedReason,
        updatedRowCount: 0,
        insertedRowCount: 0,
        incompleteRows: existingIncompleteRows
      }
    }
    if (materialized.statementText) {
      incompleteRowMap.delete(patch.rowNumber)
      statementsToAppend.push({
        rowNumber: patch.rowNumber,
        statementText: materialized.statementText
      })
      continue
    }
    if (!Object.keys(materialized.values).length) {
      incompleteRowMap.delete(patch.rowNumber)
      continue
    }
    incompleteRowMap.set(patch.rowNumber, {
      rowNumber: patch.rowNumber,
      values: materialized.values,
      invalidCells: materialized.invalidCells,
      missingRequired: materialized.missingRequired,
      missingConditionalRequired: materialized.missingConditionalRequired
    })
  }

  if (statementsToAppend.length > 0) {
    const appended = appendMmlStatementsToSheet({
      content: nextContent,
      workbook: nextWorkbook,
      sheetKey,
      statements: statementsToAppend.map(item => item.statementText)
    })
    if (appended.blockedReason) {
      return {
        content,
        blockedReason: appended.blockedReason,
        updatedRowCount: 0,
        insertedRowCount: 0,
        incompleteRows: existingIncompleteRows
      }
    }
    nextContent = appended.content
  }

  const shiftedIncompleteRows = [...incompleteRowMap.values()]
    .map(row => ({
      ...row,
      rowNumber: row.rowNumber + statementsToAppend.length
    }))
    .sort((left, right) => left.rowNumber - right.rowNumber)

  return {
    content: nextContent,
    blockedReason: null,
    updatedRowCount: updatedRowIds.size,
    insertedRowCount: statementsToAppend.length,
    incompleteRows: shiftedIncompleteRows
  }
}

export function materializeMmlDraftRow(params: {
  sheetKey: string
  values: Record<string, string>
  rowNumber: number
  schema: MmlSchemaResponse | null
}): {
  statementText: string | null
  blockedReason: string | null
  values: Record<string, string>
  invalidCells: Record<string, string>
  missingRequired: string[]
  missingConditionalRequired: string[]
} {
  const { sheetKey, values, rowNumber, schema } = params
  const commandSchema = schema?.commands.find(command => command.commandName === sheetKey) || null
  if (!commandSchema) {
    return {
      statementText: null,
      blockedReason: '当前命令暂不支持表格新增。',
      values: {},
      invalidCells: {},
      missingRequired: [],
      missingConditionalRequired: []
    }
  }
  if (!Object.keys(values).length) {
    return {
      statementText: null,
      blockedReason: null,
      values: {},
      invalidCells: {},
      missingRequired: [],
      missingConditionalRequired: []
    }
  }

  const finalValues: Record<string, string> = {}
  const invalidCells: Record<string, string> = {}

  for (const schemaParam of commandSchema.params) {
    const value = values[schemaParam.paramName] || ''
    if (!value) continue
    const normalizedValue = normalizeSchemaParamValue(schemaParam, value)
    if (normalizedValue.validationMessage) {
      invalidCells[schemaParam.paramName] = normalizedValue.validationMessage
      continue
    }
    finalValues[schemaParam.paramName] = normalizedValue.value
  }

  const missingRequired: string[] = []
  const missingConditionalRequired: string[] = []
  for (const schemaParam of commandSchema.params) {
    const value = finalValues[schemaParam.paramName] || ''
    const requiredMode = resolveRequiredMode(schemaParam)
    if (!value && requiredMode === 'required') {
      missingRequired.push(schemaParam.paramName)
      continue
    }
    if (!value && requiredMode === 'conditional_required' && matchesConditionalRequirement(finalValues, commandSchema, schemaParam)) {
      missingConditionalRequired.push(schemaParam.paramName)
    }
  }

  const firstInvalidEntry = Object.entries(invalidCells)[0]
  if (firstInvalidEntry) {
    const schemaParam = commandSchema.params.find(item => item.paramName === firstInvalidEntry[0])
    return {
      statementText: null,
      blockedReason: `R${rowNumber} ${schemaParam?.label || firstInvalidEntry[0]} · ${firstInvalidEntry[1]}`,
      values: finalValues,
      invalidCells,
      missingRequired,
      missingConditionalRequired
    }
  }
  if (missingRequired.length > 0 || missingConditionalRequired.length > 0) {
    return {
      statementText: null,
      blockedReason: null,
      values: finalValues,
      invalidCells,
      missingRequired,
      missingConditionalRequired
    }
  }

  const paramsToSerialize: ParsedMmlParameter[] = []
  for (const schemaParam of commandSchema.params) {
    const value = finalValues[schemaParam.paramName]
    if (!value) continue
    paramsToSerialize.push({
      paramName: schemaParam.paramName,
      rawValue: serializeParamValue(schemaParam, value, null),
      displayValue: value,
      tokenStyle: detectTokenStyleFromValue(schemaParam, value),
      originalIndex: paramsToSerialize.length
    })
  }

  return {
    statementText: serializeStatement(sheetKey, paramsToSerialize),
    blockedReason: null,
    values: finalValues,
    invalidCells,
    missingRequired,
    missingConditionalRequired
  }
}

export function appendMmlStatementsToSheet(params: {
  content: string
  workbook: MmlWorkbook
  sheetKey: string
  statements: string[]
}): {
  content: string
  blockedReason: string | null
} {
  const { content, workbook, sheetKey, statements } = params
  if (!statements.length) {
    return {
      content,
      blockedReason: null
    }
  }

  const lastMatchingStatement = [...workbook.statements].reverse().find(statement => statement.commandHead === sheetKey)
  if (!lastMatchingStatement) {
    return {
      content,
      blockedReason: '当前命令页缺少可追加的语句块，暂不支持直接新增。'
    }
  }

  const insertionText = `\n${statements.join('\n')}`
  return {
    content: `${content.slice(0, lastMatchingStatement.end)}${insertionText}${content.slice(lastMatchingStatement.end)}`,
    blockedReason: null
  }
}

function cloneIncompleteRowState(row: MmlIncompleteRowState): MmlIncompleteRowState {
  return {
    rowNumber: row.rowNumber,
    values: { ...row.values },
    invalidCells: { ...row.invalidCells },
    missingRequired: [...row.missingRequired],
    missingConditionalRequired: [...row.missingConditionalRequired]
  }
}

function buildReadOnlyReasons(params: {
  statement: ParsedMmlStatement
  unknownParameters: ParsedMmlParameter[]
  hasSchema: boolean
  schemaAvailability: MmlSchemaAvailability
}): string[] {
  const reasons: string[] = []
  const { statement, unknownParameters, hasSchema, schemaAvailability } = params

  if (schemaAvailability === 'loading') reasons.push('正在准备表格视图')
  if (schemaAvailability === 'error') reasons.push('当前版本暂不支持表格解析')
  if (schemaAvailability === 'unavailable') reasons.push('当前版本暂不支持表格解析')
  if (schemaAvailability === 'ready' && !hasSchema) reasons.push('当前命令暂不支持表格解析')
  if (statement.parseStatus !== 'ok') reasons.push('语句解析失败')
  if (statement.parseIssues.length) reasons.push('语句包含暂不支持的语法')
  if (statement.duplicateParams.length) reasons.push(`重复参数: ${statement.duplicateParams.join(', ')}`)
  if (unknownParameters.length) reasons.push(`未识别参数: ${unknownParameters.map(param => param.paramName).join(', ')}`)
  if (statement.ambiguousCommentBinding) reasons.push('注释绑定不明确')

  return reasons
}

function describeBlockedMmlCell(row: MmlWorkbookRow, column: MmlWorkbookColumn): string {
  if (row.readOnly) {
    return `R${row.rowNumber} ${column.label} · ${row.readOnlyReasons.join(' · ')}`
  }
  if (!column.known || !column.editable) {
    return `R${row.rowNumber} ${column.label} · 当前单元格不支持表格编辑`
  }
  return `R${row.rowNumber} ${column.label} · 当前单元格不可编辑`
}

function buildSheetColumns(
  rows: MmlWorkbookRow[],
  commandSchema: MmlSchemaCommand | null,
  schemaAvailability: MmlSchemaAvailability
): MmlWorkbookColumn[] {
  if (commandSchema && schemaAvailability === 'ready') {
    const columns = commandSchema.params.map(param => ({
      key: param.paramName,
      label: param.label,
      controlType: param.controlType,
      enumValues: param.enumValues,
      compositeFlagSetOptions: param.compositeFlagSetOptions || [],
      editable: param.editable,
      known: true,
      order: param.orderParamId,
      valueType: param.valueType,
      valueFormat: param.valueFormat,
      numberConstraints: param.numberConstraints,
      lengthConstraints: param.lengthConstraints,
      caseSensitive: param.caseSensitive
    }))
    if (rows.some(row => row.unknownParameters.length > 0)) {
      columns.push({
        key: '__unknown__',
        label: '未知参数',
        controlType: 'text',
        enumValues: [],
        compositeFlagSetOptions: [],
        editable: false,
        known: false,
        order: Number.MAX_SAFE_INTEGER,
        valueType: 'string',
        valueFormat: undefined,
        numberConstraints: undefined,
        lengthConstraints: undefined,
        caseSensitive: undefined
      })
    }
    return columns
  }

  const dynamicColumns = new Map<string, MmlWorkbookColumn>()
  for (const row of rows) {
    for (const param of row.knownParameters) {
      if (!dynamicColumns.has(param.paramName)) {
        dynamicColumns.set(param.paramName, {
          key: param.paramName,
          label: param.paramName,
          controlType: 'text',
          enumValues: [],
          compositeFlagSetOptions: [],
          editable: false,
          known: false,
          order: dynamicColumns.size + 1,
          valueType: 'string',
          valueFormat: undefined,
          numberConstraints: undefined,
          lengthConstraints: undefined,
          caseSensitive: undefined
        })
      }
    }
    if (row.unknownParameters.length && !dynamicColumns.has('__unknown__')) {
      dynamicColumns.set('__unknown__', {
        key: '__unknown__',
        label: '未知参数',
        controlType: 'text',
        enumValues: [],
        compositeFlagSetOptions: [],
        editable: false,
        known: false,
        order: Number.MAX_SAFE_INTEGER,
        valueType: 'string',
        valueFormat: undefined,
        numberConstraints: undefined,
        lengthConstraints: undefined,
        caseSensitive: undefined
      })
    }
  }
  return [...dynamicColumns.values()]
}

function buildSchemaParamForColumn(column: MmlWorkbookColumn): MmlSchemaParameter {
  return {
    paramName: column.key,
    label: column.label,
    valueType: column.valueType,
    controlType: column.controlType,
    required: false,
    orderParamId: column.order,
    enumValues: column.enumValues,
    defaultValue: null,
    editable: column.editable,
    valueFormat: column.valueFormat,
    compositeFlagSetOptions: column.compositeFlagSetOptions,
    numberConstraints: column.numberConstraints,
    lengthConstraints: column.lengthConstraints,
    caseSensitive: column.caseSensitive
  }
}

function normalizeSchemaParamValue(schemaParam: MmlSchemaParameter, nextValue: string): MmlNormalizedCellValueResult {
  const trimmed = nextValue.trim()
  if (!trimmed) {
    return {
      value: '',
      provided: false,
      validationMessage: null
    }
  }

  let normalizedValue = trimmed
  if ((schemaParam.controlType === 'select' || schemaParam.valueType === 'enum') && schemaParam.caseSensitive === false) {
    const matched = schemaParam.enumValues.find(value => value.toLowerCase() === trimmed.toLowerCase())
    if (matched) {
      normalizedValue = matched
    }
  }
  if (schemaParam.controlType === 'composite' || schemaParam.valueFormat === 'composite_flag_set') {
    const parsed = parseCompositeFlagSetValue(schemaParam.compositeFlagSetOptions || [], trimmed)
    if (parsed.invalidTokens.length) {
      return {
        value: trimmed,
        provided: true,
        validationMessage: `值包含未声明位域项: ${parsed.invalidTokens.join(', ')}`
      }
    }
    normalizedValue = serializeCompositeFlagSetValue(schemaParam.compositeFlagSetOptions || [], parsed.enabledOptions)
  }

  return {
    value: normalizedValue,
    provided: true,
    validationMessage: validateParameterValue(schemaParam, normalizedValue)
  }
}

function resolveRequiredMode(schemaParam: MmlSchemaParameter): NonNullable<MmlSchemaParameter['requiredMode']> {
  if (schemaParam.requiredMode) return schemaParam.requiredMode
  return schemaParam.required ? 'required' : 'optional'
}

function matchesConditionalRequirement(
  values: Record<string, string>,
  commandSchema: MmlSchemaCommand,
  schemaParam: MmlSchemaParameter
): boolean {
  return (schemaParam.conditions || []).some(condition => {
    const referencedSchema = commandSchema.params.find(item => item.orderParamId === condition.sourceParamId)
    if (!referencedSchema) {
      return false
    }
    const referencedValue = values[referencedSchema.paramName]
    if (!referencedValue) {
      return false
    }
    return schemaParam.caseSensitive === false
      ? referencedValue.toLowerCase() === condition.expectedValue.toLowerCase()
      : referencedValue === condition.expectedValue
  })
}

function computeMissingRequired(
  values: Record<string, string>,
  commandSchema: MmlSchemaCommand
): { missingRequired: string[]; missingConditionalRequired: string[] } {
  const missingRequired: string[] = []
  const missingConditionalRequired: string[] = []
  for (const schemaParam of commandSchema.params) {
    const value = values[schemaParam.paramName] || ''
    const requiredMode = resolveRequiredMode(schemaParam)
    if (!value && requiredMode === 'required') {
      missingRequired.push(schemaParam.paramName)
      continue
    }
    if (!value && requiredMode === 'conditional_required' && matchesConditionalRequirement(values, commandSchema, schemaParam)) {
      missingConditionalRequired.push(schemaParam.paramName)
    }
  }
  return { missingRequired, missingConditionalRequired }
}

export interface MmlPasteTargetRange {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function normalizePasteMatrix(
  values: string[][],
  targetRange: MmlPasteTargetRange | null
): { values: string[][]; blockedReason: string | null } {
  if (!targetRange) {
    return { values, blockedReason: null }
  }

  const srcRows = values.length
  const srcCols = values[0]?.length || 0
  const tgtRows = targetRange.y2 - targetRange.y1 + 1
  const tgtCols = targetRange.x2 - targetRange.x1 + 1

  if (srcRows === tgtRows && srcCols === tgtCols) {
    return { values, blockedReason: null }
  }

  if (srcRows === 1 && srcCols === 1) {
    const singleValue = values[0][0]
    const expanded = Array.from({ length: tgtRows }, () =>
      Array.from({ length: tgtCols }, () => singleValue)
    )
    return { values: expanded, blockedReason: null }
  }

  if (tgtRows % srcRows === 0 && tgtCols % srcCols === 0) {
    const tiled: string[][] = []
    for (let r = 0; r < tgtRows; r += 1) {
      const row: string[] = []
      for (let c = 0; c < tgtCols; c += 1) {
        row.push(values[r % srcRows][c % srcCols])
      }
      tiled.push(row)
    }
    return { values: tiled, blockedReason: null }
  }

  return {
    values,
    blockedReason: `粘贴区域（${tgtRows}×${tgtCols}）与剪贴板内容（${srcRows}×${srcCols}）尺寸不兼容，无法自动填充。`
  }
}
