export const MANAGED_SKILL_INTENT_GROUPS = [
  'planning',
  'configuration-authoring',
  'verification',
  'internal-tooling'
] as const

export type ManagedSkillIntentGroup = typeof MANAGED_SKILL_INTENT_GROUPS[number]

const MANAGED_SKILL_INTENT_GROUP_SET = new Set<string>(MANAGED_SKILL_INTENT_GROUPS)

export function parseManagedSkillIntentGroup(value: unknown): ManagedSkillIntentGroup | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  return MANAGED_SKILL_INTENT_GROUP_SET.has(normalized)
    ? (normalized as ManagedSkillIntentGroup)
    : null
}

export function normalizeManagedSkillIntentGroup(value: unknown): ManagedSkillIntentGroup | undefined {
  return parseManagedSkillIntentGroup(value) || undefined
}

export function resolveManagedSkillIntentGroupUpdate(
  value: unknown,
  fallback?: ManagedSkillIntentGroup
): ManagedSkillIntentGroup | undefined {
  if (value === null) return undefined
  return normalizeManagedSkillIntentGroup(value) || fallback
}
