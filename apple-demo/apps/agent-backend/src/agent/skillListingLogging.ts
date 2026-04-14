import type { AgentRunRequest, TraceContext } from './types.js'
import type { SkillListingBuildResult } from './skillListing.js'
import { createLogger } from '../logging/index.js'

const skillListingLogger = createLogger({
  category: 'model',
  component: 'chat_orchestrator'
})

export function emitSkillListingLogs(
  request: AgentRunRequest,
  trace: TraceContext | undefined,
  listing: SkillListingBuildResult
): void {
  const context = toSkillListingLogContext(request, trace)
  skillListingLogger.info({
    message: 'skill_listing_built',
    context,
    data: toSkillListingLogData(listing)
  })
  for (const entry of listing.entries) {
    emitTrimmedLog(context, listing, entry)
    emitSkippedLog(context, listing, entry)
  }
  skillListingLogger.info({
    message: 'skill_listing_injected',
    context,
    data: {
      discoveryMode: listing.discoveryMode,
      budgetChars: listing.budgetChars,
      entryBudgetChars: listing.entryBudgetChars,
      sourceSkillCount: listing.sourceSkillCount,
      includedSkillCount: listing.includedSkillCount,
      trimmedSkillCount: listing.trimmedSkillCount,
      skippedSkillCount: listing.skippedSkillCount,
      listingChars: listing.totalCharsAfterBudget,
      injectionSurface: 'conversation_message'
    }
  })
}

function emitTrimmedLog(
  context: ReturnType<typeof toSkillListingLogContext>,
  listing: SkillListingBuildResult,
  entry: SkillListingBuildResult['entries'][number]
): void {
  if (entry.trimMode === 'none') {
    return
  }
  skillListingLogger.info({
    message: 'skill_listing_entry_trimmed',
    context,
    data: {
      discoveryMode: listing.discoveryMode,
      budgetChars: listing.budgetChars,
      entryBudgetChars: listing.entryBudgetChars,
      skillId: entry.skillId,
      skillName: entry.skillName,
      trimMode: entry.trimMode,
      beforeChars: entry.beforeChars,
      afterChars: entry.afterChars
    }
  })
}

function emitSkippedLog(
  context: ReturnType<typeof toSkillListingLogContext>,
  listing: SkillListingBuildResult,
  entry: SkillListingBuildResult['entries'][number]
): void {
  if (entry.status !== 'skipped') {
    return
  }
  skillListingLogger.info({
    message: 'skill_listing_entry_skipped',
    context,
    data: {
      discoveryMode: listing.discoveryMode,
      budgetChars: listing.budgetChars,
      entryBudgetChars: listing.entryBudgetChars,
      skillId: entry.skillId,
      skillName: entry.skillName,
      skippedReason: entry.skippedReason,
      beforeChars: entry.beforeChars
    }
  })
}

function toSkillListingLogContext(
  request: AgentRunRequest,
  trace: TraceContext | undefined
): {
  userId: number
  agentId: string
  sessionId: string
  runId?: string
  turnId?: string
} {
  return {
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    runId: trace?.runId,
    turnId: trace?.turnId
  }
}

function toSkillListingLogData(listing: SkillListingBuildResult): Record<string, unknown> {
  return {
    discoveryMode: listing.discoveryMode,
    budgetChars: listing.budgetChars,
    entryBudgetChars: listing.entryBudgetChars,
    sourceSkillCount: listing.sourceSkillCount,
    includedSkillCount: listing.includedSkillCount,
    trimmedSkillCount: listing.trimmedSkillCount,
    skippedSkillCount: listing.skippedSkillCount,
    totalCharsBeforeBudget: listing.totalCharsBeforeBudget,
    totalCharsAfterBudget: listing.totalCharsAfterBudget
  }
}
