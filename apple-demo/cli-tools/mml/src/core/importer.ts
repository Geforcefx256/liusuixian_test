import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'

import * as XLSX from 'xlsx'

import type {
  MmlSchemaControlType,
  MmlSchemaLengthConstraints,
  MmlSchemaNumberConstraints,
  MmlSchemaRequiredMode,
  MmlSchemaValueFormat,
  MmlSchemaValueType
} from './contracts.js'
import { parseConditionRules } from './conditionParser.js'
import { parseWorkbookFileName } from './fileName.js'
import { MmlRuleStore } from './store.js'
import type { ImportedMmlCommand, ImportedMmlParameter, ImportedMmlRuleset, WorkbookImportOutcome } from './catalogTypes.js'

const CHECK_RULE_SHEET = 'CHECK_RULE'
const ARRAY_JSON_QUOTES = /[“”]/g
const ARRAY_JSON_COMMA = /，/g

interface RawExcelRuleRow {
  commandName: string
  orderParamId: number
  paramName: string
  rawType: string
  rawRequiredMode: string
  rawCondition: string
  rawEnumValues: string
  rawCompositeOptions: string
  rawDefaultValue: string
  rawMaxValue: string
  rawMinValue: string
  rawInterval: string
  rawMaxLength: string
  rawMinLength: string
  rawExactLength: string
  rawCaseSensitive: string
  source: Record<string, unknown>
}

export interface ImportDirectorySummary {
  scannedFiles: number
  imported: WorkbookImportOutcome[]
  skipped: WorkbookImportOutcome[]
}

export class MmlRuleImporter {
  constructor(private readonly store: MmlRuleStore) {}

  importDirectory(sourceDir: string): ImportDirectorySummary {
    const fileNames = readdirSync(sourceDir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name)

    const imported: WorkbookImportOutcome[] = []
    const skipped: WorkbookImportOutcome[] = []

    for (const fileName of fileNames) {
      if (!parseWorkbookFileName(fileName)) {
        continue
      }

      const outcome = this.importWorkbook(join(sourceDir, fileName))
      if (outcome.status === 'imported') {
        imported.push(outcome)
      } else {
        skipped.push(outcome)
      }
    }

    return {
      scannedFiles: fileNames.length,
      imported,
      skipped
    }
  }

  importWorkbook(filePath: string): WorkbookImportOutcome {
    const fileName = basename(filePath)
    const parsedFileName = parseWorkbookFileName(fileName)
    if (!parsedFileName) {
      throw new Error(`Unsupported MML rule workbook file name: ${fileName}`)
    }

    const fileBuffer = readFileSync(filePath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet = workbook.Sheets[CHECK_RULE_SHEET]
    if (!sheet) {
      throw new Error(`Workbook ${fileName} does not contain sheet ${CHECK_RULE_SHEET}`)
    }

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: ''
    })

    const normalizedRows = rows
      .map((row, index) => normalizeRow(row, index + 1))
      .filter((row): row is RawExcelRuleRow => row !== null)

    const ruleset: ImportedMmlRuleset = {
      networkType: parsedFileName.networkType,
      networkVersion: parsedFileName.networkVersion,
      fileName,
      filePath,
      checksum: createHash('sha256').update(fileBuffer).digest('hex'),
      commands: normalizeCommands(normalizedRows)
    }

    return this.store.replaceActiveRuleset(ruleset)
  }
}

function normalizeCommands(rows: RawExcelRuleRow[]): ImportedMmlCommand[] {
  const commands = new Map<string, Map<string, ImportedMmlParameter>>()

  for (const row of rows) {
    const params = commands.get(row.commandName) || new Map<string, ImportedMmlParameter>()
    const normalizedParameter = normalizeParameter(row)
    const existing = params.get(normalizedParameter.paramName)
    params.set(
      normalizedParameter.paramName,
      existing ? mergeParameters(existing, normalizedParameter) : normalizedParameter
    )
    commands.set(row.commandName, params)
  }

  return [...commands.entries()].map(([commandName, params]) => ({
    commandName,
    params: [...params.values()].sort(compareParameterOrder)
  }))
}

