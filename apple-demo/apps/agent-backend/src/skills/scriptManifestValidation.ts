import {
  createScriptManifestIssue,
  type ScriptManifestIssue,
  type ScriptTemplateArgvItem
} from './scriptManifestTypes.js'

const VALID_PATH_BASES = new Set([
  'workspaceRoot',
  'uploadDir',
  'projectDir',
  'tempDir',
  'runtimeRoot'
])
const VALID_ARGV_KINDS = new Set(['option', 'flag', 'payload'])
const VALID_PAYLOAD_ENCODINGS = new Set(['json', 'base64-json'])

export function validateInputSchema(
  candidate: unknown,
  field: string
): { value?: Record<string, unknown>; issues: ScriptManifestIssue[] } {
  if (!isRecord(candidate)) {
    return { issues: [createScriptManifestIssue(field, `${field} must be a schema object.`)] }
  }
  const issues = validateSchemaNode(candidate, field, true)
  return issues.length > 0 ? { issues } : { value: candidate, issues: [] }
}

export function validateArgv(
  candidate: unknown,
  field: string,
  inputSchema: { value?: Record<string, unknown> }
): { value?: ScriptTemplateArgvItem[]; issues: ScriptManifestIssue[] } {
  if (!Array.isArray(candidate) || candidate.length === 0) {
    return { issues: [createScriptManifestIssue(field, `${field} must be a non-empty array.`)] }
  }
  const issues: ScriptManifestIssue[] = []
  const items: ScriptTemplateArgvItem[] = []
  const schemaProperties = isRecord(inputSchema.value?.properties)
    ? inputSchema.value.properties
    : {}

  for (let index = 0; index < candidate.length; index += 1) {
    const itemField = `${field}[${index}]`
    const parsed = validateArgvItem(candidate[index], itemField, schemaProperties)
    items.push(...parsed.items)
    issues.push(...parsed.issues)
  }

  return issues.length > 0 ? { issues } : { value: items, issues: [] }
}

export function requireNonEmptyString(
  candidate: unknown,
  field: string
): { value?: string; issues: ScriptManifestIssue[] } {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return { issues: [createScriptManifestIssue(field, `${field} must be a non-empty string.`)] }
  }
  return { value: candidate.trim(), issues: [] }
}

export function requireRelativePath(
  candidate: unknown,
  field: string
): { value?: string; issues: ScriptManifestIssue[] } {
  const parsed = requireNonEmptyString(candidate, field)
  if (!parsed.value) {
    return parsed
  }
  if (parsed.value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(parsed.value)) {
    return { issues: [createScriptManifestIssue(field, `${field} must be a relative path.`)] }
  }
  if (parsed.value.includes('..')) {
    return { issues: [createScriptManifestIssue(field, `${field} must not contain "..".`)] }
  }
  return { value: parsed.value, issues: [] }
}

export function validateUnsupportedEnv(
  candidate: unknown,
  field: string
): ScriptManifestIssue[] {
  return candidate === undefined
    ? []
    : [createScriptManifestIssue(field, `${field} is not supported. Runtime-owned environment only.`)]
}

export function validateTimeoutSeconds(
  candidate: unknown,
  field: string,
  fallback: number
): { value?: number; issues: ScriptManifestIssue[] } {
  if (candidate === undefined) {
    return { value: fallback, issues: [] }
  }
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0) {
    return { issues: [createScriptManifestIssue(field, `${field} must be a positive number.`)] }
  }
  return { value: candidate, issues: [] }
}

function validateSchemaNode(
  candidate: Record<string, unknown>,
  field: string,
  isRoot: boolean
): ScriptManifestIssue[] {
  const type = candidate.type
  if (typeof type !== 'string') {
    return [createScriptManifestIssue(field, `${field}.type must be a string.`)]
  }
  if (isRoot && type !== 'object') {
    return [createScriptManifestIssue(field, `${field}.type must be "object".`)]
  }

  const issues: ScriptManifestIssue[] = []
  if (type === 'object') {
    issues.push(...validateObjectSchema(candidate, field))
  }
  if (type === 'array') {
    issues.push(...validateArraySchema(candidate, field))
  }
  if ('enum' in candidate) {
    const values = candidate.enum
    if (!Array.isArray(values) || values.length === 0) {
      issues.push(createScriptManifestIssue(`${field}.enum`, `${field}.enum must be a non-empty array.`))
    }
  }
  if ('minimum' in candidate && typeof candidate.minimum !== 'number') {
    issues.push(createScriptManifestIssue(`${field}.minimum`, `${field}.minimum must be a number.`))
  }
  if ('maximum' in candidate && typeof candidate.maximum !== 'number') {
    issues.push(createScriptManifestIssue(`${field}.maximum`, `${field}.maximum must be a number.`))
  }
  return issues
}

