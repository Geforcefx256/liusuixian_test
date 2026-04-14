import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import type { TokenEstimator } from './TokenEstimator.js'
import type { SummaryRecord, ContextLogEntry } from './types.js'
import {
  extractRetainedSkills,
  selectRetainedSkillsWithinBudget
} from './retainedSkillState.js'
import type { ContextLogScope } from './contextLogging.js'
import {
  logRetentionExtracted,
  logRetentionInjected,
  logRetentionSkipped
} from './contextLogging.js'

const SUMMARY_PREFIX = '【会话摘要】\n'
const RETAINED_SKILL_BUDGET = 2048
const EMPTY = 0
const ONE = 1

export function buildContextMessagePool(params: {
  messages: AgentSessionMessage[]
  summary: SummaryRecord | null
  budget: number
  estimator: TokenEstimator
  scope: ContextLogScope
  log: (entry: ContextLogEntry) => void
}): { messages: AgentSessionMessage[]; hasSummary: boolean; fixedPrefixCount: number } {
  if (params.messages.length === EMPTY) {
    return { messages: [], hasSummary: false, fixedPrefixCount: EMPTY }
  }

  const retainedSkills = extractRetainedSkills(params.messages)
  logRetentionExtracted(params.log, params.scope, {
    scannedSkillContextMessages: retainedSkills.scannedSkillContextMessages,
    skippedInvalidSkillContextMessages: retainedSkills.skippedInvalidSkillContextMessages,
    skillNames: retainedSkills.skills.map(skill => skill.skillName)
  })

  if (!params.summary) {
    logNoSummarySkip(params, retainedSkills.skills.map(skill => skill.skillName))
    return { messages: params.messages, hasSummary: false, fixedPrefixCount: EMPTY }
  }

  const activeTail = getActiveTail(params.messages, params.summary)
  const summaryMessage = buildSummaryMessage(params.summary)
  const reminderMessage = buildRetainedSkillReminder({
    summary: params.summary,
    retainedSkills: retainedSkills.skills,
    budget: params.budget,
    estimator: params.estimator,
    scope: params.scope,
    log: params.log
  })

  return {
    messages: reminderMessage ? [summaryMessage, reminderMessage, ...activeTail] : [summaryMessage, ...activeTail],
    hasSummary: true,
    fixedPrefixCount: reminderMessage ? 2 : 1
  }
}

function buildRetainedSkillReminder(params: {
  summary: SummaryRecord
  retainedSkills: Array<{ skillName: string; content: string; createdAt: number }>
  budget: number
  estimator: TokenEstimator
  scope: ContextLogScope
  log: (entry: ContextLogEntry) => void
}): AgentSessionMessage | null {
  if (params.retainedSkills.length === EMPTY) {
    return null
  }

  const reminderBudget = resolveReminderBudget(params.summary, params.budget, params.estimator)
  const selection = selectRetainedSkillsWithinBudget({
    skills: params.retainedSkills,
    budget: reminderBudget,
    estimator: params.estimator,
    createdAt: params.summary.coveredUntil + 2
  })

  if (!selection.reminderMessage) {
    logRetentionSkipped(params.log, params.scope, 'retention_budget_exhausted', {
      reminderBudget,
      skippedSkillNames: selection.skippedSkillNames
    })
    return null
  }

  if (selection.skippedSkillNames.length > EMPTY) {
    logRetentionSkipped(params.log, params.scope, 'retention_budget_trimmed', {
      reminderBudget,
      selectedSkillNames: selection.selectedSkills.map(skill => skill.skillName),
      skippedSkillNames: selection.skippedSkillNames
    })
  }

  logRetentionInjected(params.log, params.scope, {
    selectedSkillNames: selection.selectedSkills.map(skill => skill.skillName),
    reminderChars: selection.reminderMessage.parts[0]?.type === 'text'
      ? selection.reminderMessage.parts[0].text.length
      : EMPTY,
    reminderTokens: selection.reminderTokens,
    reminderBudget
  })
  return selection.reminderMessage
}

function resolveReminderBudget(
  summary: SummaryRecord,
  budget: number,
  estimator: TokenEstimator
): number {
  const summaryBudget = estimator.countMessage(buildSummaryMessage(summary))
  const remainingBudget = Math.max(EMPTY, budget - summaryBudget)
  return Math.min(RETAINED_SKILL_BUDGET, remainingBudget)
}

function logNoSummarySkip(
  params: {
    scope: ContextLogScope
    log: (entry: ContextLogEntry) => void
  },
  skillNames: string[]
): void {
  if (skillNames.length === EMPTY) {
    return
  }
  logRetentionSkipped(params.log, params.scope, 'no_compacted_summary', {
    skillNames
  })
}

function buildSummaryMessage(summary: SummaryRecord): AgentSessionMessage {
  return {
    role: 'assistant',
    parts: [{ type: 'text', text: `${SUMMARY_PREFIX}${summary.summary}` }],
    createdAt: summary.coveredUntil + ONE
  }
}

function getActiveTail(
  messages: AgentSessionMessage[],
  summary?: SummaryRecord | null
): AgentSessionMessage[] {
  const lastUserIndex = findLastUserIndex(messages)
  if (lastUserIndex === -1) return messages
  if (lastUserIndex === EMPTY && summary) {
    const firstUser = messages[0]
    if (!firstUser) return []
    const unsummarized = messages.slice(1).filter(message => message.createdAt > summary.coveredUntil)
    return [firstUser, ...unsummarized]
  }
  return messages.slice(lastUserIndex)
}

function findLastUserIndex(messages: AgentSessionMessage[]): number {
  for (let index = messages.length - 1; index >= EMPTY; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index
    }
  }
  return -1
}
