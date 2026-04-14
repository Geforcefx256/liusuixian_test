import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import type { TokenEstimator } from './TokenEstimator.js'
import {
  getSkillContextText,
  isSkillContextMessage
} from '../sessionMessages.js'
const REMINDER_HEADER = '【已调用技能保留】'
const INVOKED_SKILLS_OPEN = '<invoked_skills>'
const INVOKED_SKILLS_CLOSE = '</invoked_skills>'
const ZERO = 0

export interface RetainedSkillEntry {
  readonly skillName: string
  readonly content: string
  readonly createdAt: number
}

export interface RetainedSkillExtraction {
  readonly skills: RetainedSkillEntry[]
  readonly scannedSkillContextMessages: number
  readonly skippedInvalidSkillContextMessages: number
}

export interface RetainedSkillReminderSelection {
  readonly selectedSkills: RetainedSkillEntry[]
  readonly skippedSkillNames: string[]
  readonly reminderMessage: AgentSessionMessage | null
  readonly reminderTokens: number
}

export function extractRetainedSkills(messages: AgentSessionMessage[]): RetainedSkillExtraction {
  const latestBySkill = new Map<string, RetainedSkillEntry>()
  let scannedSkillContextMessages = ZERO
  let skippedInvalidSkillContextMessages = ZERO

  for (const message of messages) {
    if (!isSkillContextMessage(message)) {
      continue
    }
    scannedSkillContextMessages += 1
    const content = getSkillContextText(message)
    if (!content) {
      skippedInvalidSkillContextMessages += 1
      continue
    }
    latestBySkill.set(message.attributes.skillName, {
      skillName: message.attributes.skillName,
      content,
      createdAt: message.createdAt
    })
  }

  return {
    skills: Array.from(latestBySkill.values()).sort((left, right) => right.createdAt - left.createdAt),
    scannedSkillContextMessages,
    skippedInvalidSkillContextMessages
  }
}

export function selectRetainedSkillsWithinBudget(params: {
  skills: RetainedSkillEntry[]
  budget: number
  estimator: TokenEstimator
  createdAt: number
}): RetainedSkillReminderSelection {
  if (params.skills.length === ZERO || params.budget <= ZERO) {
    return {
      selectedSkills: [],
      skippedSkillNames: params.skills.map(skill => skill.skillName),
      reminderMessage: null,
      reminderTokens: ZERO
    }
  }

  const selectedSkills: RetainedSkillEntry[] = []
  const skippedSkillNames: string[] = []

  for (const skill of params.skills) {
    const candidate = buildRetainedSkillReminderMessage([...selectedSkills, skill], params.createdAt)
    const candidateTokens = params.estimator.countMessage(candidate)
    if (candidateTokens > params.budget) {
      skippedSkillNames.push(skill.skillName)
      continue
    }
    selectedSkills.push(skill)
  }

  const reminderMessage = selectedSkills.length > ZERO
    ? buildRetainedSkillReminderMessage(selectedSkills, params.createdAt)
    : null

  return {
    selectedSkills,
    skippedSkillNames,
    reminderMessage,
    reminderTokens: reminderMessage ? params.estimator.countMessage(reminderMessage) : ZERO
  }
}

export function buildRetainedSkillReminderMessage(
  skills: RetainedSkillEntry[],
  createdAt: number
): AgentSessionMessage {
  return {
    role: 'assistant',
    createdAt,
    parts: [{ type: 'text', text: buildRetainedSkillReminderText(skills) }]
  }
}

function buildRetainedSkillReminderText(skills: RetainedSkillEntry[]): string {
  const lines = [REMINDER_HEADER, INVOKED_SKILLS_OPEN]

  for (const skill of skills) {
    lines.push(`<skill name="${skill.skillName}">`)
    lines.push(skill.content)
    lines.push('</skill>')
  }

  lines.push(INVOKED_SKILLS_CLOSE)
  return lines.join('\n')
}
