import { parseDocument } from 'yaml'
import {
  type CanonicalSkillMetadata,
  type SkillMetadataMirror,
  cloneSkillMetadataMirror
} from './metadata.js'

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const OPTIONAL_STRING_FIELDS = [
  { field: 'when-to-use', property: 'whenToUse' },
  { field: 'input-example', property: 'inputExample' },
  { field: 'output-example', property: 'outputExample' },
  { field: 'model', property: 'model' },
  { field: 'effort', property: 'effort' },
  { field: 'context', property: 'context' }
] as const
const OPTIONAL_BOOLEAN_FIELDS = [
  { field: 'user-invocable', property: 'userInvocable' },
  { field: 'disable-model-invocation', property: 'disableModelInvocation' }
] as const
const OPTIONAL_ARRAY_FIELDS = [
  { field: 'allowed-tools', property: 'allowedTools' }
] as const
const LEGACY_FIELD_ALIASES = [
  ['whenToUse', 'when-to-use'],
  ['when_to_use', 'when-to-use'],
  ['inputExample', 'input-example'],
  ['input_example', 'input-example'],
  ['outputExample', 'output-example'],
  ['output_example', 'output-example'],
  ['allowedTools', 'allowed-tools'],
  ['allowed_tools', 'allowed-tools'],
  ['userInvocable', 'user-invocable'],
  ['user_invocable', 'user-invocable'],
  ['disableModelInvocation', 'disable-model-invocation'],
  ['disable_model_invocation', 'disable-model-invocation']
] as const
const GOVERNED_FIELDS = [
  'display-name',
  'displayName',
  'display-description',
  'displayDescription',
  'starter-summary',
  'starterSummary',
  'starter-enabled',
  'starterEnabled',
  'starter-priority',
  'starterPriority',
  'lifecycle',
  'intent-group',
  'intentGroup',
  'agent-bindings',
  'agentBindings'
] as const
type OptionalStringField = typeof OPTIONAL_STRING_FIELDS[number]
type OptionalBooleanField = typeof OPTIONAL_BOOLEAN_FIELDS[number]
type OptionalArrayField = typeof OPTIONAL_ARRAY_FIELDS[number]

export interface SkillFrontmatterIssue {
  code: 'missing_frontmatter' | 'invalid_yaml' | 'invalid_frontmatter'
  message: string
  field?: string
}

export type SkillFrontmatterParseResult =
  | { ok: true; metadata: CanonicalSkillMetadata }
  | { ok: false; issues: SkillFrontmatterIssue[] }

export function parseSkillFrontmatter(content: string): SkillFrontmatterParseResult {
  const source = extractFrontmatter(content)
  if (!source) {
    return {
      ok: false,
      issues: [{ code: 'missing_frontmatter', message: 'SKILL.md is missing YAML frontmatter.' }]
    }
  }

  const document = parseDocument(source, { prettyErrors: true, strict: true })
  if (document.errors.length > 0) {
    return {
      ok: false,
      issues: document.errors.map(error => ({
        code: 'invalid_yaml',
        message: error.message
      }))
    }
  }

  return toParsedMetadata(document.toJS())
}

function extractFrontmatter(content: string): string | null {
  const match = content.match(FRONTMATTER_PATTERN)
  return match?.[1] || null
}

function toParsedMetadata(candidate: unknown): SkillFrontmatterParseResult {
  if (!isRecord(candidate)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_frontmatter', message: 'SKILL.md frontmatter must be a YAML object.' }]
    }
  }

  const issues = collectMetadataIssues(candidate)
  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    metadata: buildMetadata(candidate)
  }
}

function collectMetadataIssues(candidate: Record<string, unknown>): SkillFrontmatterIssue[] {
  return [
    ...collectLegacyFieldIssues(candidate),
    ...collectGovernedFieldIssues(candidate),
    ...collectRequiredStringIssues(candidate, 'id'),
    ...collectRequiredStringIssues(candidate, 'name'),
    ...collectRequiredStringIssues(candidate, 'description'),
    ...collectOptionalFieldIssues(candidate)
  ]
}

function buildMetadata(candidate: Record<string, unknown>): CanonicalSkillMetadata {
  const metadata: CanonicalSkillMetadata = {
    id: candidate.id as string,
    name: candidate.name as string,
    description: candidate.description as string
  }
  Object.assign(metadata, cloneSkillMetadataMirror(buildOptionalMetadata(candidate)))
  return metadata
}

