import { inspect } from 'node:util'
import type { AgentRunRequest, ModelCallMetrics, TraceContext } from './types.js'
import type { AgentSessionMessage, AgentSessionStore } from './sessionStore.js'
import { ProviderClient } from './providerClient.js'
import { AgentLoop } from './agentLoop.js'
import type { ToolCallMetrics } from './types.js'
import { parseProtocolOutput } from './protocolOutput.js'
import type { StructuredOutput } from './structuredOutput.js'
import { ContextManager } from './context/ContextManager.js'
import type { ContextLogEntry, ContextManagerConfig, Tokenizer } from './context/types.js'
import type { ToolFailureSignal, ToolInvocationSignal } from './loopTypes.js'
import { toInteractionView } from './interactions.js'
import { buildSkillListingReminder } from './skillListing.js'
import { emitSkillListingLogs } from './skillListingLogging.js'
import { createLogger } from '../logging/index.js'

const chatOrchestratorLogger = createLogger({
  category: 'model',
  component: 'chat_orchestrator'
})

interface ChatOrchestratorParams {
  request: AgentRunRequest
  signal: AbortSignal
  trace: TraceContext
  emitContextLog?: (entry: ContextLogEntry) => void
  onToolStarted?: (signal: ToolInvocationSignal) => void
  onToolFailed?: (signal: ToolFailureSignal) => void
}

export interface ChatOrchestratorResult {
  mode: 'llm'
  text: string
  protocol?: Record<string, unknown>
  structuredOutput?: StructuredOutput
  awaitingInteraction?: ReturnType<typeof toInteractionView>
  assistantMessageId: number
  continuationOfInteractionId?: string
  modelMetrics?: ModelCallMetrics
  modelMetricsAggregate?: {
    calls: number
    latencyMs: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  toolMetrics?: ToolCallMetrics[]
  skillTriggered?: string
}

interface ChatOrchestratorOptions {
  maxSteps: number
  tokenizer: Tokenizer
  defaultContextWindow: number
  contextConfig: Omit<ContextManagerConfig, 'contextWindow'>
}

export class ChatOrchestrator {
  constructor(
    private readonly providerClient: ProviderClient,
    private readonly agentLoop: AgentLoop,
    private readonly sessionStore: AgentSessionStore,
    private readonly options: ChatOrchestratorOptions
  ) {}

  async execute(params: ChatOrchestratorParams): Promise<ChatOrchestratorResult> {
    return this.executeModel(params)
  }

  private async executeModel(params: ChatOrchestratorParams): Promise<ChatOrchestratorResult> {
    const { request, signal, trace } = params
    if (!request.model) {
      throw new Error('Missing model configuration')
    }
    const continuationInteraction = request.continuation
      ? await this.sessionStore.getInteraction({
          userId: request.userId,
          agentId: request.agentId,
          sessionId: request.sessionId,
          interactionId: request.continuation.interactionId
        })
      : null
    if (request.continuation && !continuationInteraction) {
      throw new Error(`Interaction not found: ${request.continuation.interactionId}`)
    }
    if (continuationInteraction && !continuationInteraction.continuationContext) {
      throw new Error(`Interaction is not ready for continuation: ${continuationInteraction.interactionId}`)
    }
    chatOrchestratorLogger.info({
      message: 'model invocation prepared',
      context: {
        userId: request.userId,
        agentId: request.agentId,
        sessionId: request.sessionId,
        runId: trace.runId,
        turnId: trace.turnId
      },
      data: {
        payload: formatInvocationLog(request)
      }
    })
    const systemPrompt = this.buildSystemPrompt(request, trace)
    this.logSystemPrompt(request, trace, systemPrompt)
    const skillReminderMessage = buildSkillListingReminderMessage(request, trace)
    const fileContextMessage = buildFileContextMessage(request.invocationContext)
    const contextManager = createContextManager({
      tokenizer: this.options.tokenizer,
      sessionStore: this.sessionStore,
      providerClient: this.providerClient,
      config: buildContextConfig(this.options, request.model),
      emitContextLog: params.emitContextLog
    })

    const execution = await this.agentLoop.run({
      userId: request.userId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      userInput: continuationInteraction ? '' : request.input,
      systemPrompt,
      fileContextMessage,
      allowedSkillIds: request.allowedSkillIds,
      messageProvider: async (providerParams) => {
        const messages = insertRuntimeReminderMessage(
          providerParams.messages,
          skillReminderMessage,
          providerParams.fileContextMessage
        )
        const result = await contextManager.build({
          userId: providerParams.userId,
          agentId: providerParams.agentId,
          sessionId: providerParams.sessionId,
          systemPrompt: providerParams.systemPrompt,
          messages,
          model: providerParams.model
        })
        return result.messages
      },
      model: request.model,
      loop: {
        maxSteps: this.options.maxSteps
      },
      onAssistantStepComplete: async step => {
        await contextManager.handleAssistantStep({
          userId: request.userId,
          agentId: request.agentId,
          sessionId: request.sessionId,
          assistantMessageId: step.assistantMessageId,
          model: request.model!,
          metrics: step.metrics
        })
      },
      onToolStarted: params.onToolStarted,
      onToolFailed: params.onToolFailed,
      signal,
      trace
    })

    return {
      mode: 'llm',
      text: execution.text,
      protocol: execution.structuredOutput?.kind === 'protocol'
        ? execution.structuredOutput.protocol
        : (parseProtocolOutput(execution.text).protocol || undefined),
      structuredOutput: execution.structuredOutput,
      awaitingInteraction: execution.awaitingInteraction,
      assistantMessageId: execution.assistantMessageId,
      continuationOfInteractionId: continuationInteraction?.interactionId,
      modelMetrics: execution.modelMetrics,
      modelMetricsAggregate: execution.modelMetricsAggregate,
      toolMetrics: execution.toolMetrics,
      skillTriggered: execution.skillTriggered
    }
  }

