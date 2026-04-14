export interface SkillMetadataMirror {
  whenToUse?: string
  inputExample?: string
  outputExample?: string
  allowedTools?: string[]
  userInvocable?: boolean
  disableModelInvocation?: boolean
  model?: string
  effort?: string
  context?: string
}

export interface CanonicalSkillMetadata extends SkillMetadataMirror {
  id: string
  name: string
  description: string
}

const STRING_METADATA_FIELDS = [
  'whenToUse',
  'inputExample',
  'outputExample',
  'model',
  'effort',
  'context'
] as const

const BOOLEAN_METADATA_FIELDS = [
  'userInvocable',
  'disableModelInvocation'
] as const

type StringMetadataField = typeof STRING_METADATA_FIELDS[number]
type BooleanMetadataField = typeof BOOLEAN_METADATA_FIELDS[number]

export function cloneSkillMetadataMirror(metadata: SkillMetadataMirror): SkillMetadataMirror {
  return normalizeSkillMetadataMirror(metadata)
}

export function normalizeSkillMetadataMirror(
  candidate: Partial<Record<keyof SkillMetadataMirror, unknown>>
): SkillMetadataMirror {
  const metadata: SkillMetadataMirror = {}
  assignStringMetadataFields(metadata, candidate)
  assignBooleanMetadataFields(metadata, candidate)
  assignAllowedTools(metadata, candidate.allowedTools)
  return metadata
}

function assignStringMetadataFields(
  metadata: SkillMetadataMirror,
  candidate: Partial<Record<keyof SkillMetadataMirror, unknown>>
): void {
  for (const field of STRING_METADATA_FIELDS) {
    assignStringField(metadata, field, candidate[field])
  }
}

function assignBooleanMetadataFields(
  metadata: SkillMetadataMirror,
  candidate: Partial<Record<keyof SkillMetadataMirror, unknown>>
): void {
  for (const field of BOOLEAN_METADATA_FIELDS) {
    assignBooleanField(metadata, field, candidate[field])
  }
}

function assignStringField(
  metadata: SkillMetadataMirror,
  field: StringMetadataField,
  value: unknown
): void {
  if (typeof value === 'string') {
    metadata[field] = value
  }
}

function assignBooleanField(
  metadata: SkillMetadataMirror,
  field: BooleanMetadataField,
  value: unknown
): void {
  if (typeof value === 'boolean') {
    metadata[field] = value
  }
}

function assignAllowedTools(metadata: SkillMetadataMirror, value: unknown): void {
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    metadata.allowedTools = [...value]
  }
}
