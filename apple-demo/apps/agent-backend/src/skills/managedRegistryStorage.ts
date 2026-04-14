import { getDefaultManagedSkillPolicy } from './managedPolicies.js'
import { parseManagedSkillIntentGroup, type ManagedSkillIntentGroup } from './managedIntentGroup.js'
import {
  normalizeManagedSkillRecord,
  type ManagedSkillLifecycle,
  type ManagedSkillRecord
} from './managedTypes.js'

export interface ManagedSkillRegistryFile {
  version: number
  skills: ManagedSkillRecord[]
}

interface PersistedManagedSkillRecord extends Omit<ManagedSkillRecord, 'intentGroup' | 'lifecycle'> {
  intentGroup?: string | null
  lifecycle?: ManagedSkillLifecycle
  surface?: 'production' | 'experimental'
}

export interface ManagedSkillIntentGroupRepair {
  skillId: string
  previousIntentGroup: string
  nextIntentGroup: ManagedSkillIntentGroup | null
}

export function isSupportedRegistryVersion(version: number, currentVersion: number): boolean {
  return version === 1 || version === 3 || version === 4 || version === currentVersion
}

export function repairManagedSkillRecord(
  record: PersistedManagedSkillRecord
): { record: ManagedSkillRecord; repair: ManagedSkillIntentGroupRepair | null } {
  const intentGroup = parseManagedSkillIntentGroup(record.intentGroup)
  const legacyIntentGroup = typeof record.intentGroup === 'string' ? record.intentGroup.trim() : ''
  if (intentGroup || !legacyIntentGroup) {
    return {
      record: normalizePersistedManagedSkillRecord(record, intentGroup || undefined),
      repair: null
    }
  }
  const nextIntentGroup = getDefaultManagedSkillPolicy(record.skillId)?.intentGroup || null
  return {
    record: normalizePersistedManagedSkillRecord(record, nextIntentGroup || undefined),
    repair: {
      skillId: record.skillId,
      previousIntentGroup: legacyIntentGroup,
      nextIntentGroup
    }
  }
}

export function formatManagedSkillIntentGroupRepair(repair: ManagedSkillIntentGroupRepair): string {
  const nextIntentGroup = repair.nextIntentGroup || 'ungrouped'
  return `[managed-skills] repaired legacy intentGroup "${repair.previousIntentGroup}" for "${repair.skillId}" -> "${nextIntentGroup}"`
}

function normalizePersistedManagedSkillRecord(
  record: PersistedManagedSkillRecord,
  intentGroup?: ManagedSkillIntentGroup
): ManagedSkillRecord {
  return normalizeManagedSkillRecord({
    ...record,
    intentGroup,
    lifecycle: normalizePersistedLifecycle(record),
    displayName: typeof record.displayName === 'string' ? record.displayName : '',
    displayDescription: typeof record.displayDescription === 'string' ? record.displayDescription : '',
    starterSummary: typeof record.starterSummary === 'string' ? record.starterSummary : '',
    agentBindings: Array.isArray(record.agentBindings) ? record.agentBindings : []
  })
}

function normalizePersistedLifecycle(
  record: Pick<PersistedManagedSkillRecord, 'lifecycle' | 'surface'>
): ManagedSkillLifecycle {
  if (record.lifecycle === 'published') return 'published'
  if (record.lifecycle === 'draft') return 'draft'
  return record.surface === 'production' ? 'published' : 'draft'
}
