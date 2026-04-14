import type { ToolCallMetrics } from './types.js'
import type {
  AgentLoopDependencies,
  AgentLoopResult,
  AgentLoopRunParams,
  AgentSessionMessage,
  AgentSessionPart
} from './loopTypes.js'
import { toLoopTools } from './loopTypes.js'
import { AgentExecutionError } from './executionErrors.js'
import {
  addModelMetricsAggregate,
  assertStepWithinLimit,
  createModelMetricsAggregate
} from './agentLoopUtils.js'
import { AgentLoopToolRunner, type AgentLoopRecoveryState } from './agentLoopToolRunner.js'
import { isModelRequestError } from './modelRequestError.js'
import type { ToolFailurePolicyConfig } from './toolFailurePolicy.js'
import { buildLogPreview } from '../support/logPreview.js'
import { filterReplayMessages } from './interactionReplay.js'
import { createLogger } from '../logging/index.js'
import type { ToolDisplayNameResolver } from './toolInvocationSignal.js'
import {
  createIntermediateAttributes,
  describeHiddenMessageAttributes,
  isHiddenSessionMessage
} from './sessionMessages.js'
import { normalizeToolDisplayName, resolveTriggeredSkillName } from './toolInvocationSignal.js'
import type { AgentSessionMessageAttributes } from './sessionStoreTypes.js'

const agentLoopLogger = createLogger({
  category: 'runtime',
  component: 'agent_loop'
})

export class AgentLoop {
  private readonly toolRunner: AgentLoopToolRunner
  private readonly displayNameResolver?: ToolDisplayNameResolver

  constructor(
    private readonly dependencies: AgentLoopDependencies,
    private readonly options: {
      logDetail?: boolean
      toolFailurePolicy?: ToolFailurePolicyConfig
      displayNameResolver?: ToolDisplayNameResolver
    } = {}
  ) {
    this.displayNameResolver = this.options.displayNameResolver
    this.toolRunner = new AgentLoopToolRunner(
      this.dependencies.toolRegistry,
      this.dependencies.sessionStore,
      {
        logDetail: this.options.logDetail,
        policy: this.options.toolFailurePolicy,
        displayNameResolver: this.options.displayNameResolver
      }
    )
  }

  async run(params: AgentLoopRunParams): Promise<AgentLoopResult> {
    await this.appendUserMessage(params)
    const toolMetrics: ToolCallMetrics[] = []
    const toolDefinitions = this.loadTools(params)
    let modelMetrics = undefined as AgentLoopResult['modelMetrics'] | undefined
    let modelMetricsAggregate = createModelMetricsAggregate()
    let recoveryState: AgentLoopRecoveryState = { activeChain: null }
    let skillTriggered: string | undefined
    let stepCount = 0

    while (true) {
      stepCount += 1
      assertStepWithinLimit(stepCount, params.loop.maxSteps)
      const messages = await this.loadMessages(params)
      logLoopInput(params, stepCount, messages, Boolean(this.options.logDetail))
      const response = await this.completeModelStep({
        params,
        messages,
        tools: Array.from(toolDefinitions.values()),
        modelMetricsAggregate
      })
      modelMetrics = response.metrics
      modelMetricsAggregate = addModelMetricsAggregate(modelMetricsAggregate, response.metrics)

      if (response.toolCalls.length === 0) {
        const assistantMessageId = await this.appendAssistantMessage(params, toTextParts(response.text), {
          reasoning: response.reasoning || undefined
        })
        if (params.onAssistantStepComplete) {
          await params.onAssistantStepComplete({ assistantMessageId, metrics: response.metrics })
        }
        return {
          text: response.text,
          assistantMessageId,
          modelMetrics,
          modelMetricsAggregate,
          toolMetrics,
          finalOutputMeta: {
            source: 'assistant',
            structuredHint: 'none'
          },
          skillTriggered
        }
      }

      const toolExecution = await this.toolRunner.run({
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId,
        allowedSkillIds: params.allowedSkillIds,
        toolCalls: response.toolCalls,
        toolDefinitions,
        trace: params.trace,
        recoveryState,
        onToolStarted: params.onToolStarted
      })
      if (toolExecution.toolFailureSignal) {
        params.onToolFailed?.(toolExecution.toolFailureSignal)
      }
      if (toolExecution.skillTriggered) {
        skillTriggered = toolExecution.skillTriggered
      }
      toolMetrics.push(...toolExecution.metrics)
      if (toolExecution.shortCircuit) {
        if (
          toolExecution.shortCircuit.supersededAssistantMessageIds?.length
          && this.dependencies.sessionStore.deleteMessages
        ) {
          await this.dependencies.sessionStore.deleteMessages({
            userId: params.userId,
            agentId: params.agentId,
            sessionId: params.sessionId,
            messageIds: toolExecution.shortCircuit.supersededAssistantMessageIds
          })
        }
        const assistantMessageId = await this.appendAssistantMessage(params, toolExecution.shortCircuit.parts, {
          reasoning: response.reasoning || undefined
        })
        await this.appendInjectedMessages(params, toolExecution.injectedMessages, assistantMessageId)
        if (params.onAssistantStepComplete) {
          await params.onAssistantStepComplete({ assistantMessageId, metrics: response.metrics })
        }
        return {
          text: toolExecution.shortCircuit.text,
          assistantMessageId,
          structuredOutput: toolExecution.shortCircuit.structuredOutput,
          awaitingInteraction: toolExecution.shortCircuit.awaitingInteraction,
          modelMetrics,
          modelMetricsAggregate,
          toolMetrics,
          finalOutputMeta: toolExecution.shortCircuit.finalOutputMeta,
          skillTriggered
        }
      }
      const assistantMessageId = await this.appendAssistantMessage(
        params,
        [
          ...toTextParts(response.text),
          ...toolExecution.toolParts
        ],
        {
          reasoning: response.reasoning || undefined,
          attributes: createIntermediateAttributes(
            toolExecution.toolParts
              .filter((part): part is Extract<AgentSessionPart, { type: 'tool' }> => part.type === 'tool')
              .map(part => this.resolveToolDisplayName(params.agentId, part.name, part.input))
          )
        }
      )
      await this.appendInjectedMessages(params, toolExecution.injectedMessages, assistantMessageId)
      if (params.onAssistantStepComplete) {
        await params.onAssistantStepComplete({ assistantMessageId, metrics: response.metrics })
      }
      if (toolExecution.toolError) {
        throw toolExecution.toolError
      }
      recoveryState = attachAssistantMessageToRecoveryState(toolExecution.recoveryState, assistantMessageId)
    }
  }