function validateObjectSchema(
  candidate: Record<string, unknown>,
  field: string
): ScriptManifestIssue[] {
  const issues: ScriptManifestIssue[] = []
  const properties = candidate.properties
  if (!isRecord(properties)) {
    issues.push(createScriptManifestIssue(`${field}.properties`, `${field}.properties must be an object.`))
  } else {
    for (const [name, value] of Object.entries(properties)) {
      if (!isRecord(value)) {
        issues.push(createScriptManifestIssue(`${field}.properties.${name}`, `${field}.properties.${name} must be an object.`))
        continue
      }
      issues.push(...validatePropertySchema(value, `${field}.properties.${name}`))
    }
  }
  if ('required' in candidate && !isStringArray(candidate.required)) {
    issues.push(createScriptManifestIssue(`${field}.required`, `${field}.required must be an array of strings.`))
  }
  if ('additionalProperties' in candidate && typeof candidate.additionalProperties !== 'boolean') {
    issues.push(createScriptManifestIssue(`${field}.additionalProperties`, `${field}.additionalProperties must be a boolean.`))
  }
  return issues
}

function validateArraySchema(
  candidate: Record<string, unknown>,
  field: string
): ScriptManifestIssue[] {
  if (!isRecord(candidate.items)) {
    return [createScriptManifestIssue(`${field}.items`, `${field}.items must be an object.`)]
  }
  return validatePropertySchema(candidate.items, `${field}.items`)
}

function validatePropertySchema(candidate: Record<string, unknown>, field: string): ScriptManifestIssue[] {
  const issues = validateSchemaNode(candidate, field, false)
  if ('pathBase' in candidate) {
    if (candidate.type !== 'string') {
      issues.push(createScriptManifestIssue(`${field}.pathBase`, `${field}.pathBase requires the property type to be "string".`))
    } else if (typeof candidate.pathBase !== 'string' || !VALID_PATH_BASES.has(candidate.pathBase)) {
      issues.push(createScriptManifestIssue(`${field}.pathBase`, `${field}.pathBase must be one of ${Array.from(VALID_PATH_BASES).join(', ')}.`))
    }
  }
  return issues
}

function validateArgvItem(
  candidate: unknown,
  field: string,
  schemaProperties: Record<string, unknown>
): { items: ScriptTemplateArgvItem[]; issues: ScriptManifestIssue[] } {
  if (!isRecord(candidate)) {
    return { items: [], issues: [createScriptManifestIssue(field, `${field} must be an object.`)] }
  }
  const kind = typeof candidate.kind === 'string' ? candidate.kind : ''
  if (!VALID_ARGV_KINDS.has(kind)) {
    return { items: [], issues: [createScriptManifestIssue(`${field}.kind`, `${field}.kind must be option, flag, or payload.`)] }
  }
  if (kind === 'payload') {
    return validatePayloadItem(candidate, field)
  }
  return validateMappedArgvItem(candidate, field, kind as 'option' | 'flag', schemaProperties)
}

function validatePayloadItem(
  candidate: Record<string, unknown>,
  field: string
): { items: ScriptTemplateArgvItem[]; issues: ScriptManifestIssue[] } {
  const encoding = typeof candidate.encoding === 'string' ? candidate.encoding : ''
  if (!VALID_PAYLOAD_ENCODINGS.has(encoding)) {
  return {
      items: [],
      issues: [createScriptManifestIssue(`${field}.encoding`, `${field}.encoding must be "json" or "base64-json".`)]
    }
  }
  return { items: [{ kind: 'payload', encoding: encoding as 'json' | 'base64-json' }], issues: [] }
}

function validateMappedArgvItem(
  candidate: Record<string, unknown>,
  field: string,
  kind: 'option' | 'flag',
  schemaProperties: Record<string, unknown>
): { items: ScriptTemplateArgvItem[]; issues: ScriptManifestIssue[] } {
  const name = requireNonEmptyString(candidate.name, `${field}.name`)
  const flag = requireFlagString(candidate.flag, `${field}.flag`)
  const issues = [...name.issues, ...flag.issues]
  if (name.value && !(name.value in schemaProperties)) {
    issues.push(createScriptManifestIssue(`${field}.name`, `${field}.name must reference a declared inputSchema property.`))
  }
  if (name.value && kind === 'flag') {
    const property = schemaProperties[name.value]
    if (!isRecord(property) || property.type !== 'boolean') {
      issues.push(createScriptManifestIssue(`${field}.name`, `${field}.name for kind "flag" must reference a boolean property.`))
    }
  }
  if (issues.length > 0 || !name.value || !flag.value) {
    return { items: [], issues }
  }
  return {
    items: [kind === 'flag'
      ? { kind: 'flag', name: name.value, flag: flag.value }
      : { kind: 'option', name: name.value, flag: flag.value }],
    issues: []
  }
}

function requireFlagString(
  candidate: unknown,
  field: string
): { value?: string; issues: ScriptManifestIssue[] } {
  const parsed = requireNonEmptyString(candidate, field)
  if (!parsed.value) {
    return parsed
  }
  if (!parsed.value.startsWith('--')) {
    return { issues: [createScriptManifestIssue(field, `${field} must start with "--".`)] }
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
