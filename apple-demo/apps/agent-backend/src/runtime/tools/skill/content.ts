import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import type { SkillCatalogEntry } from '../../../skills/catalog.js'

const MAX_SAMPLE_FILES = 10

export function buildSkillLoadResult(skill: SkillCatalogEntry): {
  summary: string
  canonicalContent: string
} {
  const content = readFileSync(skill.sourcePath, 'utf-8')
  const body = stripFrontmatter(content).trim()
  const baseDir = dirname(skill.sourcePath)
  const sampleFiles = listSampleFiles(baseDir, MAX_SAMPLE_FILES)
  return {
    summary: buildVisibleSkillSummary(skill.name, baseDir, sampleFiles),
    canonicalContent: buildCanonicalSkillContent(skill.name, body, baseDir, sampleFiles)
  }
}

function buildCanonicalSkillContent(
  skillName: string,
  body: string,
  baseDir: string,
  sampleFiles: string[]
): string {
  const lines: string[] = []

  lines.push(`<skill_content name="${skillName}">`)
  lines.push(`# Skill: ${skillName}`)
  if (body) {
    lines.push('')
    lines.push(body)
  }
  lines.push('')
  lines.push(`Base directory: ${baseDir}`)
  lines.push('Use skill:read_asset, skill:find_assets, or skill:list_assets for read-only files in this skill package. Do not use read_asset for SKILL.md; use the skill tool for that file.')
  lines.push('Do not use local:* tools for skill package assets; local:* only reads workspace files.')
  lines.push('')
  if (sampleFiles.length === 0) {
    lines.push('Sample files: (none)')
  } else {
    lines.push('Sample files:')
    for (const file of sampleFiles) {
      lines.push(`- ${file}`)
    }
  }
  lines.push('</skill_content>')
  return lines.join('\n')
}

function buildVisibleSkillSummary(
  skillName: string,
  baseDir: string,
  sampleFiles: string[]
): string {
  const samplePreview = sampleFiles.length > 0
    ? sampleFiles.slice(0, 3).join(', ')
    : '(none)'
  return [
    `Loaded skill "${skillName}" and injected its canonical instructions into hidden runtime context.`,
    `Base directory: ${baseDir}`,
    `Sample files: ${samplePreview}`
  ].join('\n')
}

export function buildSkillToolDescription(_skills: SkillCatalogEntry[]): string {
  const lines: string[] = []
  lines.push('Load the canonical SKILL.md instructions for an approved skill by name or id.')
  lines.push('Use this first when you need a skill\'s workflow, rules, or asset layout. Use the exact approved skill name or id.')
  lines.push('Use local:* only for workspace files. Use skill:read_asset, skill:find_assets, and skill:list_assets for read-only files inside an approved skill package. SKILL.md itself must be loaded through the skill tool, not read_asset.')
  return lines.join('\n')
}

export function buildSkillExecToolDescription(_skills: SkillCatalogEntry[]): string {
  const lines: string[] = []
  lines.push('Execute an approved governed script template from a canonical skill package.')
  lines.push('Provide skillName, templateId, and structured args. Do not pass shell commands, cwd, or env.')
  lines.push('Load the relevant skill with the `skill` tool before calling `skill:exec` so you know the correct templateId, args contract, and execution order.')
  return lines.join('\n')
}

export function serializeSkillToolError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return { message: error.message, name: error.name }
  }
  return { message: 'Unknown skill tool error' }
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function listSampleFiles(baseDir: string, limit: number): string[] {
  if (!existsSync(baseDir)) return []
  const results: string[] = []
  const queue: string[] = [baseDir]

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift()
    if (!current) break
    const entries = readDirectoryNames(current)
    for (const entry of entries) {
      if (results.length >= limit) break
      if (entry === 'SKILL.md') continue
      const fullPath = resolve(current, entry)
      const stat = readStat(fullPath)
      if (!stat) {
        continue
      }
      if (stat.isDirectory()) {
        queue.push(fullPath)
        continue
      }
      if (stat.isFile()) {
        results.push(toRelativeFromBase(baseDir, fullPath))
      }
    }
  }

  return results
}

function readDirectoryNames(directory: string): string[] {
  try {
    return readdirSync(directory)
  } catch {
    return []
  }
}

function readStat(filePath: string) {
  try {
    return statSync(filePath)
  } catch {
    return null
  }
}

function toRelativeFromBase(baseDir: string, filePath: string): string {
  const relativePath = relative(baseDir, filePath)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}
