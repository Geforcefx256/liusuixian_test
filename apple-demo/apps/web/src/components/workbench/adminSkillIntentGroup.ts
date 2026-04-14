import type { ManagedSkillIntentGroup, ManagedSkillIntentGroupValue } from '@/api/types'

const MANAGED_SKILL_INTENT_GROUPS = new Set<ManagedSkillIntentGroup>([
  'planning',
  'configuration-authoring',
  'verification'
])

export interface ManagedSkillIntentGroupState {
  intentGroup: ManagedSkillIntentGroup | null
  invalidIntentGroup: string | null
}

export function resolveManagedSkillIntentGroupState(value: ManagedSkillIntentGroupValue | null | undefined): ManagedSkillIntentGroupState {
  if (typeof value !== 'string') {
    return {
      intentGroup: null,
      invalidIntentGroup: null
    }
  }
  const normalized = value.trim()
  if (!normalized) {
    return {
      intentGroup: null,
      invalidIntentGroup: null
    }
  }
  if (MANAGED_SKILL_INTENT_GROUPS.has(normalized as ManagedSkillIntentGroup)) {
    return {
      intentGroup: normalized as ManagedSkillIntentGroup,
      invalidIntentGroup: null
    }
  }
  return {
    intentGroup: null,
    invalidIntentGroup: normalized
  }
}