function normalizeParameter(row: RawExcelRuleRow): ImportedMmlParameter {
  const enumValues = parseStringArray(row.rawEnumValues)
  const compositeOptions = parseStringArray(row.rawCompositeOptions)
  const requiredMode = normalizeRequiredMode(row.rawRequiredMode, row.rawCondition)
  const valueFormat = normalizeValueFormat(row.rawType, enumValues, compositeOptions)
  const valueType = normalizeValueType(valueFormat, enumValues)
  const controlType = normalizeControlType(valueFormat, enumValues)

  return {
    paramName: row.paramName,
    label: row.paramName,
    orderParamId: row.orderParamId,
    valueType,
    valueFormat,
    controlType,
    required: requiredMode === 'required',
    requiredMode,
    enumValues,
    compositeFlagSetOptions: compositeOptions,
    defaultValue: normalizeOptionalString(row.rawDefaultValue),
    editable: true,
    conditions: parseConditionRules(row.rawCondition),
    numberConstraints: normalizeNumberConstraints(row),
    lengthConstraints: normalizeLengthConstraints(row),
    caseSensitive: normalizeCaseSensitive(row.rawCaseSensitive),
    source: {
      ...row.source,
      rawType: row.rawType,
      rawRequiredMode: row.rawRequiredMode
    }
  }
}

function mergeParameters(left: ImportedMmlParameter, right: ImportedMmlParameter): ImportedMmlParameter {
  const requiredMode = mergeRequiredModes(left.requiredMode, right.requiredMode)
  return {
    ...left,
    label: left.label || right.label,
    orderParamId: left.orderParamId || right.orderParamId,
    valueType: pickPreferred(left.valueType, right.valueType, 'string'),
    valueFormat: pickPreferred(left.valueFormat, right.valueFormat, 'string'),
    controlType: left.controlType === 'composite' || right.controlType === 'composite'
      ? 'composite'
      : left.controlType === 'select' || right.controlType === 'select'
        ? 'select'
        : 'text',
    required: requiredMode === 'required',
    requiredMode,
    enumValues: uniqueStrings([...left.enumValues, ...right.enumValues]),
    compositeFlagSetOptions: uniqueStrings([...left.compositeFlagSetOptions, ...right.compositeFlagSetOptions]),
    defaultValue: left.defaultValue || right.defaultValue,
    editable: left.editable && right.editable,
    conditions: uniqueConditions([...left.conditions, ...right.conditions]),
    numberConstraints: mergeNumberConstraints(left.numberConstraints, right.numberConstraints),
    lengthConstraints: mergeLengthConstraints(left.lengthConstraints, right.lengthConstraints),
    caseSensitive: left.caseSensitive && right.caseSensitive,
    source: {
      left: left.source,
      right: right.source
    }
  }
}

function compareParameterOrder(left: ImportedMmlParameter, right: ImportedMmlParameter): number {
  if (left.orderParamId !== right.orderParamId) {
    return left.orderParamId - right.orderParamId
  }
  return left.paramName.localeCompare(right.paramName, 'en')
}

function normalizeRow(row: Array<string | number | boolean | null>, rowNumber: number): RawExcelRuleRow | null {
  const commandName = normalizeIdentifier(row[0], true)
  const orderParamId = normalizeNumber(row[1])
  const paramName = normalizeIdentifier(row[2], true)
  if (commandName === '命令' || paramName === '参数') {
    return null
  }
  if (!commandName || !paramName) {
    return null
  }

  return {
    commandName,
    orderParamId,
    paramName,
    rawType: normalizeCellString(row[3]),
    rawRequiredMode: normalizeCellString(row[4]),
    rawCondition: normalizeCellString(row[5]),
    rawEnumValues: normalizeCellString(row[6]),
    rawCompositeOptions: normalizeCellString(row[7]),
    rawDefaultValue: normalizeCellString(row[8]),
    rawMaxValue: normalizeCellString(row[9]),
    rawMinValue: normalizeCellString(row[10]),
    rawInterval: normalizeCellString(row[11]),
    rawMaxLength: normalizeCellString(row[12]),
    rawMinLength: normalizeCellString(row[13]),
    rawExactLength: normalizeCellString(row[14]),
    rawCaseSensitive: normalizeCellString(row[16]),
    source: {
      rowNumber,
      cells: row
    }
  }
}

function normalizeRequiredMode(value: string, condition: string): MmlSchemaRequiredMode {
  if (value === '必选') return 'required'
  if (value === '可选') return 'optional'
  if (value === '条件必选') return condition ? 'conditional_required' : 'required'
  if (value === '条件可选') return condition ? 'conditional_optional' : 'optional'
  return condition ? 'conditional_optional' : 'optional'
}