  private async completeModelStep(params: {
    params: AgentLoopRunParams
    messages: AgentSessionMessage[]
    tools: ReturnType<typeof toLoopTools>
    modelMetricsAggregate: AgentLoopResult['modelMetricsAggregate']
  }) {
    try {
      return await this.dependencies.providerClient.completeWithTools({
        systemPrompt: params.params.systemPrompt,
        messages: params.messages,
        tools: params.tools,
        model: params.params.model,
        signal: params.params.signal,
        trace: params.params.trace
      })
    } catch (error) {
      if (!isModelRequestError(error)) {
        throw error
      }
      throw new AgentExecutionError({
        cause: error,
        modelMetricsAggregate: addModelMetricsAggregate(params.modelMetricsAggregate, error.metrics)
      })
    }
  }

  private async appendUserMessage(params: AgentLoopRunParams): Promise<void> {
    if (!params.userInput.trim()) {
      return
    }
    await this.dependencies.sessionStore.appendMessage({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: params.userInput }],
        createdAt: Date.now()
      }
    })
  }

  private async appendAssistantMessage(
    params: Pick<AgentLoopRunParams, 'userId' | 'agentId' | 'sessionId'>,
    parts: AgentSessionPart[],
    options: {
      createdAt?: number
      attributes?: AgentSessionMessageAttributes
      reasoning?: string
    } = {}
  ): Promise<number> {
    return this.dependencies.sessionStore.appendMessage({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      message: {
        role: 'assistant',
        parts,
        createdAt: options.createdAt ?? Date.now(),
        ...(options.reasoning ? { reasoning: options.reasoning } : {}),
        ...(options.attributes ? { attributes: options.attributes } : {})
      }
    })
  }

  private resolveToolDisplayName(
    agentId: string,
    tool: string,
    input: Record<string, unknown>
  ): string {
    return this.displayNameResolver?.({
      tool,
      skillName: tool.trim() === 'skill:skill' ? resolveTriggeredSkillName({
        id: '',
        name: tool,
        input
      }) || undefined : undefined,
      agentId
    }) || normalizeToolDisplayName(tool)
  }

  private async appendInjectedMessages(
    params: Pick<AgentLoopRunParams, 'userId' | 'agentId' | 'sessionId'>,
    messages: AgentSessionMessage[],
    assistantMessageId: number
  ): Promise<void> {
    if (messages.length === 0) {
      return
    }
    const baseCreatedAt = Date.now()
    for (const [index, message] of messages.entries()) {
      await this.dependencies.sessionStore.appendMessage({
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId,
        message: {
          ...message,
          createdAt: baseCreatedAt + index + 1
        }
      })
    }
    agentLoopLogger.info({
      message: 'tool side effects persisted',
      context: {
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId
      },
      data: {
        assistantMessageId,
        injectedMessageCount: messages.length,
        injectedMessages: messages.map(message => summarizeSessionMessage(message, false))
      }
    })
  }

  private async loadMessages(params: AgentLoopRunParams): Promise<AgentSessionMessage[]> {
    const history = await this.dependencies.sessionStore.listMessages({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId
    })
    let messages = filterReplayMessages(history)
    messages = insertFileContextMessage(messages, params.fileContextMessage ?? null)
    logLoopMessages(params, 'pre_context_manager', messages, Boolean(this.options.logDetail))
    if (!params.messageProvider) {
      return messages
    }
    messages = await params.messageProvider({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      systemPrompt: params.systemPrompt,
      model: params.model,
      messages,
      fileContextMessage: params.fileContextMessage
    })
    logLoopMessages(params, 'post_context_manager', messages, Boolean(this.options.logDetail))
    return messages
  }

  private loadTools(params: Pick<AgentLoopRunParams, 'agentId' | 'model' | 'allowedSkillIds'>) {
    const catalog = this.dependencies.toolRegistry.catalog({
      provider: params.model.provider,
      agentId: params.agentId,
      allowedSkillIds: params.allowedSkillIds
    })
    return new Map(toLoopTools(catalog.tools).map(tool => [tool.id, tool]))
  }
}

