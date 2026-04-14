import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AgentDefinition, AgentSkill } from '../agent/types.js'
import type { AgentRuntimeModelInfo, AgentModelRegistry } from '../agent/modelRegistry.js'
import type { SkillCatalog, SkillCatalogEntry } from '../skills/catalog.js'
import { type SkillMetadataMirror, cloneSkillMetadataMirror } from '../skills/metadata.js'
import type { ManagedSkillRegistry } from '../skills/managedRegistry.js'
import type { ManagedSkillIntentGroup } from '../skills/managedIntentGroup.js'
import { resolveManagedSkillDisplayName } from '../skills/managedTypes.js'
import { resolveAgentAssetsRoot } from '../support/runtimePaths.js'
import {
  buildAgentPresentation,
  type AgentPresentation
} from './presentation.js'

interface AgentManifestEntry {
  id: string
  path: string
  enabled?: boolean
}

interface AgentManifestFile {
  agents?: AgentManifestEntry[]
}


export interface AgentCatalogSkill extends SkillMetadataMirror {
  id: string
  name: string
  description: string
  starterSummary?: string
  lifecycle?: 'draft' | 'published'
  intentGroup?: ManagedSkillIntentGroup
  starterEnabled?: boolean
  starterPriority?: number
}

export interface AgentCatalogSummary {
  id: string
  name: string
  description: string
  version: string
  skillCount: number
}

export interface AgentCatalogDetail extends AgentCatalogSummary {
  presentation?: AgentPresentation
  runtime: AgentRuntimeModelInfo
  skills: AgentCatalogSkill[]
}

export interface AgentExecutionCatalog {
  agent: AgentDefinition
  skills: AgentSkill[]
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function parseAgentMd(content: string): AgentDefinition | null {
  const normalizedContent = content.replace(/^\uFEFF/, '')
  const match = normalizedContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null

  const [, frontmatter, body] = match
  const lines = frontmatter.split(/\r?\n/)
  const metadata = new Map<string, string>()
  for (const line of lines) {
    // Only parse top-level frontmatter keys. Nested YAML blocks like
    // `model:\n  name: ...` must not overwrite the agent display name.
    if (/^\s/.test(line)) continue
    const trimmed = line.trim()
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    metadata.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, ''))
  }

  const id = metadata.get('id')
  const name = metadata.get('name')
  if (!id || !name) return null

  return {
    id,
    name,
    description: metadata.get('description') || '',
    version: metadata.get('version') || '1.0.0',
    instructions: body.trim()
  }
}

export class AgentCatalogService {
  private readonly assetsRoot: string

  constructor(
    private readonly modelRegistry?: Pick<AgentModelRegistry, 'getRuntime'>,
    private readonly skillCatalog?: SkillCatalog,
    private readonly managedSkillRegistry?: ManagedSkillRegistry,
    assetsRoot = resolveAgentAssetsRoot(import.meta.url, 2)
  ) {
    this.assetsRoot = assetsRoot
  }

  listAgents(): AgentCatalogSummary[] {
    return this.readManifestEntries()
      .map(entry => this.getAgentDetail(entry.id))
      .filter((detail): detail is AgentCatalogDetail => detail !== null)
      .map(detail => ({
        id: detail.id,
        name: detail.name,
        description: detail.description,
        version: detail.version,
        skillCount: detail.skillCount
      }))
  }

  getAgentDetail(agentId: string): AgentCatalogDetail | null {
    const execution = this.getExecutionCatalog(agentId)
    if (!execution) return null
    const detailSkills = this.resolveSkillsForAgent(agentId).map(skill => this.toCatalogSkill(skill, agentId))

    const runtime = this.modelRegistry?.getRuntime(agentId) || {
      provider: 'openai' as const,
      modelName: 'unconfigured',
      stream: true,
      hasApiKey: false,
      hasCustomHeaders: false,
      source: 'default' as const
    }

    return {
      id: execution.agent.id,
      name: execution.agent.name,
      description: execution.agent.description,
      version: execution.agent.version,
      skillCount: detailSkills.length,
      presentation: buildAgentPresentation({
        name: execution.agent.name,
        description: execution.agent.description,
        instructions: execution.agent.instructions,
        fallbackCapabilities: detailSkills.map(skill => skill.name)
      }),
      runtime,
      skills: detailSkills
    }
  }

