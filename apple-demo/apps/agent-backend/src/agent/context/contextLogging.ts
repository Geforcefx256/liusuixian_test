import type { ContextLogEntry } from './types.js'

export interface ContextLogScope {
  readonly userId: number
  readonly agentId: string
  readonly sessionId: string
}

type ContextLogger = (entry: ContextLogEntry) => void

export function logBudget(
  log: ContextLogger,
  contextWindow: number,
  params: {
    budget: number
    historyTokens: number
    messageCount: number
    promptTokens: number
  }
): void {
  log({
    level: 'info',
    message: 'context.budget',
    loggedAt: Date.now(),
    data: {
      budget: params.budget,
      historyTokens: params.historyTokens,
      messageCount: params.messageCount,
      promptTokens: params.promptTokens,
      contextWindow
    }
  })
}

export function logCompaction(
  log: ContextLogger,
  params: {
    auto: boolean
    prune: boolean
    compactionNeeded: boolean
    summaryUpdated: boolean
  }
): void {
  log({
    level: 'info',
    message: 'context.compaction',
    loggedAt: Date.now(),
    data: params
  })
}

export function logCompactionDetail(
  log: ContextLogger,
  detail: {
    activeTailStartIndex: number
    summaryCandidateCount: number
    newMessagesCount: number
    existingSummaryChars: number
  } | null,
  enabled: boolean
): void {
  if (!enabled || !detail) return
  log({
    level: 'info',
    message: 'context.compaction.detail',
    loggedAt: Date.now(),
    data: detail
  })
}

export function logSummaryDetail(
  log: ContextLogger,
  detail: {
    summaryInputChars: number
    summaryOutputChars: number
    summaryMaxTokens: number
    coveredUntil: number | null
  } | null,
  summaryUpdated: boolean,
  enabled: boolean
): void {
  if (!enabled || !detail) return
  log({
    level: 'info',
    message: 'context.summary.detail',
    loggedAt: Date.now(),
    data: {
      ...detail,
      summaryUpdated
    }
  })
}

export function logSelection(
  log: ContextLogger,
  selectedCount: number,
  selectedTokens: number
): void {
  log({
    level: 'info',
    message: 'context.selection',
    loggedAt: Date.now(),
    data: {
      selectedCount,
      selectedTokens
    }
  })
}

export function logRetentionExtracted(
  log: ContextLogger,
  scope: ContextLogScope,
  params: {
    scannedSkillContextMessages: number
    skippedInvalidSkillContextMessages: number
    skillNames: string[]
  }
): void {
  if (params.skillNames.length === 0) {
    logRetentionSkipped(log, scope, 'no_retained_skills', {
      scannedSkillContextMessages: params.scannedSkillContextMessages,
      skippedInvalidSkillContextMessages: params.skippedInvalidSkillContextMessages
    })
    return
  }

  log({
    level: 'info',
    message: 'skill.retention.extracted',
    loggedAt: Date.now(),
    data: {
      ...scope,
      scannedSkillContextMessages: params.scannedSkillContextMessages,
      skippedInvalidSkillContextMessages: params.skippedInvalidSkillContextMessages,
      skillCount: params.skillNames.length,
      skillNames: params.skillNames
    }
  })
}

export function logRetentionInjected(
  log: ContextLogger,
  scope: ContextLogScope,
  params: {
    selectedSkillNames: string[]
    reminderChars: number
    reminderTokens: number
    reminderBudget: number
  }
): void {
  log({
    level: 'info',
    message: 'skill.retention.injected',
    loggedAt: Date.now(),
    data: {
      ...scope,
      skillCount: params.selectedSkillNames.length,
      skillNames: params.selectedSkillNames,
      reminderChars: params.reminderChars,
      reminderTokens: params.reminderTokens,
      reminderBudget: params.reminderBudget
    }
  })
}

export function logRetentionSkipped(
  log: ContextLogger,
  scope: ContextLogScope,
  reason: string,
  data: Record<string, unknown> = {}
): void {
  log({
    level: 'info',
    message: 'skill.retention.skipped',
    loggedAt: Date.now(),
    data: {
      ...scope,
      reason,
      ...data
    }
  })
}
