import type { AgentSessionMessage, AgentSessionStore } from '../sessionStore.js'
import type { ProviderClient } from '../providerClient.js'
import type { AgentModelConfig, ModelCallMetrics } from '../types.js'
import { TokenEstimator } from './TokenEstimator.js'
import { MessageSelector } from './MessageSelector.js'
import { ConversationCompactor } from './ConversationCompactor.js'
import { pruneToolMessagesForBudget } from './pruneToolMessages.js'
import { filterReplayMessages } from '../interactionReplay.js'
import { buildContextMessagePool } from './contextMessagePool.js'
import type {
  ContextBuildParams,
  ContextBuildResult,
  ContextLogEntry,
  ContextManagerConfig,
  SummaryRecord,
  Tokenizer
} from './types.js'
import {
  logBudget,
  logCompaction,
  logCompactionDetail,
  logSelection,
  logSummaryDetail
} from './contextLogging.js'

const EMPTY = 0

export class ContextManager {
  private readonly estimator: TokenEstimator
  private readonly selector: MessageSelector
  private readonly compactor: ConversationCompactor

  constructor(
    tokenizer: Tokenizer,
    private readonly sessionStore: AgentSessionStore,
    private readonly providerClient: ProviderClient,
    private readonly config: ContextManagerConfig,
    private readonly log: (entry: ContextLogEntry) => void
  ) {
    this.estimator = new TokenEstimator(tokenizer)
    this.selector = new MessageSelector(this.estimator)
    this.compactor = new ConversationCompactor(providerClient)
  }

  async build(params: ContextBuildParams): Promise<ContextBuildResult> {
    const budgetInfo = this.computeBudget(params.systemPrompt, params.model)
    const historyTokens = this.estimator.countMessages(params.messages)
    logBudget(this.log, this.config.contextWindow, {
      budget: budgetInfo.budget,
      historyTokens,
      messageCount: params.messages.length,
      promptTokens: budgetInfo.promptTokens
    })

    const summaryRecord = await this.fetchSummaryRecord(params)
    const messagePool = buildContextMessagePool({
      messages: params.messages,
      summary: summaryRecord,
      budget: budgetInfo.budget,
      estimator: this.estimator,
      scope: {
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId
      },
      log: this.log
    })
    const prunedPool = this.config.prune
      ? pruneToolMessagesForBudget(messagePool.messages, this.estimator, budgetInfo.budget)
      : messagePool.messages
    const selected = this.selectMessages(
      prunedPool,
      budgetInfo.budget,
      messagePool.hasSummary,
      messagePool.fixedPrefixCount
    )

    return {
      messages: selected.messages,
      estimatedTokens: selected.estimatedTokens,
      budget: budgetInfo.budget,
      summaryUpdated: false
    }
  }

  async handleAssistantStep(params: {
    userId: number
    agentId: string
    sessionId: string
    assistantMessageId: number
    model: AgentModelConfig
    metrics: ModelCallMetrics
  }): Promise<void> {
    const overflow = this.shouldCompactFromMetrics(params.model, params.metrics)
    await this.sessionStore.updateMessageMeta({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      messageId: params.assistantMessageId,
      meta: {
        model: {
          provider: params.model.provider,
          modelName: params.model.modelName
        },
        usage: {
          inputTokens: params.metrics.inputTokens,
          outputTokens: params.metrics.outputTokens,
          totalTokens: params.metrics.totalTokens,
          cacheReadTokens: params.metrics.cacheReadTokens,
          cacheWriteTokens: params.metrics.cacheWriteTokens
        },
        finishReason: params.metrics.finishReason,
        compaction: {
          checkedAt: Date.now(),
          overflow,
          applied: false
        }
      }
    })

    if (!overflow || !this.config.auto) {
      return
    }

    const summaryUpdated = await this.compactSession({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      model: params.model
    })

    await this.sessionStore.updateMessageMeta({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      messageId: params.assistantMessageId,
      meta: {
        model: {
          provider: params.model.provider,
          modelName: params.model.modelName
        },
        usage: {
          inputTokens: params.metrics.inputTokens,
          outputTokens: params.metrics.outputTokens,
          totalTokens: params.metrics.totalTokens,
          cacheReadTokens: params.metrics.cacheReadTokens,
          cacheWriteTokens: params.metrics.cacheWriteTokens
        },
        finishReason: params.metrics.finishReason,
        compaction: {
          checkedAt: Date.now(),
          overflow,
          applied: summaryUpdated || overflow
        }
      }
    })
  }

