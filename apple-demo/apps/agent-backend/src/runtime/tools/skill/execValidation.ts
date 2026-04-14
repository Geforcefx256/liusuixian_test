import path from 'node:path'

export interface ScriptExecutionRoots {
  workspaceRoot: string
  uploadDir: string
  projectDir: string
  tempDir: string
  runtimeRoot: string
}

export class SkillScriptValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillScriptValidationError'
  }
}

type JsonObject = Record<string, unknown>

export function validateAndResolveScriptArgs(
  schema: Record<string, unknown>,
  args: Record<string, unknown>,
  roots: ScriptExecutionRoots
): Record<string, unknown> {
  return validateObjectSchema(schema, args, 'args', roots)
}

function validateObjectSchema(
  schema: Record<string, unknown>,
  value: unknown,
  field: string,
  roots: ScriptExecutionRoots
): JsonObject {
  if (!isRecord(value)) {
    throw new SkillScriptValidationError(`${field} must be an object`)
  }
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = Array.isArray(schema.required) ? schema.required.filter(isString) : []
  const additionalProperties = schema.additionalProperties !== true
  for (const key of required) {
    if (!(key in value)) {
      throw new SkillScriptValidationError(`${field}.${key} is required`)
    }
  }
  if (additionalProperties) {
    for (const key of Object.keys(value)) {
      if (!(key in properties)) {
        throw new SkillScriptValidationError(`${field}.${key} is not allowed`)
      }
    }
  }

  const next: JsonObject = {}
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!(key in value) || !isRecord(propertySchema)) {
      continue
    }
    next[key] = validateValue(propertySchema, value[key], `${field}.${key}`, roots)
  }
  return next
}

function validateValue(
  schema: Record<string, unknown>,
  value: unknown,
  field: string,
  roots: ScriptExecutionRoots
): unknown {
  const type = schema.type
  if (type === 'string') {
    return validateString(schema, value, field, roots)
  }
  if (type === 'integer') {
    return validateInteger(schema, value, field)
  }
  if (type === 'number') {
    return validateNumber(schema, value, field)
  }
  if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new SkillScriptValidationError(`${field} must be a boolean`)
    }
    return value
  }
  if (type === 'array') {
    return validateArray(schema, value, field, roots)
  }
  if (type === 'object') {
    return validateObjectSchema(schema, value, field, roots)
  }
  return value
}

function validateString(
  schema: Record<string, unknown>,
  value: unknown,
  field: string,
  roots: ScriptExecutionRoots
): string {
  if (typeof value !== 'string') {
    throw new SkillScriptValidationError(`${field} must be a string`)
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    throw new SkillScriptValidationError(`${field} must be one of ${schema.enum.join(', ')}`)
  }
  if (typeof schema.pathBase === 'string') {
    return resolveScopedPath(schema.pathBase, value, field, roots)
  }
  return value
}

function validateInteger(schema: Record<string, unknown>, value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new SkillScriptValidationError(`${field} must be an integer`)
  }
  validateNumericRange(schema, value, field)
  return value
}

function validateNumber(schema: Record<string, unknown>, value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SkillScriptValidationError(`${field} must be a number`)
  }
  validateNumericRange(schema, value, field)
  return value
}

function validateArray(
  schema: Record<string, unknown>,
  value: unknown,
  field: string,
  roots: ScriptExecutionRoots
): unknown[] {
  if (!Array.isArray(value)) {
    throw new SkillScriptValidationError(`${field} must be an array`)
  }
  const itemSchema = isRecord(schema.items) ? schema.items : null
  if (!itemSchema) {
    return value
  }
  return value.map((item, index) => validateValue(itemSchema, item, `${field}[${index}]`, roots))
}

function validateNumericRange(schema: Record<string, unknown>, value: number, field: string): void {
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    throw new SkillScriptValidationError(`${field} must be >= ${schema.minimum}`)
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    throw new SkillScriptValidationError(`${field} must be <= ${schema.maximum}`)
  }
}

function resolveScopedPath(
  base: string,
  inputPath: string,
  field: string,
  roots: ScriptExecutionRoots
): string {
  const root = roots[base as keyof ScriptExecutionRoots]
  if (!root) {
    throw new SkillScriptValidationError(`${field} has unsupported pathBase ${base}`)
  }
  const absolutePath = path.resolve(root, inputPath)
  const relativePath = path.relative(root, absolutePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new SkillScriptValidationError(`${field} is outside allowed ${base} boundary`)
  }
  return absolutePath
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}
