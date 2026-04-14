import type { MmlSchemaCommand, MmlSchemaParameter, MmlSchemaResponse } from '@/api/types'

export interface MmlDocumentSegment {
  kind: 'raw' | 'statement'
  start: number
  end: number
  text: string
  statementId?: string
}

export interface ParsedMmlParameter {
  paramName: string
  rawValue: string
  displayValue: string
  tokenStyle: 'double_quoted' | 'single_quoted' | 'number' | 'bareword'
  originalIndex: number
}

export interface ParsedMmlStatement {
  id: string
  commandHead: string
  text: string
  start: number
  end: number
  parseStatus: 'ok' | 'invalid'
  parseIssues: string[]
  params: ParsedMmlParameter[]
  duplicateParams: string[]
  ambiguousCommentBinding: boolean
  leadingCommentText: string
  trailingCommentText: string
}

export interface CompositeFlagSetParseResult {
  enabledOptions: string[]
  invalidTokens: string[]
}

export interface ValidationIssue {
  code:
    | 'unknown_param'
    | 'duplicate_param'
    | 'invalid_enum'
    | 'invalid_integer'
    | 'invalid_composite'
    | 'missing_required'
  message: string
  paramName?: string
}

function resolveSchemaRequiredMode(schemaParam: MmlSchemaParameter): NonNullable<MmlSchemaParameter['requiredMode']> {
  if (schemaParam.requiredMode) {
    return schemaParam.requiredMode
  }
  return schemaParam.required ? 'required' : 'optional'
}

function matchesConditionalRequirement(
  statement: ParsedMmlStatement,
  commandSchema: MmlSchemaCommand,
  schemaParam: MmlSchemaParameter
): boolean {
  return (schemaParam.conditions || []).some(condition => {
    const referencedSchema = commandSchema.params.find(item => item.orderParamId === condition.sourceParamId)
    if (!referencedSchema) {
      return false
    }
    const referenced = statement.params.find(param => referencedSchema.paramName === param.paramName)
    if (!referenced) {
      return false
    }
    return schemaParam.caseSensitive === false
      ? referenced.displayValue.toLowerCase() === condition.expectedValue.toLowerCase()
      : referenced.displayValue === condition.expectedValue
  })
}

export function parseMmlDocument(content: string): {
  segments: MmlDocumentSegment[]
  statements: ParsedMmlStatement[]
} {
  const segments: MmlDocumentSegment[] = []
  const statements: ParsedMmlStatement[] = []
  let cursor = 0
  let statementIndex = 0

  while (cursor < content.length) {
    const rawStart = cursor
    cursor = consumeRaw(content, cursor)
    if (cursor > rawStart) {
      segments.push({
        kind: 'raw',
        start: rawStart,
        end: cursor,
        text: content.slice(rawStart, cursor)
      })
    }

    if (cursor >= content.length) break

    const statementStart = cursor
    cursor = consumeStatement(content, cursor)
    const statementText = content.slice(statementStart, cursor)
    const statementId = `statement-${statementIndex + 1}`
    const parsedStatement = parseStatement(statementId, statementText, statementStart, cursor)
    statements.push(parsedStatement)
    segments.push({
      kind: 'statement',
      start: statementStart,
      end: cursor,
      text: statementText,
      statementId
    })
    statementIndex += 1
  }

  applyCommentBinding(statements, segments)
  return { segments, statements }
}

export function buildCommandMap(schema: MmlSchemaResponse | null): Map<string, MmlSchemaCommand> {
  return new Map((schema?.commands || []).map(command => [command.commandName, command]))
}

export function findInsertIndex(
  params: ParsedMmlParameter[],
  schemaParams: MmlSchemaParameter[],
  schemaParam: MmlSchemaParameter
): number {
  const orderByName = new Map(schemaParams.map(param => [param.paramName, param.orderParamId]))
  const targetOrder = schemaParam.orderParamId
  const nextIndex = params.findIndex(param => (orderByName.get(param.paramName) || Number.MAX_SAFE_INTEGER) > targetOrder)
  return nextIndex >= 0 ? nextIndex : params.length
}

export function serializeStatement(commandHead: string, params: ParsedMmlParameter[]): string {
  const serializedParams = params.map(param => `${param.paramName}=${param.rawValue}`)
  const body = serializedParams.join(', ')
  return `${commandHead}:${body};`
}