  private async compactSession(params: {
    userId: number
    agentId: string
    sessionId: string
    model: AgentModelConfig
  }): Promise<boolean> {
    const messages = filterReplayMessages(await this.sessionStore.listMessages(params))
    const summaryRecord = await this.fetchSummaryRecord(params)
    const compacted = await this.compactor.compact({
      messages,
      existingSummary: summaryRecord,
      model: params.model,
      summaryMaxTokens: this.config.summaryMaxTokens
    })

    logCompaction(this.log, {
      auto: this.config.auto,
      prune: this.config.prune,
      compactionNeeded: true,
      summaryUpdated: compacted.updated
    })
    logCompactionDetail(this.log, compacted.detail, this.config.logDetail)
    logSummaryDetail(this.log, compacted.detail, compacted.updated, this.config.logDetail)

    if (compacted.updated && compacted.summary) {
      await this.sessionStore.upsertSummary({
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId,
        summary: compacted.summary.summary,
        coveredUntil: compacted.summary.coveredUntil
      })
    }
    return compacted.updated
  }

  private computeBudget(
    systemPrompt: string,
    model: AgentModelConfig
  ): { budget: number; promptTokens: number } {
    const promptTokens = this.estimator.countText(systemPrompt)
    const available = this.computeUsablePromptTokens(model) - promptTokens
    if (available <= EMPTY) {
      return { budget: EMPTY, promptTokens }
    }
    return { budget: Math.floor(available), promptTokens }
  }

  private shouldCompactFromMetrics(model: AgentModelConfig, metrics: ModelCallMetrics): boolean {
    const usable = this.computeUsablePromptTokens(model)
    if (usable <= EMPTY) return false
    return metrics.inputTokens >= usable
  }

  private computeUsablePromptTokens(model: AgentModelConfig): number {
    if (typeof model.inputLimit === 'number') {
      return Math.max(EMPTY, Math.floor(model.inputLimit))
    }
    const reservedOutputTokens = Math.max(EMPTY, Math.floor(model.maxTokens ?? EMPTY))
    return Math.max(EMPTY, this.config.contextWindow - reservedOutputTokens)
  }

  private async fetchSummaryRecord(params: {
    userId: number
    agentId: string
    sessionId: string
  }): Promise<SummaryRecord | null> {
    return this.sessionStore.getSummary({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId
    })
  }

  private selectMessages(
    messagePool: AgentSessionMessage[],
    budget: number,
    hasSummary: boolean,
    fixedPrefixCount: number
  ): { messages: AgentSessionMessage[]; estimatedTokens: number } {
    if (!hasSummary) {
      const selected = this.selector.selectWithinBudget({ messages: messagePool, budget })
      if (messagePool.length > EMPTY && selected.selected.length === EMPTY) {
        throw new Error('Context budget too small to include any message.')
      }
      logSelection(this.log, selected.selected.length, selected.estimatedTokens)
      return { messages: selected.selected, estimatedTokens: selected.estimatedTokens }
    }

    const fixedPrefix = messagePool.slice(0, fixedPrefixCount)
    if (fixedPrefix.length === EMPTY) {
      return { messages: [], estimatedTokens: EMPTY }
    }
    const fixedPrefixTokens = this.estimator.countMessages(fixedPrefix)
    if (fixedPrefixTokens > budget) {
      throw new Error(fixedPrefixCount > 1
        ? 'Context budget too small to include retained reminder.'
        : 'Context budget too small to include summary message.')
    }
    const tail = messagePool.slice(fixedPrefixCount)
    const selectedTail = this.selector.selectWithinBudget({
      messages: tail,
      budget: budget - fixedPrefixTokens
    })
    const selectedMessages = [...fixedPrefix, ...selectedTail.selected]
    const estimatedTokens = fixedPrefixTokens + selectedTail.estimatedTokens
    logSelection(this.log, selectedMessages.length, estimatedTokens)
    return {
      messages: selectedMessages,
      estimatedTokens
    }
  }
}
