export interface ScriptManifestIssue {
  code: 'invalid_yaml' | 'invalid_manifest'
  message: string
  field?: string
}

export interface ScriptTemplateArgvOption {
  kind: 'option'
  name: string
  flag: string
}

export interface ScriptTemplateArgvFlag {
  kind: 'flag'
  name: string
  flag: string
}

export interface ScriptTemplateArgvPayload {
  kind: 'payload'
  encoding: 'json' | 'base64-json'
}

export type ScriptTemplateArgvItem =
  | ScriptTemplateArgvOption
  | ScriptTemplateArgvFlag
  | ScriptTemplateArgvPayload

export interface ScriptTemplate {
  id: string
  description: string
  entry: string
  entryPath: string
  inputSchema: Record<string, unknown>
  argv: ScriptTemplateArgvItem[]
  timeoutSeconds: number
}

export interface ParsedScriptManifest {
  templates: ScriptTemplate[]
}

export type ScriptManifestParseResult =
  | { ok: true; manifest: ParsedScriptManifest }
  | { ok: false; issues: ScriptManifestIssue[] }

export function createScriptManifestIssue(field: string, message: string): ScriptManifestIssue {
  return {
    code: 'invalid_manifest',
    field,
    message
  }
}