function toTextParts(text: string): Array<{ type: 'text'; text: string }> {
  if (!text.trim()) {
    return []
  }
  return [{ type: 'text', text }]
}

function insertFileContextMessage(
  history: AgentSessionMessage[],
  contextMessage: AgentSessionMessage | null
): AgentSessionMessage[] {
  if (!contextMessage) {
    return history
  }
  if (history.length <= 1) {
    return [...history, contextMessage]
  }
  return [history[0]!, contextMessage, ...history.slice(1)]
}

function attachAssistantMessageToRecoveryState(
  recoveryState: AgentLoopRecoveryState,
  assistantMessageId: number
): AgentLoopRecoveryState {
  if (!recoveryState.activeChain) {
    return recoveryState
  }
  return {
    activeChain: {
      ...recoveryState.activeChain,
      assistantMessageIds: Array.from(new Set([
        ...(recoveryState.activeChain.assistantMessageIds || []),
        assistantMessageId
      ]))
    }
  }
}

function logLoopInput(
  params: Pick<AgentLoopRunParams, 'trace'>,
  step: number,
  messages: AgentSessionMessage[],
  logDetail: boolean
): void {
  agentLoopLogger.info({
    message: 'llm input prepared',
    context: {
      runId: params.trace.runId,
      turnId: params.trace.turnId
    },
    data: {
      step,
      messageCount: messages.length,
      messages: messages.map(message => summarizeSessionMessage(message, logDetail))
    }
  })
}

function logLoopMessages(
  params: Pick<AgentLoopRunParams, 'trace'>,
  stage: 'pre_context_manager' | 'post_context_manager',
  messages: AgentSessionMessage[],
  logDetail: boolean
): void {
  agentLoopLogger.info({
    message: stage,
    context: {
      runId: params.trace.runId,
      turnId: params.trace.turnId
    },
    data: {
      messageCount: messages.length,
      messages: messages.map(message => summarizeSessionMessage(message, logDetail))
    }
  })
}

function summarizeSessionMessage(
  message: AgentSessionMessage,
  logDetail: boolean
): Record<string, unknown> {
  const hiddenAttributes = describeHiddenMessageAttributes(message.attributes)
  return {
    role: message.role,
    attributes: hiddenAttributes ?? undefined,
    parts: message.parts.map(part => summarizeSessionPart(part, logDetail, isHiddenSessionMessage(message)))
  }
}

function summarizeSessionPart(
  part: AgentSessionPart,
  logDetail: boolean,
  hidden: boolean
): Record<string, unknown> {
  if (part.type === 'text') {
    return {
      type: 'text',
      textChars: part.text.length,
      textPreview: buildLogPreview(part.text, {
        disableTruncation: hidden ? false : logDetail,
        maxChars: hidden ? 160 : undefined
      })
    }
  }

  if (part.type === 'structured') {
    if (part.kind === 'protocol') {
      return {
        type: 'structured',
        kind: 'protocol',
        componentCount: Array.isArray(part.protocol.components) ? part.protocol.components.length : 0,
        actionCount: Array.isArray(part.protocol.actions) ? part.protocol.actions.length : 0
      }
    }

    return {
      type: 'structured',
      kind: 'domain-result',
      resultKind: part.domainResult.kind
    }
  }

  return {
    type: 'tool',
    id: part.id,
    name: part.name,
    status: part.status,
    compressed: part.compressed ?? false,
    outputChars: part.output.length,
    outputPreview: buildLogPreview(part.output, {
      disableTruncation: logDetail
    })
  }
}