export function serializeParamValue(
  schemaParam: MmlSchemaParameter,
  nextValue: string,
  existingParam: ParsedMmlParameter | null
): string {
  const style = existingParam?.tokenStyle || detectTokenStyleFromValue(schemaParam, nextValue)

  if (style === 'number') {
    return /^-?\d+(?:\.\d+)?$/.test(nextValue) ? nextValue : `"${escapeQuotedValue(nextValue)}"`
  }
  if (style === 'bareword') {
    return /^[A-Za-z0-9_.:/&-]+$/.test(nextValue) ? nextValue : `"${escapeQuotedValue(nextValue)}"`
  }
  if (style === 'single_quoted') {
    return `'${nextValue.replace(/'/g, "\\'")}'`
  }
  if (style === 'double_quoted') {
    return `"${escapeQuotedValue(nextValue)}"`
  }

  if (schemaParam.valueType === 'number' && /^-?\d+(?:\.\d+)?$/.test(nextValue)) {
    return nextValue
  }
  if ((schemaParam.valueType === 'enum' || schemaParam.valueType === 'token') && /^[A-Za-z0-9_.:/&-]+$/.test(nextValue)) {
    return nextValue
  }
  return `"${escapeQuotedValue(nextValue)}"`
}

export function detectTokenStyle(rawValue: string): ParsedMmlParameter['tokenStyle'] {
  if (/^".*"$/.test(rawValue)) return 'double_quoted'
  if (/^'.*'$/.test(rawValue)) return 'single_quoted'
  if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) return 'number'
  return 'bareword'
}

export function detectTokenStyleFromValue(
  schemaParam: MmlSchemaParameter,
  value: string
): ParsedMmlParameter['tokenStyle'] {
  if (schemaParam.valueType === 'number' && /^-?\d+(?:\.\d+)?$/.test(value)) return 'number'
  if ((schemaParam.valueType === 'enum' || schemaParam.valueType === 'token') && /^[A-Za-z0-9_.:/&-]+$/.test(value)) {
    return 'bareword'
  }
  return 'double_quoted'
}

export function toDisplayValue(rawValue: string): string {
  if (/^".*"$/.test(rawValue) || /^'.*'$/.test(rawValue)) {
    return rawValue.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'")
  }
  return rawValue
}

export function normalizeCommandHead(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase()
}

export function normalizeIdentifier(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase()
}

export function serializeCompositeFlagSetValue(options: string[], enabledOptions: string[]): string {
  const enabledSet = new Set(enabledOptions)
  return options
    .filter(option => enabledSet.has(option))
    .map(option => `${option}-1`)
    .join('&')
}

export function parseCompositeFlagSetValue(options: string[], value: string): CompositeFlagSetParseResult {
  const optionSet = new Set(options)
  const enabledOptions: string[] = []
  const invalidTokens: string[] = []
  const trimmed = value.trim()

  if (!trimmed) {
    return {
      enabledOptions,
      invalidTokens
    }
  }

  for (const token of trimmed.split('&').map(item => item.trim()).filter(Boolean)) {
    const match = token.match(/^(.*?)-([01])$/)
    if (!match) {
      invalidTokens.push(token)
      continue
    }
    const [, optionName, enabledFlag] = match
    if (!optionSet.has(optionName)) {
      invalidTokens.push(token)
      continue
    }
    if (enabledFlag === '1') {
      enabledOptions.push(optionName)
    }
  }

  return {
    enabledOptions,
    invalidTokens
  }
}

export function validateParameterValue(schemaParam: MmlSchemaParameter, nextValue: string): string | null {
  const trimmed = nextValue.trim()
  if (!trimmed) {
    return null
  }

  if (schemaParam.controlType === 'select' || schemaParam.valueType === 'enum') {
    const valid = schemaParam.caseSensitive === false
      ? schemaParam.enumValues.some(value => value.toLowerCase() === trimmed.toLowerCase())
      : schemaParam.enumValues.includes(trimmed)
    return valid ? null : `值必须在枚举范围内: ${schemaParam.enumValues.join(', ')}`
  }

  if (schemaParam.valueFormat === 'integer' || schemaParam.valueType === 'number') {
    if (!/^-?\d+$/.test(trimmed)) {
      return '值必须是整数'
    }
    const numericValue = Number.parseInt(trimmed, 10)
    const constraints = schemaParam.numberConstraints
    if (constraints?.minValue !== null && constraints?.minValue !== undefined && numericValue < constraints.minValue) {
      return `值不能小于 ${constraints.minValue}`
    }
    if (constraints?.maxValue !== null && constraints?.maxValue !== undefined && numericValue > constraints.maxValue) {
      return `值不能大于 ${constraints.maxValue}`
    }
  }

  if (schemaParam.controlType === 'composite' || schemaParam.valueFormat === 'composite_flag_set') {
    const parsed = parseCompositeFlagSetValue(schemaParam.compositeFlagSetOptions || [], trimmed)
    if (parsed.invalidTokens.length) {
      return `值包含未声明位域项: ${parsed.invalidTokens.join(', ')}`
    }
  }

  const length = trimmed.length
  const lengthConstraints = schemaParam.lengthConstraints
  const ignoreExactLength = schemaParam.valueFormat === 'string'
    || (schemaParam.valueFormat === undefined && schemaParam.valueType === 'string')
  if (!ignoreExactLength
    && lengthConstraints?.exactLength !== null
    && lengthConstraints?.exactLength !== undefined
    && length !== lengthConstraints.exactLength) {
    return `长度必须等于 ${lengthConstraints.exactLength}`
  }
  if (lengthConstraints?.minLength !== null && lengthConstraints?.minLength !== undefined && length < lengthConstraints.minLength) {
    return `长度不能小于 ${lengthConstraints.minLength}`
  }
  if (lengthConstraints?.maxLength !== null && lengthConstraints?.maxLength !== undefined && length > lengthConstraints.maxLength) {
    return `长度不能大于 ${lengthConstraints.maxLength}`
  }

  return null
}

