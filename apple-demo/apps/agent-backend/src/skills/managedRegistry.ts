import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SkillCatalog, SkillCatalogEntry } from './catalog.js'
import { cloneSkillMetadataMirror } from './metadata.js'
import { resolveManagedSkillIntentGroupUpdate } from './managedIntentGroup.js'
import { getDefaultManagedSkillPolicy } from './managedPolicies.js'
import {
  formatManagedSkillIntentGroupRepair,
  isSupportedRegistryVersion,
  repairManagedSkillRecord,
  type ManagedSkillIntentGroupRepair,
  type ManagedSkillRegistryFile
} from './managedRegistryStorage.js'
import {
  cloneManagedSkillRecord,
  hasManagedSkillBinding,
  isManagedSkillDisplayNameComplete,
  normalizeManagedSkillBindings,
  normalizeManagedSkillRecord,
  resolveManagedSkillDisplayName,
  type ManagedSkillRecord,
  type ManagedSkillLifecycle,
  type ManagedSkillUpdateInput
} from './managedTypes.js'

export type {
  GovernedSkillView,
  ManagedSkillAgentBinding,
  ManagedSkillLifecycle,
  ManagedSkillRecord,
  ManagedSkillUpdateInput
} from './managedTypes.js'

const REGISTRY_VERSION = 5

interface SyncFromCatalogOptions {
  resetGovernance?: boolean
}

interface LoadManagedSkillsResult {
  repairs: ManagedSkillIntentGroupRepair[]
  needsPersist: boolean
}

export class ManagedSkillRegistry {
  private readonly records = new Map<string, ManagedSkillRecord>()
  private initialized = false

  constructor(
    private readonly skillCatalog: SkillCatalog,
    private readonly registryPath: string
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    await mkdir(dirname(this.registryPath), { recursive: true })
    const { repairs, needsPersist } = await this.load()
    const imported = await this.syncFromCatalog()
    if (needsPersist && imported.length === 0) {
      await this.persist()
    }
    this.logIntentGroupRepairs(repairs)
    this.initialized = true
  }

  listManagedSkills(): ManagedSkillRecord[] {
    return Array.from(this.records.values())
      .map(record => cloneManagedSkillRecord(record))
      .sort((left, right) => {
        if (left.lifecycle !== right.lifecycle) {
          return left.lifecycle === 'published' ? -1 : 1
        }
        return this.buildManagedSkillSortKey(left).localeCompare(this.buildManagedSkillSortKey(right), 'zh-CN')
      })
  }

  listGovernedSkillsForAgent(agentId: string): ManagedSkillRecord[] {
    return this.listManagedSkills()
      .filter(skill => hasManagedSkillBinding(skill, agentId))
      .filter(skill => this.isPublishedVisible(skill))
      .map(skill => cloneManagedSkillRecord(skill, agentId))
  }

  getManagedSkill(skillId: string): ManagedSkillRecord | null {
    const record = this.records.get(skillId)
    return record ? cloneManagedSkillRecord(record) : null
  }

  async syncFromCatalog(skillIds?: string[], options: SyncFromCatalogOptions = {}): Promise<ManagedSkillRecord[]> {
    const targetIds = Array.isArray(skillIds) && skillIds.length > 0
      ? new Set(skillIds)
      : null
    const now = Date.now()
    const imported: ManagedSkillRecord[] = []

    for (const skill of this.skillCatalog.getAllSkills()) {
      if (targetIds && !targetIds.has(skill.id)) continue
      const next = this.mergeWithCanonical(skill, now, options.resetGovernance === true)
      this.records.set(next.skillId, next)
      imported.push(next)
    }

    if (imported.length > 0) {
      await this.persist()
    }

    return imported
      .map(record => cloneManagedSkillRecord(record))
      .sort((left, right) => this.buildManagedSkillSortKey(left).localeCompare(this.buildManagedSkillSortKey(right), 'zh-CN'))
  }

