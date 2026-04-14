import { normalizeManagedSkillIntentGroup } from './managedIntentGroup.js'
import type { ManagedSkillIntentGroup } from './managedIntentGroup.js'
import {
  type SkillMetadataMirror,
  cloneSkillMetadataMirror,
  normalizeSkillMetadataMirror
} from './metadata.js'

export type ManagedSkillLifecycle = 'draft' | 'published'
export type { ManagedSkillIntentGroup } from './managedIntentGroup.js'

export interface ManagedSkillAgentBinding {
  agentId: string
}

export interface ManagedSkillRecord extends SkillMetadataMirror {
  skillId: string
  canonicalName: string
  canonicalDescription: string
  displayName: string
  displayDescription: string
  starterSummary?: string
  ownerAgentId: string
  sourceAgentId: string
  sourcePath: string
  lifecycle: ManagedSkillLifecycle
  intentGroup?: ManagedSkillIntentGroup
  starterEnabled: boolean
  starterPriority: number
  agentBindings: ManagedSkillAgentBinding[]
  importedAt: number
  updatedAt: number
}

export interface ManagedSkillUpdateInput {
  displayName?: string
  displayDescription?: string
  starterSummary?: string
  lifecycle?: ManagedSkillLifecycle
  intentGroup?: ManagedSkillIntentGroup | null
  starterEnabled?: boolean
  starterPriority?: number
  agentBindings?: Array<ManagedSkillAgentBinding | string>
}

export interface GovernedSkillView extends ManagedSkillRecord {
  visible: boolean
}

export function cloneManagedSkillRecord(
  record: ManagedSkillRecord,
  _agentId?: string
): ManagedSkillRecord {
  return {
    ...record,
    ...cloneSkillMetadataMirror(record),
    agentBindings: record.agentBindings.map(binding => ({ ...binding }))
  }
}

interface LegacyManagedSkillAgentBinding {
  agentId?: unknown
  displayName?: unknown
}

export function normalizeManagedSkillBindings(
  bindings: Array<ManagedSkillAgentBinding | LegacyManagedSkillAgentBinding | string> | undefined
): ManagedSkillAgentBinding[] {
  if (!Array.isArray(bindings)) return []
  const normalized = new Map<string, ManagedSkillAgentBinding>()
  for (const binding of bindings) {
    const next = normalizeManagedSkillBinding(binding)
    if (!next) continue
    normalized.set(next.agentId, next)
  }
  return Array.from(normalized.values())
}

export function resolveManagedSkillDisplayName(
  record: Pick<ManagedSkillRecord, 'canonicalName' | 'skillId'> & { displayName?: string },
  _agentId?: string
): string {
  const summaryDisplayName = normalizeDisplayName(record.displayName)
  if (summaryDisplayName) return summaryDisplayName
  const canonicalName = normalizeDisplayName(record.canonicalName)
  if (canonicalName) return canonicalName
  return record.skillId
}

export function hasManagedSkillBinding(
  record: Pick<ManagedSkillRecord, 'agentBindings'>,
  agentId: string
): boolean {
  return record.agentBindings.some(binding => binding.agentId === agentId)
}

export function isManagedSkillDisplayNameComplete(
  record: Pick<ManagedSkillRecord, 'skillId' | 'canonicalName'>,
  displayName: string
): boolean {
  const normalizedName = normalizeDisplayName(displayName)
  if (!normalizedName) return false
  return !isDefaultManagedSkillDisplayName(record, normalizedName)
}

export function isDefaultManagedSkillDisplayName(
  record: Pick<ManagedSkillRecord, 'skillId' | 'canonicalName'>,
  displayName: string
): boolean {
  const normalizedName = normalizeDisplayName(displayName)
  if (!normalizedName) return true
  return normalizedName === record.skillId || normalizedName === normalizeDisplayName(record.canonicalName)
}

export function normalizeManagedSkillRecord(
  record: Omit<ManagedSkillRecord, 'displayName' | 'agentBindings'> & {
    displayName?: string
    agentBindings: Array<ManagedSkillAgentBinding | LegacyManagedSkillAgentBinding | string>
  }
): ManagedSkillRecord {
  return {
    ...record,
    ...normalizeSkillMetadataMirror(record),
    lifecycle: record.lifecycle === 'published' ? 'published' : 'draft',
    intentGroup: normalizeManagedSkillIntentGroup(record.intentGroup),
    displayName: resolveMigratedManagedSkillDisplayName(record),
    displayDescription: typeof record.displayDescription === 'string' ? record.displayDescription.trim() : '',
    starterSummary: typeof record.starterSummary === 'string' ? record.starterSummary.trim() : '',
    agentBindings: normalizeManagedSkillBindings(record.agentBindings)
  }
}

function normalizeManagedSkillBinding(
  binding: ManagedSkillAgentBinding | LegacyManagedSkillAgentBinding | string
): ManagedSkillAgentBinding | null {
  if (typeof binding === 'string') {
    const agentId = binding.trim()
    if (!agentId) return null
    return { agentId }
  }
  if (!binding || typeof binding !== 'object') return null
  const agentId = typeof binding.agentId === 'string' ? binding.agentId.trim() : ''
  if (!agentId) return null
  return { agentId }
}

function resolveMigratedManagedSkillDisplayName(
  record: Pick<ManagedSkillRecord, 'canonicalName' | 'skillId'> & {
    displayName?: string
    agentBindings: Array<ManagedSkillAgentBinding | LegacyManagedSkillAgentBinding | string>
  }
): string {
  const bindingDisplayNames = record.agentBindings
    .map(binding => extractLegacyBindingDisplayName(binding))
    .filter(Boolean)
  const governedDisplayName = bindingDisplayNames.find(name => isManagedSkillDisplayNameComplete(record, name))
  if (governedDisplayName) return governedDisplayName
  const displayName = normalizeDisplayName(record.displayName)
  if (displayName) return displayName
  return bindingDisplayNames[0] || ''
}

function extractLegacyBindingDisplayName(
  binding: ManagedSkillAgentBinding | LegacyManagedSkillAgentBinding | string
): string {
  if (!binding || typeof binding !== 'object') return ''
  if (!('displayName' in binding)) return ''
  return normalizeDisplayName(
    typeof binding.displayName === 'string' ? binding.displayName : undefined
  )
}

function normalizeDisplayName(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}