export function validateStatementAgainstSchema(
  statement: ParsedMmlStatement,
  commandSchema: MmlSchemaCommand | null
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!commandSchema) {
    return issues
  }

  const paramsByName = new Map(commandSchema.params.map(param => [param.paramName, param]))
  const seenNames = new Set<string>()

  for (const param of statement.params) {
    const schemaParam = paramsByName.get(param.paramName)
    if (!schemaParam) {
      issues.push({
        code: 'unknown_param',
        paramName: param.paramName,
        message: `未知参数: ${param.paramName}`
      })
      continue
    }
    if (seenNames.has(param.paramName)) {
      issues.push({
        code: 'duplicate_param',
        paramName: param.paramName,
        message: `重复参数: ${param.paramName}`
      })
      continue
    }
    seenNames.add(param.paramName)

    const validationMessage = validateParameterValue(schemaParam, param.displayValue)
    if (!validationMessage) {
      continue
    }

    issues.push({
      code: schemaParam.controlType === 'composite' ? 'invalid_composite' : schemaParam.valueType === 'enum' ? 'invalid_enum' : 'invalid_integer',
      paramName: param.paramName,
      message: `${param.paramName}: ${validationMessage}`
    })
  }

  for (const schemaParam of commandSchema.params) {
    const requiredMode = resolveSchemaRequiredMode(schemaParam)
    if (requiredMode === 'required' && !seenNames.has(schemaParam.paramName)) {
      issues.push({
        code: 'missing_required',
        paramName: schemaParam.paramName,
        message: `缺少必选参数: ${schemaParam.paramName}`
      })
      continue
    }
    if (requiredMode === 'conditional_required' && !seenNames.has(schemaParam.paramName)) {
      if (matchesConditionalRequirement(statement, commandSchema, schemaParam)) {
        issues.push({
          code: 'missing_required',
          paramName: schemaParam.paramName,
          message: `缺少条件必选参数: ${schemaParam.paramName}`
        })
      }
    }
  }

  return issues
}

function consumeRaw(content: string, start: number): number {
  let cursor = start
  while (cursor < content.length) {
    if (content.startsWith('/*', cursor)) {
      const closeIndex = content.indexOf('*/', cursor + 2)
      cursor = closeIndex >= 0 ? closeIndex + 2 : content.length
      continue
    }
    if (content.startsWith('//', cursor)) {
      cursor = consumeToLineEnd(content, cursor)
      continue
    }
    if (content[cursor] === '#') {
      cursor = consumeToLineEnd(content, cursor)
      continue
    }
    if (/\s/.test(content[cursor])) {
      cursor += 1
      continue
    }
    break
  }
  return cursor
}

function consumeStatement(content: string, start: number): number {
  let cursor = start
  let quote: '"' | "'" | null = null

  while (cursor < content.length) {
    const char = content[cursor]
    if (quote) {
      if (char === '\\') {
        cursor += 2
        continue
      }
      if (char === quote) {
        quote = null
      }
      cursor += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      cursor += 1
      continue
    }

    if (char === ';') {
      return cursor + 1
    }
    cursor += 1
  }

  return cursor
}