function buildOptionalMetadata(candidate: Record<string, unknown>): SkillMetadataMirror {
  const metadata: SkillMetadataMirror = {}
  for (const definition of OPTIONAL_STRING_FIELDS) {
    assignOptionalString(metadata, definition, candidate[definition.field])
  }
  for (const definition of OPTIONAL_BOOLEAN_FIELDS) {
    assignOptionalBoolean(metadata, definition, candidate[definition.field])
  }
  for (const definition of OPTIONAL_ARRAY_FIELDS) {
    assignOptionalStringArray(metadata, definition, candidate[definition.field])
  }
  return metadata
}

function collectRequiredStringIssues(
  candidate: Record<string, unknown>,
  field: 'id' | 'name' | 'description'
): SkillFrontmatterIssue[] {
  if (!(field in candidate)) {
    return [createFieldIssue(field, `SKILL.md frontmatter is missing required "${field}" string.`)]
  }
  return collectOptionalStringIssues(candidate, field)
}

function collectOptionalStringIssues(
  candidate: Record<string, unknown>,
  field: string
): SkillFrontmatterIssue[] {
  const value = candidate[field]
  if (typeof value === 'undefined') return []
  if (typeof value === 'string') return []
  return [createFieldIssue(field, `SKILL.md frontmatter field "${field}" must be a string.`)]
}

function collectOptionalFieldIssues(candidate: Record<string, unknown>): SkillFrontmatterIssue[] {
  return [
    ...OPTIONAL_STRING_FIELDS.flatMap(definition => collectOptionalStringIssues(candidate, definition.field)),
    ...OPTIONAL_BOOLEAN_FIELDS.flatMap(definition => collectOptionalBooleanIssues(candidate, definition.field)),
    ...OPTIONAL_ARRAY_FIELDS.flatMap(definition => collectOptionalStringArrayIssues(candidate, definition.field))
  ]
}

function assignOptionalString(
  metadata: SkillMetadataMirror,
  definition: OptionalStringField,
  value: unknown
): void {
  if (typeof value === 'string') {
    metadata[definition.property] = value
  }
}

function assignOptionalBoolean(
  metadata: SkillMetadataMirror,
  definition: OptionalBooleanField,
  value: unknown
): void {
  if (typeof value === 'boolean') {
    metadata[definition.property] = value
  }
}

function assignOptionalStringArray(
  metadata: SkillMetadataMirror,
  definition: OptionalArrayField,
  value: unknown
): void {
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    metadata[definition.property] = [...value]
  }
}

function createFieldIssue(field: string, message: string): SkillFrontmatterIssue {
  return {
    code: 'invalid_frontmatter',
    field,
    message
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectOptionalBooleanIssues(
  candidate: Record<string, unknown>,
  field: string
): SkillFrontmatterIssue[] {
  const value = candidate[field]
  if (typeof value === 'undefined') return []
  if (typeof value === 'boolean') return []
  return [createFieldIssue(field, `SKILL.md frontmatter field "${field}" must be a boolean.`)]
}

function collectOptionalStringArrayIssues(
  candidate: Record<string, unknown>,
  field: string
): SkillFrontmatterIssue[] {
  const value = candidate[field]
  if (typeof value === 'undefined') return []
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return []
  return [createFieldIssue(field, `SKILL.md frontmatter field "${field}" must be an array of strings.`)]
}

function collectLegacyFieldIssues(candidate: Record<string, unknown>): SkillFrontmatterIssue[] {
  return LEGACY_FIELD_ALIASES.flatMap(([alias, canonical]) => {
    if (!(alias in candidate)) {
      return []
    }
    return [createFieldIssue(alias, `SKILL.md frontmatter field "${alias}" is not supported. Use "${canonical}" instead.`)]
  })
}

function collectGovernedFieldIssues(candidate: Record<string, unknown>): SkillFrontmatterIssue[] {
  return GOVERNED_FIELDS.flatMap(field => {
    if (!(field in candidate)) {
      return []
    }
    return [createFieldIssue(field, `SKILL.md frontmatter field "${field}" is governed metadata and must not appear in canonical skills.`)]
  })
}