  async updateManagedSkill(skillId: string, update: ManagedSkillUpdateInput): Promise<ManagedSkillRecord> {
    const existing = this.records.get(skillId)
    if (!existing) {
      throw new Error(`Managed skill not found: ${skillId}`)
    }

    const next: ManagedSkillRecord = {
      ...existing,
      displayName: normalizeManagedText(update.displayName, existing.displayName),
      displayDescription: normalizeManagedText(update.displayDescription, existing.displayDescription),
      starterSummary: normalizeManagedSummary(update.starterSummary, existing.starterSummary),
      lifecycle: update.lifecycle || existing.lifecycle,
      intentGroup: resolveManagedSkillIntentGroupUpdate(update.intentGroup, existing.intentGroup),
      starterEnabled: typeof update.starterEnabled === 'boolean' ? update.starterEnabled : existing.starterEnabled,
      starterPriority: Number.isFinite(update.starterPriority) ? Math.max(0, Math.floor(Number(update.starterPriority))) : existing.starterPriority,
      agentBindings: this.resolveNextBindings(existing, update),
      updatedAt: Date.now()
    }

    const normalized = normalizeManagedSkillRecord(next)
    this.assertGovernanceConstraints(normalized)
    this.records.set(skillId, normalized)
    await this.persist()
    return cloneManagedSkillRecord(normalized)
  }

  async deleteManagedSkill(skillId: string): Promise<void> {
    if (!this.records.delete(skillId)) {
      throw new Error(`Managed skill not found: ${skillId}`)
    }
    await this.persist()
  }

  getCanonicalSkill(skillId: string, agentId?: string): SkillCatalogEntry | null {
    return this.skillCatalog.getSkillByName(skillId, agentId) || this.skillCatalog.getSkillByName(skillId)
  }

  getGovernedCanonicalSkillsForAgent(agentId: string): SkillCatalogEntry[] {
    return this.listGovernedSkillsForAgent(agentId)
      .map(skill => this.getCanonicalSkill(skill.skillId, agentId))
      .filter((skill): skill is SkillCatalogEntry => Boolean(skill))
  }

  resolveGovernedSkillName(skillName: string, agentId: string): string | null {
    const canonical = this.getCanonicalSkill(skillName, agentId)
    if (!canonical) return null
    const managed = this.records.get(canonical.id)
    if (!managed) return canonical.name
    if (!hasManagedSkillBinding(managed, agentId) || !this.isPublishedVisible(managed)) {
      return canonical.name
    }
    return resolveManagedSkillDisplayName(managed, agentId)
  }

  private mergeWithCanonical(skill: SkillCatalogEntry, now: number, resetGovernance: boolean): ManagedSkillRecord {
    const existing = this.records.get(skill.id)
    const defaults = getDefaultManagedSkillPolicy(skill.id)
    if (resetGovernance) {
      return normalizeManagedSkillRecord({
        ...cloneSkillMetadataMirror(skill),
        skillId: skill.id,
        canonicalName: skill.name,
        canonicalDescription: skill.description,
        displayName: '',
        displayDescription: '',
        starterSummary: '',
        ownerAgentId: skill.ownerAgentId,
        sourceAgentId: skill.agentId,
        sourcePath: skill.sourcePath,
        lifecycle: 'draft',
        intentGroup: undefined,
        starterEnabled: false,
        starterPriority: 0,
        agentBindings: [],
        importedAt: existing?.importedAt || now,
        updatedAt: now
      })
    }
    if (existing) {
      return normalizeManagedSkillRecord({
        ...existing,
        ...cloneSkillMetadataMirror(skill),
        canonicalName: skill.name,
        canonicalDescription: skill.description,
        ownerAgentId: skill.ownerAgentId,
        sourceAgentId: skill.agentId,
        sourcePath: skill.sourcePath,
        updatedAt: now
      })
    }

    return normalizeManagedSkillRecord({
      ...cloneSkillMetadataMirror(skill),
      skillId: skill.id,
      canonicalName: skill.name,
      canonicalDescription: skill.description,
      displayName: skill.name,
      displayDescription: skill.description,
      starterSummary: '',
      ownerAgentId: skill.ownerAgentId,
      sourceAgentId: skill.agentId,
      sourcePath: skill.sourcePath,
      lifecycle: defaults?.lifecycle || 'draft',
      intentGroup: defaults?.intentGroup,
      starterEnabled: defaults?.starterEnabled ?? false,
      starterPriority: defaults?.starterPriority ?? 0,
      agentBindings: skill.defaultAgentBindings.map(agentId => ({ agentId })),
      importedAt: now,
      updatedAt: now
    })
  }