  getExecutionCatalog(agentId: string): AgentExecutionCatalog | null {
    const entry = this.readManifestEntries().find(candidate => candidate.id === agentId)
    if (!entry) return null

    const normalizedPath = entry.path.replace(/^\/+/, '')
    const agentDir = resolve(this.assetsRoot, normalizedPath.replace(/^agents\//, 'agents/'))
    const agentMdPath = resolve(agentDir, 'AGENT.md')
    const contextPath = resolve(agentDir, 'CONTEXT.md')
    const memoryPath = resolve(agentDir, 'MEMORY.md')
    if (!existsSync(agentMdPath)) return null

    const parsedAgent = parseAgentMd(readFileSync(agentMdPath, 'utf-8'))
    if (!parsedAgent) return null

    const sourceSkills = this.resolveSkillsForAgent(agentId)
    const skills = sourceSkills.map(skill => this.toExecutionSkill(skill))

    const agent: AgentDefinition = {
      ...parsedAgent,
      contextTemplate: existsSync(contextPath) ? readFileSync(contextPath, 'utf-8').trim() : undefined,
      memory: existsSync(memoryPath) ? readFileSync(memoryPath, 'utf-8').trim() : undefined
    }

    return { agent, skills }
  }

  private readManifestEntries(): AgentManifestEntry[] {
    const manifestPath = resolve(this.assetsRoot, 'agents', 'manifest.json')
    const manifest = readJsonFile<AgentManifestFile>(manifestPath)
    return (manifest?.agents || []).filter(entry => entry.enabled !== false)
  }

  private toCatalogSkill(entry: SkillCatalogEntry, agentId: string): AgentCatalogSkill {
    const managed = this.managedSkillRegistry?.getManagedSkill(entry.id)
    return {
      id: entry.id,
      name: managed ? resolveManagedSkillDisplayName(managed, agentId) : entry.name,
      description: managed?.displayDescription || entry.description,
      ...cloneSkillMetadataMirror(entry),
      starterSummary: managed?.starterSummary || undefined,
      lifecycle: managed?.lifecycle,
      intentGroup: managed?.intentGroup,
      starterEnabled: managed?.starterEnabled,
      starterPriority: managed?.starterPriority
    }
  }

  resolveGovernedSkillName(skillName: string, agentId: string): string | null {
    if (this.managedSkillRegistry) {
      return this.managedSkillRegistry.resolveGovernedSkillName(skillName, agentId)
    }
    const canonical = this.skillCatalog?.getSkillByName(skillName, agentId) || this.skillCatalog?.getSkillByName(skillName)
    return canonical?.name || null
  }

  private toExecutionSkill(entry: SkillCatalogEntry): AgentSkill {
    const managed = this.managedSkillRegistry?.getManagedSkill(entry.id)
    return {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      instructions: '',
      sourcePath: entry.sourcePath,
      ...cloneSkillMetadataMirror(entry),
      lifecycle: managed?.lifecycle,
      intentGroup: managed?.intentGroup,
      starterEnabled: managed?.starterEnabled,
      starterPriority: managed?.starterPriority
    }
  }

  private resolveSkillsForAgent(agentId: string): SkillCatalogEntry[] {
    if (this.managedSkillRegistry) {
      return this.managedSkillRegistry.getGovernedCanonicalSkillsForAgent(agentId)
    }
    return this.skillCatalog?.getSkillsForAgent(agentId) || []
  }
}
