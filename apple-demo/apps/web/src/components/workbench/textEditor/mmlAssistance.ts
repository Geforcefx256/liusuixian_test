import type { MmlSchemaCommand, MmlSchemaParameter, MmlSchemaResponse } from '@/api/types'
import {
  buildCommandMap,
  parseCompositeFlagSetValue,
  parseMmlDocument,
  serializeCompositeFlagSetValue,
  validateStatementAgainstSchema
} from '../mmlSemantics'

export interface MmlCompletionItem {
  label: string
  kind: 'command' | 'param' | 'value' | 'action'
  insertText: string
  detail?: string
}

export interface MmlDiagnostic {
  commandHead: string
  message: string
  severity: 'warning' | 'error'
  start: number
  end: number
  paramName?: string
}

export interface CompositeEditTarget {
  commandName: string
  paramName: string
  label: string
  options: string[]
  enabledOptions: string[]
  valueStart: number
  valueEnd: number
}

interface ParameterRange {
  paramName: string
  paramStart: number
  paramEnd: number
  valueStart: number
  valueEnd: number
}

export function getMmlCompletionItems(
  schema: MmlSchemaResponse | null,
  content: string,
  offset: number
): MmlCompletionItem[] {
  if (!schema) {
    return []
  }

  const statements = parseMmlDocument(content).statements
  const commandMap = buildCommandMap(schema)
  const statement = statements.find(item => offset >= item.start && offset <= item.end)
  if (!statement) {
    return schema.commands
      .map(command => ({
        label: command.commandName,
        kind: 'command' as const,
        insertText: `${command.commandName}:`,
        detail: '命令'
      }))
      .sort(compareCompletionItems)
  }

  const statementText = content.slice(statement.start, offset)
  const colonIndex = statementText.indexOf(':')
  if (colonIndex < 0) {
    return schema.commands
      .map(command => ({
        label: command.commandName,
        kind: 'command' as const,
        insertText: `${command.commandName}:`,
        detail: '命令'
      }))
      .sort(compareCompletionItems)
  }

  const commandSchema = commandMap.get(statement.commandHead)
  if (!commandSchema) {
    return []
  }

  const localOffset = offset - statement.start
  const parameterRanges = locateParameterRanges(statement.text, statement.start)
  const activeRange = parameterRanges.find(range => localOffset >= range.paramStart - statement.start && localOffset <= range.valueEnd - statement.start)
  const beforeCursor = statement.text.slice(0, localOffset)

  if (/=\s*[^,;]*$/.test(beforeCursor) && activeRange) {
    const schemaParam = commandSchema.params.find(param => param.paramName === activeRange.paramName)
    return getValueCompletionItems(schemaParam)
  }

  const alreadyPresent = new Set(statement.params.map(param => param.paramName))
  return commandSchema.params
    .filter(param => !alreadyPresent.has(param.paramName) || activeRange?.paramName === param.paramName)
    .sort((left, right) => left.orderParamId - right.orderParamId)
    .map(param => ({
      label: param.paramName,
      kind: 'param' as const,
      insertText: `${param.paramName}=`,
      detail: param.label
    }))
}

export function buildMmlDiagnostics(schema: MmlSchemaResponse | null, content: string): MmlDiagnostic[] {
  if (!schema) {
    return []
  }

  const commandMap = buildCommandMap(schema)
  const parsed = parseMmlDocument(content)
  const diagnostics: MmlDiagnostic[] = []

  for (const statement of parsed.statements) {
    const commandSchema = commandMap.get(statement.commandHead) || null
    const ranges = locateParameterRanges(statement.text, statement.start)
    const rangeByParam = new Map(ranges.map(range => [range.paramName, range]))
    for (const issue of validateStatementAgainstSchema(statement, commandSchema)) {
      const range = issue.paramName ? rangeByParam.get(issue.paramName) : null
      diagnostics.push({
        commandHead: statement.commandHead,
        message: issue.message,
        severity: mapIssueSeverity(issue.code),
        start: range?.paramStart ?? statement.start,
        end: range?.valueEnd ?? statement.end,
        paramName: issue.paramName
      })
    }
  }

  return diagnostics
}

function mapIssueSeverity(_code: 'unknown_param' | 'duplicate_param' | 'invalid_enum' | 'invalid_integer' | 'invalid_composite' | 'missing_required'): 'error' {
  return 'error'
}

