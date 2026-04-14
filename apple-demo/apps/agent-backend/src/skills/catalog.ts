import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseSkillFrontmatter, type SkillFrontmatterIssue } from './frontmatter.js'
import { type SkillMetadataMirror, cloneSkillMetadataMirror } from './metadata.js'
import { parseScriptManifest } from './scriptManifest.js'
import type { ScriptManifestIssue, ScriptTemplate } from './scriptManifestTypes.js'
import {
  SHARED_SKILL_LIBRARY_ID,
  SKILL_MANIFEST_FILE,
  SKILL_SCRIPTS_FILE
} from './constants.js'
import { resolveAgentAssetsRoot } from '../support/runtimePaths.js'
import { createLogger } from '../logging/index.js'

interface AgentManifestEntry {
  id: string
  enabled?: boolean
}

interface AgentManifestFile {
  agents?: AgentManifestEntry[]
}

const skillCatalogLogger = createLogger({
  category: 'runtime',
  component: 'skill_catalog'
})

export interface SkillCatalogEntry extends SkillMetadataMirror {
  agentId: string
  ownerAgentId: string
  id: string
  name: string
  description: string
  sourcePath: string
  defaultAgentBindings: string[]
  execTemplates: ScriptTemplate[]
}

export interface SkillCatalogLoadIssue {
  agentId: string
  skillId: string
  sourcePath: string
  issues: Array<SkillFrontmatterIssue | ScriptManifestIssue>
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

export class SkillCatalog {
  private readonly skills = new Map<string, SkillCatalogEntry>()
  private readonly skillsByAlias = new Map<string, SkillCatalogEntry>()
  private readonly loadIssues: SkillCatalogLoadIssue[] = []
  private readonly builtinSkillsRoot: string

  constructor(
    private readonly assetsRoot = resolveAgentAssetsRoot(import.meta.url, 2),
    private readonly managedSkillsRoot?: string
  ) {
    this.builtinSkillsRoot = resolve(this.assetsRoot, 'skills')
    this.reload()
  }

  reload(): void {
    this.skills.clear()
    this.skillsByAlias.clear()
    this.loadIssues.length = 0
    const defaultAgentBindings = resolveEnabledAgentIds(this.assetsRoot)
    this.loadSharedSkills(this.builtinSkillsRoot, defaultAgentBindings, false)
    if (this.managedSkillsRoot) {
      this.loadSharedSkills(resolve(this.managedSkillsRoot), defaultAgentBindings, true)
    }
    this.rebuildAliases()
  }

  getSkillsForAgent(agentId: string): SkillCatalogEntry[] {
    if (!resolveEnabledAgentIds(this.assetsRoot).includes(agentId)) {
      return []
    }
    return this.getAllSkills()
  }

  getSkillByName(name: string, agentId?: string): SkillCatalogEntry | null {
    if (agentId && this.getSkillsForAgent(agentId).length === 0) {
      return null
    }
    return this.skillsByAlias.get(name) || null
  }

  getAllSkills(): SkillCatalogEntry[] {
    return Array.from(this.skills.values())
  }

  getLoadIssues(): SkillCatalogLoadIssue[] {
    return [...this.loadIssues]
  }

  private loadSharedSkills(skillRoot: string, defaultAgentBindings: string[], replaceExisting: boolean): void {
    if (!existsSync(skillRoot)) {
      return
    }

    const directories = readdirSync(skillRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right, 'en'))

    for (const directoryName of directories) {
      const skill = this.toSkillEntry(resolve(skillRoot, directoryName), defaultAgentBindings)
      if (!skill) {
        continue
      }
      if (this.skills.has(skill.id) && !replaceExisting) {
        this.recordLoadIssue({
          agentId: SHARED_SKILL_LIBRARY_ID,
          skillId: skill.id,
          sourcePath: skill.sourcePath,
          issues: [{
            code: 'invalid_frontmatter',
            field: 'id',
            message: `Duplicate canonical skill id "${skill.id}" detected.`
          }]
        })
        continue
      }
      this.skills.set(skill.id, skill)
    }
  }

  private toSkillEntry(skillDir: string, defaultAgentBindings: string[]): SkillCatalogEntry | null {
    const sourcePath = resolve(skillDir, SKILL_MANIFEST_FILE)
    if (!existsSync(sourcePath)) {
      return null
    }

    const parsed = parseSkillFrontmatter(readFileSync(sourcePath, 'utf-8'))
    if (!parsed.ok) {
      this.recordLoadIssue({
        agentId: SHARED_SKILL_LIBRARY_ID,
        skillId: resolve(skillDir).split(/[/\\]/).pop() || 'unknown',
        sourcePath,
        issues: parsed.issues
      })
      return null
    }

    const scriptsPath = resolve(skillDir, SKILL_SCRIPTS_FILE)
    const scriptManifest = parseScriptManifest(scriptsPath, skillDir)
    if (!scriptManifest.ok) {
      this.recordLoadIssue({
        agentId: SHARED_SKILL_LIBRARY_ID,
        skillId: parsed.metadata.id,
        sourcePath: scriptsPath,
        issues: scriptManifest.issues
      })
    }

    return {
      agentId: SHARED_SKILL_LIBRARY_ID,
      ownerAgentId: SHARED_SKILL_LIBRARY_ID,
      id: parsed.metadata.id,
      name: parsed.metadata.name,
      description: parsed.metadata.description,
      sourcePath,
      defaultAgentBindings: [...defaultAgentBindings],
      execTemplates: scriptManifest.ok ? scriptManifest.manifest.templates : [],
      ...cloneSkillMetadataMirror(parsed.metadata)
    }
  }

  private rebuildAliases(): void {
    this.skillsByAlias.clear()
    for (const skill of this.skills.values()) {
      if (!this.skillsByAlias.has(skill.name)) {
        this.skillsByAlias.set(skill.name, skill)
      }
      if (!this.skillsByAlias.has(skill.id)) {
        this.skillsByAlias.set(skill.id, skill)
      }
    }
  }

  private recordLoadIssue(issue: SkillCatalogLoadIssue): void {
    this.loadIssues.push(issue)
    skillCatalogLogger.error({
      message: 'invalid canonical skill',
      data: {
        agentId: issue.agentId,
        skillId: issue.skillId,
        sourcePath: issue.sourcePath,
        issues: issue.issues
      }
    })
  }
}

function resolveEnabledAgentIds(assetsRoot: string): string[] {
  const manifestPath = resolve(assetsRoot, 'agents', 'manifest.json')
  const manifest = readJsonFile<AgentManifestFile>(manifestPath)
  return (manifest?.agents || [])
    .filter(entry => entry.enabled !== false)
    .map(entry => entry.id.trim())
    .filter(Boolean)
}