function parseStatement(id: string, text: string, start: number, end: number): ParsedMmlStatement {
  const trimmed = text.trim()
  const parseIssues: string[] = []
  const colonIndex = findTopLevelCharacter(trimmed, ':')
  const semicolonIndex = trimmed.endsWith(';') ? trimmed.length - 1 : -1
  const commandHead = colonIndex > 0 ? normalizeCommandHead(trimmed.slice(0, colonIndex)) : trimmed.replace(/;$/, '')

  if (colonIndex < 0 || semicolonIndex < colonIndex) {
    return {
      id,
      commandHead: commandHead || 'UNPARSED',
      text,
      start,
      end,
      parseStatus: 'invalid',
      parseIssues: ['Statement does not contain a valid command head and body'],
      params: [],
      duplicateParams: [],
      ambiguousCommentBinding: false,
      leadingCommentText: '',
      trailingCommentText: ''
    }
  }

  const body = trimmed.slice(colonIndex + 1, semicolonIndex).trim()
  const params: ParsedMmlParameter[] = []
  const duplicateParams: string[] = []
  const seenNames = new Set<string>()

  if (body) {
    const chunks = splitTopLevel(body, ',')
    chunks.forEach((chunk, index) => {
      const normalizedChunk = chunk.trim()
      if (!normalizedChunk) return
      const equalsIndex = findTopLevelCharacter(normalizedChunk, '=')
      if (equalsIndex <= 0) {
        parseIssues.push(`Unsupported token: ${normalizedChunk}`)
        return
      }
      const paramName = normalizeIdentifier(normalizedChunk.slice(0, equalsIndex))
      const rawValue = normalizedChunk.slice(equalsIndex + 1).trim()
      if (!paramName || !rawValue) {
        parseIssues.push(`Unsupported token: ${normalizedChunk}`)
        return
      }

      if (seenNames.has(paramName)) {
        duplicateParams.push(paramName)
      }
      seenNames.add(paramName)

      params.push({
        paramName,
        rawValue,
        displayValue: toDisplayValue(rawValue),
        tokenStyle: detectTokenStyle(rawValue),
        originalIndex: index
      })
    })
  }

  return {
    id,
    commandHead: normalizeCommandHead(commandHead),
    text,
    start,
    end,
    parseStatus: parseIssues.length ? 'invalid' : 'ok',
    parseIssues,
    params,
    duplicateParams: [...new Set(duplicateParams)],
    ambiguousCommentBinding: false,
    leadingCommentText: '',
    trailingCommentText: ''
  }
}

function applyCommentBinding(statements: ParsedMmlStatement[], segments: MmlDocumentSegment[]): void {
  const statementById = new Map(statements.map(statement => [statement.id, statement]))

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment.kind !== 'raw') continue
    const previous = segments[index - 1]
    const next = segments[index + 1]
    const hasComment = /\/\*|\/\/|#/.test(segment.text)
    if (!hasComment) continue
    let remaining = segment.text

    if (previous?.kind === 'statement') {
      const trailingComment = extractLeadingTrailingComment(segment.text)
      if (trailingComment) {
        statementById.get(previous.statementId || '')!.trailingCommentText = trailingComment
        remaining = segment.text.slice(trailingComment.length)
      }
    }

    if (!/\/\*|\/\/|#/.test(remaining)) continue

    if (previous?.kind === 'statement' && next?.kind === 'statement' && !hasBlankLine(remaining) && !isInlineTrailingComment(remaining)) {
      statementById.get(previous.statementId || '')!.ambiguousCommentBinding = true
      statementById.get(next.statementId || '')!.ambiguousCommentBinding = true
      continue
    }

    if (next?.kind === 'statement') {
      statementById.get(next.statementId || '')!.leadingCommentText = remaining
    }
  }
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

function consumeToLineEnd(content: string, start: number): number {
  let cursor = start
  while (cursor < content.length && content[cursor] !== '\n' && content[cursor] !== '\r') {
    cursor += 1
  }
  while (cursor < content.length && (content[cursor] === '\n' || content[cursor] === '\r')) {
    cursor += 1
    if (content[cursor - 1] === '\r' && content[cursor] === '\n') {
      cursor += 1
    }
  }
  return cursor
}

function hasBlankLine(value: string): boolean {
  return /\r?\n[ \t]*\r?\n/.test(value)
}

function isInlineTrailingComment(value: string): boolean {
  return /^[ \t]*(?:\/\/[^\n\r]*|\/\*[\s\S]*?\*\/|#[^\n\r]*)(?:\r?\n)?$/.test(value)
}

function extractLeadingTrailingComment(value: string): string {
  const match = value.match(/^[ \t]*(?:\/\/[^\n\r]*|\/\*[\s\S]*?\*\/|#[^\n\r]*)(?:\r?\n)?/)
  return match?.[0] || ''
}

function escapeQuotedValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
