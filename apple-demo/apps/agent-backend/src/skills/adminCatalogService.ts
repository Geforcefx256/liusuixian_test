import { cp, mkdir, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ManagedSkillRecord } from './managedRegistry.js'
import { ManagedSkillRegistry } from './managedRegistry.js'
import { SkillCatalog, type SkillCatalogEntry } from './catalog.js'
import { prepareSkillUpload, SkillUploadValidationError, type SkillUploadValidationIssue } from './uploadValidation.js'

export type SkillUploadConflictReason = 'id' | 'name'

export interface SkillUploadConflict {
  reason: SkillUploadConflictReason
  skillId: string
  canonicalName: string
  lifecycle: ManagedSkillRecord['lifecycle']
  boundAgents: string[]
}

export class SkillUploadConflictError extends Error {
  constructor(readonly conflict: SkillUploadConflict) {
    super(`Canonical skill already exists: ${conflict.skillId}`)
    this.name = 'SkillUploadConflictError'
  }
}

export interface UploadManagedSkillResult {
  replaced: boolean
  skill: ManagedSkillRecord
}

export class AdminSkillCatalogService {
  constructor(
    private readonly skillCatalog: SkillCatalog,
    private readonly registry: ManagedSkillRegistry,
    private readonly managedSkillsRoot: string
  ) {}

  async uploadSkill(buffer: Buffer, originalName: string, replaceExisting: boolean): Promise<UploadManagedSkillResult> {
    const prepared = await prepareSkillUpload(buffer, originalName)
    try {
      const conflict = this.resolveUploadConflict(prepared.skillId, prepared.canonicalName, replaceExisting)
      if (conflict) {
        throw new SkillUploadConflictError(conflict)
      }

      const replaced = this.hasCatalogSkill(prepared.skillId)
      const replacing = this.hasManagedPackage(prepared.skillId)
      await mkdir(this.managedSkillsRoot, { recursive: true })
      await this.persistPackage(prepared.packageDir, prepared.skillId, replacing)
      this.skillCatalog.reload()
      await this.registry.syncFromCatalog([prepared.skillId], { resetGovernance: true })
      const skill = this.registry.getManagedSkill(prepared.skillId)
      if (!skill) {
        throw new Error(`Managed skill sync failed: ${prepared.skillId}`)
      }
      return {
        replaced,
        skill
      }
    } finally {
      await prepared.cleanup()
    }
  }

  async deleteSkill(skillId: string): Promise<void> {
    const existing = this.registry.getManagedSkill(skillId)
    if (!existing) {
      throw new Error(`Managed skill not found: ${skillId}`)
    }

    const canonicalDir = resolve(this.managedSkillsRoot, skillId)
    if (!existsSync(canonicalDir)) {
      throw new Error(`Managed skill package not found: ${skillId}`)
    }

    await rm(canonicalDir, { recursive: true, force: true })
    this.skillCatalog.reload()
    if (this.findCatalogSkillById(skillId)) {
      await this.registry.syncFromCatalog([skillId], { resetGovernance: true })
      return
    }
    await this.registry.deleteManagedSkill(skillId)
  }

  private async persistPackage(packageDir: string, skillId: string, replacing: boolean): Promise<void> {
    const finalDir = resolve(this.managedSkillsRoot, skillId)
    const stagingDir = resolve(this.managedSkillsRoot, `.${skillId}.${randomUUID()}.staging`)
    await cp(packageDir, stagingDir, { recursive: true, force: true })
    if (!replacing) {
      await rename(stagingDir, finalDir)
      return
    }

    const backupDir = resolve(this.managedSkillsRoot, `.${skillId}.${randomUUID()}.backup`)
    await rename(finalDir, backupDir)
    try {
      await rename(stagingDir, finalDir)
      await rm(backupDir, { recursive: true, force: true })
    } catch (error) {
      if (existsSync(backupDir) && !existsSync(finalDir)) {
        await rename(backupDir, finalDir)
      }
      throw error
    }
  }

  private resolveUploadConflict(
    skillId: string,
    canonicalName: string,
    replaceExisting: boolean
  ): SkillUploadConflict | null {
    const nameConflict = this.findCatalogSkillByName(canonicalName, skillId)
    if (nameConflict) {
      return this.toConflict(nameConflict, 'name')
    }

    const idConflict = this.findCatalogSkillById(skillId)
    if (idConflict && !replaceExisting) {
      return this.toConflict(idConflict, 'id')
    }

    return null
  }

  private hasManagedPackage(skillId: string): boolean {
    return existsSync(resolve(this.managedSkillsRoot, skillId))
  }

  private hasCatalogSkill(skillId: string): boolean {
    return Boolean(this.findCatalogSkillById(skillId))
  }

  private findCatalogSkillById(skillId: string): SkillCatalogEntry | null {
    return this.skillCatalog.getAllSkills().find(skill => skill.id === skillId) || null
  }

  private findCatalogSkillByName(canonicalName: string, incomingSkillId: string): SkillCatalogEntry | null {
    return this.skillCatalog.getAllSkills().find(skill => {
      return skill.name === canonicalName && skill.id !== incomingSkillId
    }) || null
  }

  private toConflict(skill: SkillCatalogEntry, reason: SkillUploadConflictReason): SkillUploadConflict {
    const record = this.registry.getManagedSkill(skill.id)
    if (!record) {
      throw new Error(`Managed skill record missing for canonical conflict: ${skill.id}`)
    }
    return toConflict(record, reason)
  }
}

function toConflict(record: ManagedSkillRecord, reason: SkillUploadConflictReason): SkillUploadConflict {
  return {
    reason,
    skillId: record.skillId,
    canonicalName: record.canonicalName,
    lifecycle: record.lifecycle,
    boundAgents: record.agentBindings.map(binding => binding.agentId)
  }
}

export function isSkillUploadValidationError(error: unknown): error is SkillUploadValidationError {
  return error instanceof SkillUploadValidationError
}

export function getSkillUploadValidationIssues(error: SkillUploadValidationError): SkillUploadValidationIssue[] {
  return error.issues
}
