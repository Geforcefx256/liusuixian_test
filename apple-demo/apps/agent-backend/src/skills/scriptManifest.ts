import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDocument } from 'yaml'
import {
  createScriptManifestIssue,
  type ScriptManifestIssue,
  type ScriptManifestParseResult,
  type ScriptTemplate
} from './scriptManifestTypes.js'
import {
  requireNonEmptyString,
  requireRelativePath,
  validateArgv,
  validateInputSchema,
  validateUnsupportedEnv,
  validateTimeoutSeconds
} from './scriptManifestValidation.js'

const DEFAULT_TIMEOUT_SECONDS = 30

export function parseScriptManifest(
  manifestPath: string,
  skillBaseDir: string
): ScriptManifestParseResult {
  if (!existsSync(manifestPath)) {
    return { ok: true, manifest: { templates: [] } }
  }

  const document = parseDocument(readFileSync(manifestPath, 'utf8'), {
    prettyErrors: true,
    strict: true
  })
  if (document.errors.length > 0) {
    return {
      ok: false,
      issues: document.errors.map(error => ({
        code: 'invalid_yaml',
        message: error.message
      }))
    }
  }

  return toParsedManifest(document.toJS(), skillBaseDir)
}

function toParsedManifest(candidate: unknown, skillBaseDir: string): ScriptManifestParseResult {
  if (!isRecord(candidate)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_manifest', message: 'SCRIPTS.yaml must be a YAML object.' }]
    }
  }

  const templatesValue = candidate.templates
  if (!Array.isArray(templatesValue)) {
    return {
      ok: false,
      issues: [createScriptManifestIssue('templates', 'SCRIPTS.yaml field "templates" must be an array.')]
    }
  }

  const templates: ScriptTemplate[] = []
  const issues: ScriptManifestIssue[] = []
  for (let index = 0; index < templatesValue.length; index += 1) {
    const parsed = parseTemplate(templatesValue[index], index, skillBaseDir)
    templates.push(...parsed.templates)
    issues.push(...parsed.issues)
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }
  return { ok: true, manifest: { templates } }
}

function parseTemplate(
  candidate: unknown,
  index: number,
  skillBaseDir: string
): { templates: ScriptTemplate[]; issues: ScriptManifestIssue[] } {
  const prefix = `templates[${index}]`
  if (!isRecord(candidate)) {
    return {
      templates: [],
      issues: [createScriptManifestIssue(prefix, `${prefix} must be an object.`)]
    }
  }

  const id = requireNonEmptyString(candidate.id, `${prefix}.id`)
  const description = requireNonEmptyString(candidate.description, `${prefix}.description`)
  const entry = requireRelativePath(candidate.entry, `${prefix}.entry`)
  const inputSchema = validateInputSchema(candidate.inputSchema, `${prefix}.inputSchema`)
  const argv = validateArgv(candidate.argv, `${prefix}.argv`, inputSchema)
  const envIssues = validateUnsupportedEnv(candidate.env, `${prefix}.env`)
  const timeoutSeconds = validateTimeoutSeconds(
    candidate.timeoutSeconds,
    `${prefix}.timeoutSeconds`,
    DEFAULT_TIMEOUT_SECONDS
  )
  const issues = [
    ...id.issues,
    ...description.issues,
    ...entry.issues,
    ...inputSchema.issues,
    ...argv.issues,
    ...envIssues,
    ...timeoutSeconds.issues
  ]
  if (issues.length > 0 || !id.value || !description.value || !entry.value || !inputSchema.value || !argv.value) {
    return { templates: [], issues }
  }

  const entryPath = resolve(skillBaseDir, entry.value)
  if (!existsSync(entryPath)) {
    return {
      templates: [],
      issues: [createScriptManifestIssue(`${prefix}.entry`, `Script entry does not exist: ${entry.value}`)]
    }
  }

  return {
    templates: [{
      id: id.value,
      description: description.value,
      entry: entry.value,
      entryPath,
      inputSchema: inputSchema.value,
      argv: argv.value,
      timeoutSeconds: timeoutSeconds.value ?? DEFAULT_TIMEOUT_SECONDS
    }],
    issues: []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