  private async load(): Promise<LoadManagedSkillsResult> {
    if (!existsSync(this.registryPath)) {
      return {
        repairs: [],
        needsPersist: false
      }
    }
    const raw = await readFile(this.registryPath, 'utf8')
    if (!raw.trim()) {
      return {
        repairs: [],
        needsPersist: false
      }
    }
    const parsed = JSON.parse(raw) as ManagedSkillRegistryFile
    if (!Array.isArray(parsed.skills) || !isSupportedRegistryVersion(parsed.version, REGISTRY_VERSION)) {
      return {
        repairs: [],
        needsPersist: false
      }
    }
    const repairs: ManagedSkillIntentGroupRepair[] = []
    for (const record of parsed.skills) {
      if (!record.skillId) continue
      const normalized = repairManagedSkillRecord(record)
      if (normalized.repair) {
        repairs.push(normalized.repair)
      }
      this.records.set(record.skillId, normalized.record)
    }
    return {
      repairs,
      needsPersist: parsed.version !== REGISTRY_VERSION || repairs.length > 0
    }
  }

  private async persist(): Promise<void> {
    const payload: ManagedSkillRegistryFile = {
      version: REGISTRY_VERSION,
      skills: this.listManagedSkills()
    }
    await writeFile(this.registryPath, JSON.stringify(payload, null, 2), 'utf8')
  }

  private resolveNextBindings(
    existing: ManagedSkillRecord,
    update: ManagedSkillUpdateInput
  ) {
    if (Array.isArray(update.agentBindings)) {
      return normalizeManagedSkillBindings(update.agentBindings)
    }
    return existing.agentBindings.map(binding => ({ ...binding }))
  }

  private assertGovernanceConstraints(next: ManagedSkillRecord): void {
    const duplicateError = this.findDuplicateBindingError(next)
    if (duplicateError) {
      throw new Error(duplicateError)
    }
    const publishError = this.findPublishError(next)
    if (publishError) {
      throw new Error(publishError)
    }
  }

  private findDuplicateBindingError(next: ManagedSkillRecord): string | null {
    const displayName = next.displayName.trim()
    if (!displayName) return null
    for (const binding of next.agentBindings) {
      if (!this.isAgentScopedNameUnique(next.skillId, binding.agentId, displayName)) {
        return `用户可见名称 "${displayName}" 在 Agent ${binding.agentId} 下已存在`
      }
    }
    return null
  }

  private findPublishError(next: ManagedSkillRecord): string | null {
    if (next.lifecycle !== 'published') return null
    if (next.agentBindings.length === 0) {
      return '发布前至少需要绑定一个 Agent'
    }
    if (!next.displayDescription.trim()) {
      return '用户可见描述未完成治理，当前 Skill 必须保持草稿'
    }
    if (!isManagedSkillDisplayNameComplete(next, next.displayName)) {
      return '用户可见名称未完成治理，当前 Skill 必须保持草稿'
    }
    return null
  }

  private isAgentScopedNameUnique(skillId: string, agentId: string, displayName: string): boolean {
    const normalizedName = displayName.trim().toLocaleLowerCase('zh-CN')
    for (const record of this.records.values()) {
      if (record.skillId === skillId) continue
      const conflict = record.agentBindings.find(binding => {
        return binding.agentId === agentId
          && record.displayName.trim().toLocaleLowerCase('zh-CN') === normalizedName
      })
      if (conflict) {
        return false
      }
    }
    return true
  }

  private isPublishedVisible(skill: ManagedSkillRecord): boolean {
    return skill.lifecycle === 'published'
      && skill.displayDescription.trim().length > 0
      && skill.agentBindings.length > 0
      && isManagedSkillDisplayNameComplete(skill, skill.displayName)
      && skill.agentBindings.every(binding => this.isAgentScopedNameUnique(skill.skillId, binding.agentId, skill.displayName))
  }

  private buildManagedSkillSortKey(skill: ManagedSkillRecord): string {
    return resolveManagedSkillDisplayName(skill).trim().toLocaleLowerCase('zh-CN')
      || skill.canonicalName.trim().toLocaleLowerCase('zh-CN')
      || skill.skillId
  }

  private logIntentGroupRepairs(repairs: ManagedSkillIntentGroupRepair[]): void {
    for (const repair of repairs) {
      console.warn(formatManagedSkillIntentGroupRepair(repair))
    }
  }
}

function normalizeManagedText(next: string | undefined, fallback: string): string {
  if (typeof next !== 'string') return fallback
  return next.trim()
}

function normalizeManagedSummary(next: string | undefined, fallback: string | undefined): string {
  if (typeof next === 'string') {
    return next.trim()
  }
  return typeof fallback === 'string' ? fallback.trim() : ''
}