function normalizeValueFormat(
  rawType: string,
  enumValues: string[],
  compositeOptions: string[]
): MmlSchemaValueFormat {
  if (enumValues.length) return 'enum'
  if (compositeOptions.length) return 'composite_flag_set'

  switch (rawType.trim()) {
    case 'IPV4':
      return 'ipv4'
    case 'IPV6':
      return 'ipv6'
    case '枚举':
      return 'enum'
    case '位域类型':
    case '复合类型':
      return 'composite_flag_set'
    case '整数':
      return 'integer'
    case '密码类型':
      return 'password'
    default:
      return 'string'
  }
}

function normalizeValueType(valueFormat: MmlSchemaValueFormat, enumValues: string[]): MmlSchemaValueType {
  if (enumValues.length || valueFormat === 'enum') return 'enum'
  if (valueFormat === 'integer') return 'number'
  if (valueFormat === 'composite_flag_set') return 'token'
  return 'string'
}

function normalizeControlType(valueFormat: MmlSchemaValueFormat, enumValues: string[]): MmlSchemaControlType {
  if (valueFormat === 'composite_flag_set') return 'composite'
  if (enumValues.length || valueFormat === 'enum') return 'select'
  return 'text'
}

function normalizeNumberConstraints(row: RawExcelRuleRow): MmlSchemaNumberConstraints | null {
  const minValue = normalizeNullableNumber(row.rawMinValue)
  const maxValue = normalizeNullableNumber(row.rawMaxValue)
  const interval = normalizeOptionalString(row.rawInterval)
  if (minValue === null && maxValue === null && !interval) {
    return null
  }
  return {
    minValue,
    maxValue,
    interval
  }
}

function normalizeLengthConstraints(row: RawExcelRuleRow): MmlSchemaLengthConstraints | null {
  const minLength = normalizeNullableNumber(row.rawMinLength)
  const maxLength = normalizeNullableNumber(row.rawMaxLength)
  const exactLength = row.rawType.trim() === '字符串'
    ? null
    : normalizeNullableNumber(row.rawExactLength)
  if (minLength === null && maxLength === null && exactLength === null) {
    return null
  }
  return {
    minLength,
    maxLength,
    exactLength
  }
}

function normalizeCaseSensitive(value: string): boolean {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  if (['否', 'n', 'no', 'false', '0', '不区分大小写'].includes(normalized)) {
    return false
  }
  return true
}

function parseStringArray(value: string): string[] {
  if (!value) {
    return []
  }

  const normalized = value
    .trim()
    .replace(ARRAY_JSON_QUOTES, '"')
    .replace(ARRAY_JSON_COMMA, ',')

  try {
    const parsed = JSON.parse(normalized) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return uniqueStrings(parsed.map(item => normalizeCellString(item)).filter(Boolean))
  } catch {
    return uniqueStrings(
      normalized
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map(item => item.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
    )
  }
}

function normalizeIdentifier(value: unknown, upperCase: boolean): string {
  const normalized = normalizeCellString(value).replace(/\s+/g, ' ').trim()
  return upperCase ? normalized.toUpperCase() : normalized
}

function normalizeCellString(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function normalizeNumber(value: unknown): number {
  const parsed = normalizeNullableNumber(value)
  return parsed === null ? 0 : parsed
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeCellString(value)
  return normalized ? normalized : null
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function uniqueConditions(values: ImportedMmlParameter['conditions']): ImportedMmlParameter['conditions'] {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = `${value.expression}:${value.requiredMode}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function mergeRequiredModes(left: MmlSchemaRequiredMode, right: MmlSchemaRequiredMode): MmlSchemaRequiredMode {
  const priority: Record<MmlSchemaRequiredMode, number> = {
    required: 4,
    conditional_required: 3,
    conditional_optional: 2,
    optional: 1
  }
  return priority[left] >= priority[right] ? left : right
}

function mergeNumberConstraints(
  left: ImportedMmlParameter['numberConstraints'],
  right: ImportedMmlParameter['numberConstraints']
): ImportedMmlParameter['numberConstraints'] {
  if (!left) return right
  if (!right) return left
  return {
    minValue: left.minValue ?? right.minValue,
    maxValue: left.maxValue ?? right.maxValue,
    interval: left.interval || right.interval
  }
}

function mergeLengthConstraints(
  left: ImportedMmlParameter['lengthConstraints'],
  right: ImportedMmlParameter['lengthConstraints']
): ImportedMmlParameter['lengthConstraints'] {
  if (!left) return right
  if (!right) return left
  return {
    minLength: left.minLength ?? right.minLength,
    maxLength: left.maxLength ?? right.maxLength,
    exactLength: left.exactLength ?? right.exactLength
  }
}

function pickPreferred<T extends string>(left: T, right: T, fallback: T): T {
  if (left !== fallback) return left
  if (right !== fallback) return right
  return left
}