  private buildSystemPrompt(request: AgentRunRequest, _trace: TraceContext): string {
    const sections: string[] = []
    if (request.agentDefinition) {
      sections.push(`# ${request.agentDefinition.name}`)
      if (request.agentDefinition.description) sections.push(request.agentDefinition.description)
      if (request.agentDefinition.instructions) {
        sections.push('## Agent Instructions')
        sections.push(request.agentDefinition.instructions)
      }
      if (request.agentDefinition.contextTemplate) {
        sections.push('## Context Template')
        sections.push(request.agentDefinition.contextTemplate)
      }
    }
    return sections.join('\n\n')
  }

  private logSystemPrompt(request: AgentRunRequest, trace: TraceContext, systemPrompt: string): void {
    if (!this.options.contextConfig.logDetail) {
      return
    }
    chatOrchestratorLogger.info({
      message: 'system prompt prepared',
      context: {
        userId: request.userId,
        agentId: request.agentId,
        sessionId: request.sessionId,
        runId: trace.runId,
        turnId: trace.turnId
      },
      data: {
        chars: systemPrompt.length,
        executionPhase: request.executionPhase || 'default',
        systemPrompt
      }
    })
  }
}

function createContextManager(params: {
  tokenizer: Tokenizer
  sessionStore: AgentSessionStore
  providerClient: ProviderClient
  config: ContextManagerConfig
  emitContextLog?: (entry: ContextLogEntry) => void
}): ContextManager {
  const log = (entry: ContextLogEntry) => params.emitContextLog?.(entry)
  return new ContextManager(
    params.tokenizer,
    params.sessionStore,
    params.providerClient,
    params.config,
    log
  )
}

function buildContextConfig(
  options: ChatOrchestratorOptions,
  model: AgentRunRequest['model'] | null
): ContextManagerConfig {
  return {
    contextWindow: model?.contextWindow || options.defaultContextWindow,
    auto: options.contextConfig.auto,
    prune: options.contextConfig.prune,
    summaryMaxTokens: options.contextConfig.summaryMaxTokens,
    logDetail: options.contextConfig.logDetail
  }
}

function formatInvocationLog(request: AgentRunRequest): string {
  const activeFile = request.invocationContext?.activeFile || null
  const payload = {
    sessionId: request.sessionId,
    activeFile
  }
  return inspect(payload, { depth: null })
}

export function buildSkillListingReminderMessage(
  request: AgentRunRequest,
  trace?: TraceContext
): AgentSessionMessage | null {
  if (request.executionPhase !== 'executor') {
    return null
  }
  const listing = buildSkillListingReminder({
    skills: request.availableSkills || []
  })
  emitSkillListingLogs(request, trace, listing)
  return {
    role: 'user',
    parts: [{ type: 'text', text: listing.reminder }],
    createdAt: 0
  }
}

function insertRuntimeReminderMessage(
  messages: AgentSessionMessage[],
  reminderMessage: AgentSessionMessage | null,
  fileContextMessage?: AgentSessionMessage | null
): AgentSessionMessage[] {
  if (!reminderMessage) {
    return messages
  }
  if (messages.length === 0) {
    return [reminderMessage]
  }
  if (fileContextMessage && messages[messages.length - 1] === fileContextMessage) {
    return [
      ...messages.slice(0, -1),
      reminderMessage,
      fileContextMessage
    ]
  }
  const lastUserIndex = findLastUserMessageIndex(messages)
  if (lastUserIndex < 0) {
    return [...messages, reminderMessage]
  }
  return [
    ...messages.slice(0, lastUserIndex + 1),
    reminderMessage,
    ...messages.slice(lastUserIndex + 1)
  ]
}

function findLastUserMessageIndex(messages: AgentSessionMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index
    }
  }
  return -1
}

function buildFileContextMessage(
  invocationContext: AgentRunRequest['invocationContext']
): AgentSessionMessage | null {
  const activeFile = invocationContext?.activeFile || null
  if (!activeFile) return null
  const lines = ['[FILE CONTEXT]']
  lines.push(
    `PRIMARY_FILE: path=${activeFile.path} | file_name=${activeFile.fileName} | source=${activeFile.source} | writable=${activeFile.writable}`
  )
  lines.push('Use workspace-relative paths only with local:* tools. If you do not know a workspace path yet, call local:find_files first.')
  lines.push('If you need files that belong to a loaded skill package, use skill:find_assets, skill:read_asset, or skill:list_assets instead.')
  return {
    role: 'user',
    parts: [{ type: 'text', text: lines.join('\n') }],
    createdAt: Date.now()
  }
}
