import type { ManagedSkillRecord } from './managedTypes.js'

type ManagedSkillPolicy = Readonly<Pick<ManagedSkillRecord, 'lifecycle' | 'intentGroup' | 'starterEnabled' | 'starterPriority'>>

const DEFAULT_MANAGED_SKILL_POLICIES: Record<string, ManagedSkillPolicy> = {
  'dpi-new-bwm-pcc': {
    lifecycle: 'published',
    intentGroup: 'planning',
    starterEnabled: true,
    starterPriority: 100
  },
  'naming-generation-rowcipher': {
    lifecycle: 'published',
    intentGroup: 'configuration-authoring',
    starterEnabled: true,
    starterPriority: 80
  },
  'tai-fqdn-converter': {
    lifecycle: 'published',
    starterEnabled: true,
    starterPriority: 90
  },
  'ne-csv-processor': {
    lifecycle: 'published',
    starterEnabled: false,
    starterPriority: 60
  },
  'ugc-content-creator': {
    lifecycle: 'draft',
    starterEnabled: false,
    starterPriority: 0
  },
  'pc-config-guide': {
    lifecycle: 'draft',
    starterEnabled: false,
    starterPriority: 0
  },
  'mml-cli': {
    lifecycle: 'published',
    intentGroup: 'internal-tooling',
    starterEnabled: false,
    starterPriority: 0
  }
}

export function getDefaultManagedSkillPolicy(skillId: string): ManagedSkillPolicy | undefined {
  return DEFAULT_MANAGED_SKILL_POLICIES[skillId]
}