export function findCompositeEditTarget(
  schema: MmlSchemaResponse | null,
  content: string,
  offset: number
): CompositeEditTarget | null {
  if (!schema) {
    return null
  }

  const commandMap = buildCommandMap(schema)
  const statement = parseMmlDocument(content).statements.find(item => offset >= item.start && offset <= item.end)
  if (!statement) {
    return null
  }

  const commandSchema = commandMap.get(statement.commandHead)
  if (!commandSchema) {
    return null
  }

  for (const range of locateParameterRanges(statement.text, statement.start)) {
    if (offset < range.valueStart || offset > range.valueEnd) {
      continue
    }
    const schemaParam = commandSchema.params.find(param => param.paramName === range.paramName)
    if (!schemaParam || schemaParam.controlType !== 'composite') {
      return null
    }
    const rawValue = content.slice(range.valueStart, range.valueEnd)
    return {
      commandName: commandSchema.commandName,
      paramName: schemaParam.paramName,
      label: schemaParam.label,
      options: schemaParam.compositeFlagSetOptions || [],
      enabledOptions: parseCompositeFlagSetValue(
        schemaParam.compositeFlagSetOptions || [],
        stripQuotes(rawValue)
      ).enabledOptions,
      valueStart: range.valueStart,
      valueEnd: range.valueEnd
    }
  }

  return null
}

export function serializeCompositeEditResult(target: CompositeEditTarget, enabledOptions: string[]): string {
  return serializeCompositeFlagSetValue(target.options, enabledOptions)
}

export function getHoverSchemaParameter(
  schema: MmlSchemaResponse | null,
  content: string,
  offset: number
): MmlSchemaParameter | null {
  if (!schema) {
    return null
  }
  const commandMap = buildCommandMap(schema)
  const statement = parseMmlDocument(content).statements.find(item => offset >= item.start && offset <= item.end)
  if (!statement) {
    return null
  }
  const commandSchema = commandMap.get(statement.commandHead)
  if (!commandSchema) {
    return null
  }

  for (const range of locateParameterRanges(statement.text, statement.start)) {
    if (offset >= range.paramStart && offset <= range.valueEnd) {
      return commandSchema.params.find(param => param.paramName === range.paramName) || null
    }
  }
  return null
}

function getValueCompletionItems(schemaParam: MmlSchemaParameter | undefined): MmlCompletionItem[] {
  if (!schemaParam) {
    return []
  }

  if (schemaParam.controlType === 'select') {
    return schemaParam.enumValues.map(value => ({
      label: value,
      kind: 'value' as const,
      insertText: value,
      detail: '枚举值'
    }))
  }

  if (schemaParam.controlType === 'composite') {
    return [
      {
        label: 'Open structured editor',
        kind: 'action',
        insertText: '',
        detail: '打开位域模板编辑器'
      }
    ]
  }

  return []
}

function locateParameterRanges(statementText: string, statementStart: number): ParameterRange[] {
  const ranges: ParameterRange[] = []
  const colonIndex = findTopLevelCharacter(statementText, ':')
  const semicolonIndex = statementText.lastIndexOf(';')
  if (colonIndex < 0 || semicolonIndex <= colonIndex) {
    return ranges
  }

  const body = statementText.slice(colonIndex + 1, semicolonIndex)
  const chunks = splitTopLevel(body, ',')
  let bodyCursor = colonIndex + 1

  for (const chunk of chunks) {
    const rawChunk = chunk
    const leadingWhitespace = rawChunk.length - rawChunk.trimStart().length
    const trailingWhitespace = rawChunk.length - rawChunk.trimEnd().length
    const trimmedChunk = rawChunk.trim()
    const equalsIndex = findTopLevelCharacter(trimmedChunk, '=')
    if (equalsIndex > 0) {
      const paramName = trimmedChunk.slice(0, equalsIndex).trim().toUpperCase()
      const valueStart = bodyCursor + leadingWhitespace + equalsIndex + 1
      const valueEnd = bodyCursor + rawChunk.length - trailingWhitespace
      ranges.push({
        paramName,
        paramStart: bodyCursor + leadingWhitespace,
        paramEnd: bodyCursor + leadingWhitespace + equalsIndex,
        valueStart,
        valueEnd: Math.max(valueStart, valueEnd) + statementStart
      })
      const latest = ranges[ranges.length - 1]
      latest.paramStart += statementStart
      latest.paramEnd += statementStart
      latest.valueStart += statementStart
    }
    bodyCursor += rawChunk.length + 1
  }

  return ranges
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function splitTopLevel(value: string, separator: ',' | ':'): string[] {
  const parts: string[] = []
  let chunk = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      chunk += char
      if (char === '\\') {
        chunk += value[index + 1] || ''
        index += 1
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      chunk += char
      continue
    }

    if (char === separator) {
      parts.push(chunk)
      chunk = ''
      continue
    }

    chunk += char
  }

  parts.push(chunk)
  return parts
}

function findTopLevelCharacter(value: string, target: ':' | '='): number {
  let quote: '"' | "'" | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === target) return index
  }
  return -1
}

function compareCompletionItems(left: MmlCompletionItem, right: MmlCompletionItem): number {
  return left.label.localeCompare(right.label, 'en')
}
