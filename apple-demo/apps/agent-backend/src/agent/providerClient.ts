import type { AgentModelConfig, ModelCallMetrics, TraceContext } from './types.js'
import type {
  AgentLoopToolCall,
  CompleteWithToolsRequest,
  CompleteWithToolsResponse
} from './loopTypes.js'
import {
  buildFailedModelCallMetrics,
  buildModelRequestError,
  isModelRequestError,
  type ModelRequestCauseDiagnostic,
  type ModelRequestDiagnostics,
  type ModelRequestFailureKind,
  type ModelRequestStreamStage
} from './modelRequestError.js'
import {
  buildStreamInterruptionErrorMessage,
  buildWatchdogTimeoutMessage,
  readOpenAiStreamingResponse
} from './providerStream.js'
import { getToolParts } from './sessionParts.js'
import { buildLogPreview } from '../support/logPreview.js'
import { createLogger } from '../logging/index.js'

interface ProviderClientRequest {
  systemPrompt: string
  input: string
  model: AgentModelConfig
  signal: AbortSignal
  trace: TraceContext
}

interface OpenAiToolCallPayload {
  id?: string
  function?: { name?: string; arguments?: string }
}

type OpenAiMessageContent = string | Array<{ type?: string; text?: string }>

interface OpenAiChoicePayload {
  finish_reason?: string | null
  message?: {
    content?: OpenAiMessageContent
    reasoning_content?: string
    tool_calls?: OpenAiToolCallPayload[]
  }
}

interface OpenAiCompletionPayload {
  choices?: OpenAiChoicePayload[]
  usage?: OpenAiUsagePayload
}

interface OpenAiUsagePayload {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: {
    cached_tokens?: number
  }
  completion_tokens_details?: {
    cached_tokens?: number
  }
}

const MAX_ERROR_BODY_CHARS = 2000
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com'
const OPENAI_CHAT_COMPLETIONS_PATH = '/v1/chat/completions'
const ARK_CODING_CHAT_COMPLETIONS_PATH = '/chat/completions'
const DEFAULT_STREAM_FIRST_BYTE_TIMEOUT_MS = 30000
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000
const MAX_CAUSE_CHAIN_DEPTH = 5
const ZERO = 0

const permissiveToolSchema = {
  type: 'object',
  properties: {},
  additionalProperties: true
}

const providerLogger = createLogger({
  category: 'model',
  component: 'provider_client'
})

function buildRequestBody(
  model: AgentModelConfig,
  messages: unknown[],
  tools: unknown[] | undefined
): Record<string, unknown> {
  const { body, streamOptions } = splitCustomBody(model)
  const thinkingEnabled = model.thinking?.enabled === true
  const requestBody = {
    model: model.modelName,
    messages,
    tools,
    max_tokens: model.maxTokens ?? 2048,
    ...(thinkingEnabled ? {} : buildSamplingRequestParams(model)),
    ...body,
    ...(thinkingEnabled ? buildThinkingRequestParams(model) : {}),
    stream: usesStreamingResponse(model)
  }
  if (!usesStreamingResponse(model)) {
    return requestBody
  }
  return {
    ...requestBody,
    stream_options: {
      ...streamOptions,
      include_usage: true
    }
  }
}

function buildThinkingRequestParams(model: AgentModelConfig): Record<string, unknown> {
  if (model.provider === 'huaweiHisApi') {
    return {
      chat_template_kwargs: { enable_thinking: true }
    }
  }
  return {
    thinking: { type: 'enabled' }
  }
}

function splitCustomBody(model: AgentModelConfig): {
  body: Record<string, unknown>
  streamOptions: Record<string, unknown>
} {
  const customBody = model.custom?.body || {}
  const { stream_options: rawStreamOptions, stream: _ignoredStream, ...body } = customBody
  const streamOptions = (
    rawStreamOptions
    && typeof rawStreamOptions === 'object'
    && !Array.isArray(rawStreamOptions)
  )
    ? rawStreamOptions as Record<string, unknown>
    : {}
  return { body, streamOptions }
}

function usesStreamingResponse(model: AgentModelConfig): boolean {
  return model.stream !== false
}

function buildSamplingRequestParams(model: AgentModelConfig): Record<string, number> {
  const params: Record<string, number> = {}
  if (typeof model.temperature === 'number') {
    params.temperature = model.temperature
  }
  if (typeof model.topP === 'number') {
    params.top_p = model.topP
  }
  if (typeof model.topK === 'number') {
    params.top_k = model.topK
  }
  return params
}

export class ProviderClient {
  constructor(
    private readonly options: {
      logDetail?: boolean
      logTiming?: boolean
      providerLogging?: boolean
    } = {}
  ) {}

  async complete(request: ProviderClientRequest): Promise<CompleteWithToolsResponse> {
    return this.completeWithTools({
      systemPrompt: request.systemPrompt,
      messages: [{
        role: 'user',
        createdAt: Date.now(),
        parts: [{ type: 'text', text: request.input }]
      }],
      tools: [],
      model: request.model,
      signal: request.signal,
      trace: request.trace
    })
  }

  async completeWithTools(request: CompleteWithToolsRequest): Promise<CompleteWithToolsResponse> {
    const startedAt = Date.now()
    const model = request.model
    const baseURL = model.apiEndpoint?.replace(/\/$/, '')
      || DEFAULT_OPENAI_BASE_URL
    const requestUrl = buildChatCompletionsUrl(baseURL)

    const response = await this.callOpenAI(model, requestUrl, request)

    return {
      text: response.text,
      reasoning: response.reasoning || '',
      toolCalls: response.toolCalls,
      metrics: {
        provider: model.provider,
        modelName: model.modelName,
        latencyMs: Date.now() - startedAt,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        cacheReadTokens: response.usage.cacheReadTokens,
        cacheWriteTokens: response.usage.cacheWriteTokens,
        finishReason: response.finishReason
      }
    }
  }

  private async callOpenAI(
    model: AgentModelConfig,
    requestUrl: string,
    request: CompleteWithToolsRequest
  ): Promise<{
    text: string
    reasoning: string
    toolCalls: AgentLoopToolCall[]
    usage: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
      cacheReadTokens: number
      cacheWriteTokens: number
    }
    finishReason: string | null
  }> {
    const toolNameMap = createToolNameMap(request.tools)
    const toolsPayload = request.tools.length > 0 ? request.tools.map(tool => ({
      type: 'function',
      function: {
        name: toProviderToolName(tool.name, toolNameMap),
        description: tool.description,
        parameters: tool.inputSchema || permissiveToolSchema
      }
    })) : undefined
    const outboundMessages = toOpenAiMessages(request, toolName => toProviderToolName(toolName, toolNameMap))
    const headers = buildRequestHeaders(model)
    const requestBody = buildRequestBody(model, outboundMessages, toolsPayload)

    if (isProviderLoggingEnabled(this.options.providerLogging)) {
      providerLogger.info({
        message: 'provider outbound payload prepared',
        context: toTraceLogContext(request.trace),
        data: buildOutboundPayloadLog({
          model,
          trace: request.trace,
          messages: outboundMessages,
          disableTruncation: Boolean(this.options.logDetail)
        })
      })
      providerLogger.info({
        message: 'provider request prepared',
        context: toTraceLogContext(request.trace),
        data: {
          provider: model.provider,
          modelName: model.modelName,
          requestUrl,
          headers: maskSensitiveHeaders(headers),
          body: requestBody,
          customHeaders: model.custom?.headers ? maskSensitiveHeaders(model.custom.headers) : null,
          customBody: model.custom?.body ?? null
        }
      })
    }
    if (isProviderLoggingEnabled(this.options.providerLogging) && this.options.logDetail) {
      providerLogger.info({
        message: 'provider request json',
        context: toTraceLogContext(request.trace),
        data: buildFullJsonLog({
          trace: request.trace,
          requestUrl,
          body: requestBody
        })
      })
    }

    const requestStartedAt = Date.now()
    const timeout = resolveStreamingTimeout(model)
    const timeoutSignal = createProviderTimeoutSignal(model, timeout)
    const fetchSignal = timeoutSignal
      ? AbortSignal.any([request.signal, timeoutSignal])
      : request.signal
    let response: Response
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: fetchSignal
      })
    } catch (error) {
      if (request.signal.aborted) {
        throw error
      }
      throw buildLoggedTransportFailure({
        enabled: isTimingLogEnabled(this.options.logTiming),
        model,
        trace: request.trace,
        requestUrl,
        requestStartedAt,
        fetchSignal,
        requestSignal: request.signal,
        timeoutSignal: timeoutSignal ?? new AbortController().signal,
        error
      })
    }

    const latencyMs = Date.now() - requestStartedAt
    if (!response.ok) {
      const errorBody = await response.text()
      logLlmHttpFailure({
        enabled: isTimingLogEnabled(this.options.logTiming),
        model,
        trace: request.trace,
        requestUrl,
        status: response.status,
        startedAt: requestStartedAt,
        errorBody
      })
      const message = buildModelErrorMessage({
        status: response.status,
        errorBody,
        request,
        requestUrl,
        model,
        disableTruncation: Boolean(this.options.logDetail)
      })
      throw buildModelRequestError({
        message,
        failureKind: 'http',
        metrics: buildFailedModelCallMetrics({
          model,
          latencyMs,
          requestUrl
        }),
        detail: message,
        retryable: response.status === 429 || response.status >= 500,
        status: response.status
      })
    }

    try {
      if (usesStreamingResponse(model)) {
        return await this.readStreamingCompletion({
          response,
          model,
          request,
          requestStartedAt,
          requestUrl,
          timeout,
          toolNameMap
        })
      }
      return await this.readJsonCompletion({
        response,
        model,
        request,
        requestStartedAt,
        requestUrl,
        toolNameMap
      })
    } catch (error) {
      if (isModelRequestError(error)) {
        throw error
      }
      if (request.signal.aborted) {
        throw error
      }
      const responseLatencyMs = Date.now() - requestStartedAt
      if (!usesStreamingResponse(model)) {
        throw buildLoggedResponseFailure({
          enabled: isTimingLogEnabled(this.options.logTiming),
          model,
          trace: request.trace,
          requestUrl,
          responseStatus: response.status,
          latencyMs: responseLatencyMs,
          error,
          failureKind: 'protocol',
          streamStage: 'protocol',
          message: resolveUnknownErrorMessage(error),
          retryable: false
        })
      }
      const timeoutStage = resolveStreamingTimeoutStage(error)
      if (timeoutStage) {
        const failureKind = timeoutStage === 'idle' ? 'timeout_idle' : 'timeout_first_byte'
        const message = buildWatchdogTimeoutMessage({
          model,
          requestUrl,
          stage: failureKind === 'timeout_idle' ? 'idle' : 'first_byte'
        })
        throw buildLoggedResponseFailure({
          enabled: isTimingLogEnabled(this.options.logTiming),
          model,
          trace: request.trace,
          requestUrl,
          responseStatus: response.status,
          latencyMs: responseLatencyMs,
          error,
          failureKind,
          streamStage: failureKind === 'timeout_idle' ? 'watchdog_idle' : 'watchdog_first_byte',
          message,
          retryable: true
        })
      }
      if (shouldPreserveParseError(error)) {
        throw error
      }
      if (isStreamInterruptionError(error, model)) {
        throw buildLoggedResponseFailure({
          enabled: isTimingLogEnabled(this.options.logTiming),
          model,
          trace: request.trace,
          requestUrl,
          responseStatus: response.status,
          latencyMs: responseLatencyMs,
          error,
          failureKind: 'stream_interrupted',
          streamStage: 'stream_read',
          message: buildStreamInterruptionErrorMessage(model),
          retryable: true
        })
      }
      throw buildLoggedResponseFailure({
        enabled: isTimingLogEnabled(this.options.logTiming),
        model,
        trace: request.trace,
        requestUrl,
        responseStatus: response.status,
        latencyMs: responseLatencyMs,
        error,
        failureKind: 'protocol',
        streamStage: 'protocol',
        message: resolveUnknownErrorMessage(error),
        retryable: false
      })
    }
  }

  private async readStreamingCompletion(params: {
    response: Response
    model: AgentModelConfig
    request: CompleteWithToolsRequest
    requestStartedAt: number
    requestUrl: string
    timeout: ReturnType<typeof resolveStreamingTimeout>
    toolNameMap: Record<string, string>
  }) {
    const streamState = await readOpenAiStreamingResponse({
      response: params.response,
      model: params.model,
      signal: params.request.signal,
      watchdog: params.timeout,
      toInternalToolName: toolName => toInternalToolName(toolName, params.toolNameMap)
    })
    const usage = toOpenAiUsagePayload(streamState.usage)
    const payload: OpenAiCompletionPayload = {
      choices: [{
        finish_reason: streamState.finishReason,
        message: {
          content: streamState.text,
          tool_calls: streamState.toolCalls.map(toolCall => ({
            id: toolCall.id,
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.input)
            }
          }))
        }
      }],
      usage
    }
    this.logSuccessfulResponse({
      model: params.model,
      trace: params.request.trace,
      requestUrl: params.requestUrl,
      status: params.response.status,
      startedAt: params.requestStartedAt,
      text: streamState.text,
      toolCalls: streamState.toolCalls,
      finishReason: streamState.finishReason,
      usage,
      fullBody: payload
    })
    return {
      text: streamState.text,
      reasoning: streamState.reasoning,
      toolCalls: streamState.toolCalls,
      usage: streamState.usage,
      finishReason: streamState.finishReason
    }
  }

  private async readJsonCompletion(params: {
    response: Response
    model: AgentModelConfig
    request: CompleteWithToolsRequest
    requestStartedAt: number
    requestUrl: string
    toolNameMap: Record<string, string>
  }) {
    const payload = await params.response.json() as OpenAiCompletionPayload
    const completion = parseOpenAiChoice({
      choice: payload.choices?.[0],
      model: params.model,
      toolNameMap: params.toolNameMap,
      usage: payload.usage
    })
    this.logSuccessfulResponse({
      model: params.model,
      trace: params.request.trace,
      requestUrl: params.requestUrl,
      status: params.response.status,
      startedAt: params.requestStartedAt,
      text: completion.text,
      toolCalls: completion.toolCalls,
      finishReason: completion.finishReason,
      usage: payload.usage,
      fullBody: payload
    })
    return completion
  }

  private logSuccessfulResponse(params: {
    model: AgentModelConfig
    trace: TraceContext
    requestUrl: string
    status: number
    startedAt: number
    text: string
    toolCalls: AgentLoopToolCall[]
    finishReason: string | null
    usage?: OpenAiUsagePayload
    fullBody: OpenAiCompletionPayload
  }): void {
    const latencyMs = Date.now() - params.startedAt
    if (isProviderLoggingEnabled(this.options.providerLogging)) {
      providerLogger.info({
        message: 'provider response received',
        context: toTraceLogContext(params.trace),
        data: {
          provider: params.model.provider,
          modelName: params.model.modelName,
          requestUrl: params.requestUrl,
          status: params.status,
          latencyMs,
          finishReason: params.finishReason,
          usage: params.usage,
          contentPreview: buildLogPreview(params.text, {
            disableTruncation: Boolean(this.options.logDetail)
          }) || '(empty)',
          toolCallCount: params.toolCalls.length
        }
      })
    }
    logLlmTiming({
      enabled: isTimingLogEnabled(this.options.logTiming),
      model: params.model,
      trace: params.trace,
      requestUrl: params.requestUrl,
      status: params.status,
      latencyMs,
      finishReason: params.finishReason,
      usage: params.usage,
      toolCallCount: params.toolCalls.length
    })
    if (isProviderLoggingEnabled(this.options.providerLogging) && this.options.logDetail) {
      providerLogger.info({
        message: 'provider response json',
        context: toTraceLogContext(params.trace),
        data: buildFullJsonLog({
          trace: params.trace,
          requestUrl: params.requestUrl,
          body: params.fullBody
        })
      })
    }
  }

}

function buildFullJsonLog(params: {
  trace: TraceContext
  requestUrl: string
  body: unknown
}): Record<string, unknown> {
  return {
    runId: params.trace.runId,
    turnId: params.trace.turnId,
    toolCallId: params.trace.toolCallId ?? null,
    requestUrl: params.requestUrl,
    body: params.body
  }
}

function toTraceLogContext(trace: TraceContext): { runId: string; turnId: string } {
  return {
    runId: trace.runId,
    turnId: trace.turnId
  }
}

function buildChatCompletionsUrl(baseURL: string): string {
  if (baseURL.endsWith('/api/coding/v3')) {
    return `${baseURL}${ARK_CODING_CHAT_COMPLETIONS_PATH}`
  }
  return `${baseURL}${OPENAI_CHAT_COMPLETIONS_PATH}`
}

function createProviderTimeoutSignal(
  model: AgentModelConfig,
  timeout: ReturnType<typeof resolveStreamingTimeout>
): AbortSignal | null {
  if (usesStreamingResponse(model)) {
    return null
  }
  return AbortSignal.timeout(resolveNonStreamingTimeoutMs(timeout))
}

function isTimingLogEnabled(logTiming: boolean | undefined): boolean {
  return logTiming !== false
}

function isProviderLoggingEnabled(providerLogging: boolean | undefined): boolean {
  return providerLogging === true
}

function logLlmTiming(params: {
  enabled: boolean
  model: AgentModelConfig
  trace: TraceContext
  requestUrl: string
  status: number
  latencyMs: number
  finishReason: string | null
  usage?: OpenAiUsagePayload
  toolCallCount: number
}): void {
  if (!params.enabled) return
  providerLogger.info({
    message: 'model request timing',
    context: toTraceLogContext(params.trace),
    data: {
      provider: params.model.provider,
      modelName: params.model.modelName,
      requestUrl: params.requestUrl,
      status: params.status,
      latencyMs: params.latencyMs,
      finishReason: params.finishReason,
      toolCallCount: params.toolCallCount,
      inputTokens: params.usage?.prompt_tokens ?? null,
      outputTokens: params.usage?.completion_tokens ?? null,
      totalTokens: params.usage?.total_tokens ?? null,
      toolCallId: params.trace.toolCallId ?? null
    }
  })
}

function logLlmHttpFailure(params: {
  enabled: boolean
  model: AgentModelConfig
  trace: TraceContext
  requestUrl: string
  status: number
  startedAt: number
  errorBody: string
}): void {
  if (!params.enabled) return
  providerLogger.error({
    message: 'model request http failure',
    context: toTraceLogContext(params.trace),
    data: {
      provider: params.model.provider,
      modelName: params.model.modelName,
      requestUrl: params.requestUrl,
      status: params.status,
      latencyMs: Date.now() - params.startedAt,
      errorBody: truncateBody(params.errorBody, false),
      toolCallId: params.trace.toolCallId ?? null
    }
  })
}

function logLlmTransportFailure(params: {
  enabled: boolean
  model: AgentModelConfig
  trace: TraceContext
  requestUrl: string
  failureKind: 'transport' | 'timeout'
  diagnostics: ModelRequestDiagnostics
  error: unknown
}): void {
  if (!params.enabled) return
  providerLogger.error({
    message: 'model request transport failure',
    context: toTraceLogContext(params.trace),
    data: {
      provider: params.model.provider,
      modelName: params.model.modelName,
      requestUrl: params.requestUrl,
      failureKind: params.failureKind,
      error: resolveUnknownErrorMessage(params.error),
      ...params.diagnostics,
      toolCallId: params.trace.toolCallId ?? null
    }
  })
}

function logLlmResponseFailure(params: {
  enabled: boolean
  model: AgentModelConfig
  trace: TraceContext
  requestUrl: string
  failureKind: Extract<ModelRequestFailureKind, 'timeout_first_byte' | 'timeout_idle' | 'stream_interrupted' | 'protocol'>
  diagnostics: ModelRequestDiagnostics
  error: unknown
}): void {
  if (!params.enabled) return
  providerLogger.error({
    message: 'model request response failure',
    context: toTraceLogContext(params.trace),
    data: {
      provider: params.model.provider,
      modelName: params.model.modelName,
      requestUrl: params.requestUrl,
      failureKind: params.failureKind,
      error: resolveUnknownErrorMessage(params.error),
      ...params.diagnostics,
      toolCallId: params.trace.toolCallId ?? null
    }
  })
}

function buildRequestHeaders(model: AgentModelConfig): Record<string, string> {
  const customHeaders = resolveCustomHeaders(model)
  if (Object.keys(customHeaders).length > 0) {
    return {
      'Content-Type': 'application/json',
      ...customHeaders
    }
  }
  if (!model.apiKey) {
    throw new Error(`Missing model API key; provider=${model.provider}; model=${model.modelName}`)
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${model.apiKey}`
  }
}

function resolveStreamingTimeout(model: AgentModelConfig): {
  firstByteTimeoutMs: number
  idleTimeoutMs: number
} {
  const firstByteTimeoutMs = typeof model.streamFirstByteTimeoutMs === 'number' && model.streamFirstByteTimeoutMs > ZERO
    ? Math.floor(model.streamFirstByteTimeoutMs)
    : DEFAULT_STREAM_FIRST_BYTE_TIMEOUT_MS
  const idleTimeoutMs = typeof model.streamIdleTimeoutMs === 'number' && model.streamIdleTimeoutMs > ZERO
    ? Math.floor(model.streamIdleTimeoutMs)
    : DEFAULT_STREAM_IDLE_TIMEOUT_MS
  return {
    firstByteTimeoutMs,
    idleTimeoutMs
  }
}

function resolveNonStreamingTimeoutMs(timeout: {
  firstByteTimeoutMs: number
  idleTimeoutMs: number
}): number {
  // Non-stream requests keep the legacy fields as a single compatibility deadline.
  return Math.max(timeout.firstByteTimeoutMs, timeout.idleTimeoutMs)
}

function resolveTransportFailureKind(
  fetchSignal: AbortSignal,
  requestSignal: AbortSignal,
  timeoutSignal: AbortSignal,
  error: unknown
): 'transport' | 'timeout' {
  if (!requestSignal.aborted && fetchSignal.aborted && !timeoutSignal.aborted) {
    return 'timeout'
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'timeout'
  }
  return 'transport'
}

function resolveStreamingTimeoutStage(error: unknown): 'first_byte' | 'idle' | null {
  if (!(error instanceof Error)) {
    return null
  }
  if (error.message === 'first_byte' || error.message === 'idle') {
    return error.message
  }
  return null
}

function isStreamInterruptionError(error: unknown, model: AgentModelConfig): boolean {
  return error instanceof Error && error.message === buildStreamInterruptionErrorMessage(model)
}

function buildTransportErrorMessage(
  model: AgentModelConfig,
  failureKind: 'transport' | 'timeout',
  requestUrl: string,
  error: unknown
): string {
  const detail = error instanceof Error ? error.message : String(error)
  if (failureKind === 'timeout') {
    return `Model request timed out; provider=${model.provider}; model=${model.modelName}; requestUrl=${requestUrl}; detail=${detail}`
  }
  return `Model transport failed; provider=${model.provider}; model=${model.modelName}; requestUrl=${requestUrl}; detail=${detail}`
}

function buildProtocolFailure(
  model: AgentModelConfig,
  requestUrl: string,
  latencyMs: number,
  error: unknown,
  diagnostics: ModelRequestDiagnostics
) {
  const detail = error instanceof Error ? error.message : String(error)
  return buildModelRequestError({
    message: detail,
    failureKind: 'protocol',
    metrics: buildFailedModelCallMetrics({
      model,
      latencyMs,
      requestUrl
    }),
    detail: formatModelRequestDetail(detail, diagnostics),
    retryable: false,
    diagnostics,
    cause: error
  })
}

function buildLoggedTransportFailure(params: {
  enabled: boolean
  model: AgentModelConfig
  trace: TraceContext
  requestUrl: string
  requestStartedAt: number
  fetchSignal: AbortSignal
  requestSignal: AbortSignal
  timeoutSignal: AbortSignal
  error: unknown
}) {
  const latencyMs = Date.now() - params.requestStartedAt
  const failureKind = resolveTransportFailureKind(
    params.fetchSignal,
    params.requestSignal,
    params.timeoutSignal,
    params.error
  )
  const diagnostics = buildPreResponseDiagnostics(latencyMs, params.error)
  const message = buildTransportErrorMessage(params.model, failureKind, params.requestUrl, params.error)
  logLlmTransportFailure({
    enabled: params.enabled,
    model: params.model,
    trace: params.trace,
    requestUrl: params.requestUrl,
    failureKind,
    diagnostics,
    error: params.error
  })
  return buildModelRequestError({
    message,
    failureKind,
    metrics: buildFailedModelCallMetrics({
      model: params.model,
      latencyMs,
      requestUrl: params.requestUrl
    }),
    detail: formatModelRequestDetail(message, diagnostics),
    retryable: true,
    diagnostics,
    cause: params.error
  })
}

function buildLoggedResponseFailure(params: {
  enabled: boolean
  model: AgentModelConfig
  trace: TraceContext
  requestUrl: string
  responseStatus: number
  latencyMs: number
  error: unknown
  failureKind: Extract<ModelRequestFailureKind, 'timeout_first_byte' | 'timeout_idle' | 'stream_interrupted' | 'protocol'>
  streamStage: ModelRequestStreamStage
  message: string
  retryable: boolean
}) {
  const diagnostics = buildResponseDiagnostics(
    params.latencyMs,
    params.responseStatus,
    params.streamStage,
    params.error
  )
  logLlmResponseFailure({
    enabled: params.enabled,
    model: params.model,
    trace: params.trace,
    requestUrl: params.requestUrl,
    failureKind: params.failureKind,
    diagnostics,
    error: params.error
  })
  if (params.failureKind === 'protocol') {
    return buildProtocolFailure(
      params.model,
      params.requestUrl,
      params.latencyMs,
      params.error,
      diagnostics
    )
  }
  return buildModelRequestError({
    message: params.message,
    failureKind: params.failureKind,
    metrics: buildFailedModelCallMetrics({
      model: params.model,
      latencyMs: params.latencyMs,
      requestUrl: params.requestUrl
    }),
    detail: formatModelRequestDetail(params.message, diagnostics),
    retryable: params.retryable,
    diagnostics,
    cause: params.error
  })
}

function buildPreResponseDiagnostics(
  latencyMs: number,
  error: unknown
): ModelRequestDiagnostics {
  const causeChain = extractErrorCauseChain(error)
  return {
    requestStage: 'request_pre_response',
    responseStarted: false,
    latencyMs,
    ...(causeChain.length > ZERO ? { causeChain } : {})
  }
}

function buildResponseDiagnostics(
  latencyMs: number,
  status: number,
  streamStage: ModelRequestStreamStage,
  error: unknown
): ModelRequestDiagnostics {
  const causeChain = extractErrorCauseChain(error)
  return {
    requestStage: 'response_stream',
    responseStarted: true,
    latencyMs,
    status,
    streamStage,
    ...(causeChain.length > ZERO ? { causeChain } : {})
  }
}

function extractErrorCauseChain(error: unknown): ModelRequestCauseDiagnostic[] {
  const chain: ModelRequestCauseDiagnostic[] = []
  const seen = new Set<unknown>()
  let current: unknown = error
  let depth = ZERO
  while (isDiagnosticObject(current) && depth < MAX_CAUSE_CHAIN_DEPTH && !seen.has(current)) {
    const entry = buildCauseDiagnostic(current, depth)
    if (entry) {
      chain.push(entry)
    }
    seen.add(current)
    current = current.cause
    depth += 1
  }
  return chain
}

function buildCauseDiagnostic(
  error: DiagnosticObject,
  depth: number
): ModelRequestCauseDiagnostic | null {
  const entry: ModelRequestCauseDiagnostic = { depth }
  const name = readDiagnosticText(error.name)
  const message = readDiagnosticText(error.message)
  const code = readDiagnosticScalar(error.code)
  const errno = readDiagnosticScalar(error.errno)
  const syscall = readDiagnosticText(error.syscall)
  const address = readDiagnosticText(error.address)
  const port = readDiagnosticScalar(error.port)
  if (name) entry.name = name
  if (message) entry.message = message
  if (code !== undefined) entry.code = code
  if (errno !== undefined) entry.errno = errno
  if (syscall) entry.syscall = syscall
  if (address) entry.address = address
  if (port !== undefined) entry.port = port
  return Object.keys(entry).length > 1 ? entry : null
}

function formatModelRequestDetail(
  detail: string,
  diagnostics: ModelRequestDiagnostics
): string {
  const parts = [
    detail,
    `requestStage=${diagnostics.requestStage}`,
    `responseStarted=${String(diagnostics.responseStarted)}`,
    `latencyMs=${diagnostics.latencyMs}`
  ]
  if (typeof diagnostics.status === 'number') {
    parts.push(`status=${diagnostics.status}`)
  }
  if (diagnostics.streamStage) {
    parts.push(`streamStage=${diagnostics.streamStage}`)
  }
  if (diagnostics.causeChain && diagnostics.causeChain.length > ZERO) {
    parts.push(`causeChain=${JSON.stringify(diagnostics.causeChain)}`)
  }
  return parts.join('; ')
}

type DiagnosticObject = Record<string, unknown> & { cause?: unknown }

function isDiagnosticObject(value: unknown): value is DiagnosticObject {
  return Boolean(value) && typeof value === 'object'
}

function readDiagnosticText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readDiagnosticScalar(value: unknown): string | number | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

function resolveUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function shouldPreserveParseError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return isFinishReasonError(error.message)
}

function isFinishReasonError(message: string): boolean {
  return /finish_reason\s*=/.test(message)
}

function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.keys(headers).reduce<Record<string, string>>((acc, key) => {
    acc[key] = key.toLowerCase().includes('key')
      || key.toLowerCase().includes('token')
      || key.toLowerCase().includes('auth')
      ? '***'
      : headers[key] as string
    return acc
  }, {})
}

function resolveCustomHeaders(model: AgentModelConfig): Record<string, string> {
  const headers = model.custom?.headers
  if (!headers) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    const trimmedValue = value?.trim()
    if (trimmedValue) {
      result[key] = trimmedValue
    }
  }
  return result
}

function toOpenAiMessages(
  request: CompleteWithToolsRequest,
  mapToolName: (toolName: string) => string
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = []
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt })
  }

  for (const message of request.messages) {
    pushOpenAiMessage(messages, message, mapToolName)
  }

  return messages
}

function pushOpenAiMessage(
  messages: Array<Record<string, unknown>>,
  message: CompleteWithToolsRequest['messages'][number],
  mapToolName: (toolName: string) => string
): void {
  const text = message.parts.filter(part => part.type === 'text').map(part => part.text).join('\n').trim()
  const toolParts = getToolParts(message)
  const reasoningField = message.reasoning ? { reasoning_content: message.reasoning } : {}
  if (toolParts.length === 0) {
    messages.push({
      role: message.role,
      content: text || '',
      ...reasoningField
    })
    return
  }

  messages.push({
    role: message.role,
    content: text || '',
    ...reasoningField,
    ...(toolParts.length > 0 ? {
      tool_calls: toolParts.map(part => ({
        id: part.id,
        type: 'function',
        function: {
          name: mapToolName(part.name),
          arguments: JSON.stringify(part.input)
        }
      }))
    } : {})
  })
  for (const part of toolParts) {
    messages.push({
      role: 'tool',
      tool_call_id: part.id,
      content: part.output
    })
  }
}

function normalizeOpenAiText(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') {
    return content
  }
  return (content || []).map(item => item.text || '').join('\n').trim()
}

function buildOutboundPayloadLog(params: {
  model: AgentModelConfig
  trace: TraceContext
  messages: Array<Record<string, unknown>>
  disableTruncation: boolean
}): Record<string, unknown> {
  return {
    provider: params.model.provider,
    modelName: params.model.modelName,
    runId: params.trace.runId,
    turnId: params.trace.turnId,
    toolCallId: params.trace.toolCallId ?? null,
    messageCount: params.messages.length,
    messages: params.messages.map(message => summarizeOutboundMessage(message, params.disableTruncation))
  }
}

function summarizeOutboundMessage(
  message: Record<string, unknown>,
  disableTruncation: boolean
): Record<string, unknown> {
  const content = typeof message.content === 'string' ? message.content : ''
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls.map(toolCall => summarizeOutboundToolCall(toolCall, disableTruncation))
    : undefined

  return {
    role: typeof message.role === 'string' ? message.role : 'unknown',
    ...(typeof message.tool_call_id === 'string' ? { toolCallId: message.tool_call_id } : {}),
    contentChars: content.length,
    contentPreview: buildLogPreview(content, { disableTruncation }),
    ...(toolCalls ? { toolCalls } : {})
  }
}

function summarizeOutboundToolCall(toolCall: unknown, disableTruncation: boolean): Record<string, unknown> {
  const value = (toolCall && typeof toolCall === 'object' && !Array.isArray(toolCall))
    ? toolCall as Record<string, unknown>
    : {}
  const fn = (value.function && typeof value.function === 'object' && !Array.isArray(value.function))
    ? value.function as Record<string, unknown>
    : {}
  const rawArgs = typeof fn.arguments === 'string' ? fn.arguments : ''

  return {
    id: typeof value.id === 'string' ? value.id : null,
    name: typeof fn.name === 'string' ? fn.name : null,
    argumentsChars: rawArgs.length,
    argumentsPreview: buildLogPreview(rawArgs, { disableTruncation })
  }
}

function parseOpenAiChoice(params: {
  choice?: OpenAiChoicePayload
  model: AgentModelConfig
  toolNameMap: Record<string, string>
  usage?: OpenAiUsagePayload
}): {
  text: string
  reasoning: string
  toolCalls: AgentLoopToolCall[]
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }
  finishReason: string | null
} {
  const finishReason = params.choice?.finish_reason
  assertSupportedFinishReason(finishReason, params.model)

  const message = params.choice?.message
  const text = normalizeOpenAiText(message?.content)
  const reasoning = typeof message?.reasoning_content === 'string' ? message.reasoning_content : ''
  const toolCalls = (message?.tool_calls || []).map(toolCall =>
    toOpenAiToolCall(toolCall, toolName => toInternalToolName(toolName, params.toolNameMap))
  )
  if (!text && toolCalls.length === 0 && !reasoning) throw new Error('Model returned empty response')
  return {
    text,
    reasoning,
    toolCalls,
    usage: parseOpenAiUsage(params.usage, params.model),
    finishReason: finishReason || null
  }
}

function assertSupportedFinishReason(
  finishReason: string | null | undefined,
  model: AgentModelConfig
): void {
  if (!finishReason || finishReason === 'stop' || finishReason === 'tool_calls') {
    return
  }
  throw new Error(buildFinishReasonErrorMessage(finishReason, model))
}

function buildFinishReasonErrorMessage(finishReason: string, model: AgentModelConfig): string {
  if (finishReason === 'length') {
    return `Model output truncated: finish_reason=length; provider=${model.provider}; model=${model.modelName}`
  }
  return `Model returned unsupported finish_reason: finish_reason=${finishReason}; provider=${model.provider}; model=${model.modelName}`
}

function toOpenAiToolCall(
  toolCall: OpenAiToolCallPayload,
  mapToolName: (toolName: string) => string
): AgentLoopToolCall {
  return {
    id: toolCall.id || crypto.randomUUID(),
    name: mapToolName(toolCall.function?.name || ''),
    input: parseJsonObject(toolCall.function?.arguments)
  }
}

function createToolNameMap(tools: CompleteWithToolsRequest['tools']): Record<string, string> {
  return Object.fromEntries(tools.map(tool => [tool.name.replace(/[^a-zA-Z0-9_-]/g, '_'), tool.name]))
}

function toProviderToolName(toolName: string, toolNameMap: Record<string, string>): string {
  return toolNameMap[toolName] ? toolName : toolName.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function toInternalToolName(toolName: string, toolNameMap: Record<string, string>): string {
  return toolNameMap[toolName] || toolName
}

function parseJsonObject(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

function buildModelErrorMessage(params: {
  status: number
  errorBody: string
  request: CompleteWithToolsRequest
  requestUrl: string
  model: AgentModelConfig
  disableTruncation: boolean
}): string {
  const summary = buildRequestSummary(params.request, params.requestUrl, params.model)
  const bodySnippet = truncateBody(params.errorBody, params.disableTruncation)
  return [
    `Model request failed: HTTP ${params.status}`,
    `body=${bodySnippet}`,
    `summary=${summary}`
  ].join('\n')
}

function truncateBody(body: string, disableTruncation: boolean): string {
  if (!body) return '(empty)'
  return buildLogPreview(body, { maxChars: MAX_ERROR_BODY_CHARS, disableTruncation })
}

function buildRequestSummary(
  request: CompleteWithToolsRequest,
  requestUrl: string,
  model: AgentModelConfig
): string {
  const messageSummary = request.messages.map(message => ({
    role: message.role,
    parts: message.parts.map(part => part.type)
  }))
  const toolNames = request.tools.map(tool => tool.name)
  return JSON.stringify({
    provider: model.provider,
    modelName: model.modelName,
    requestUrl,
    messages: messageSummary,
    toolCount: request.tools.length,
    tools: toolNames
  }, null, 2)
}

function parseOpenAiUsage(
  usage: OpenAiUsagePayload | undefined,
  model: AgentModelConfig
): {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
} {
  if (!usage) {
    throw new Error(`Model response missing usage payload; provider=${model.provider}; model=${model.modelName}`)
  }
  if (!Number.isFinite(usage.prompt_tokens) || !Number.isFinite(usage.completion_tokens) || !Number.isFinite(usage.total_tokens)) {
    throw new Error(`Model response returned invalid usage payload; provider=${model.provider}; model=${model.modelName}`)
  }
  const promptTokens = Number(usage.prompt_tokens)
  const completionTokens = Number(usage.completion_tokens)
  const totalTokens = Number(usage.total_tokens)
  return {
    inputTokens: Math.max(ZERO, Math.floor(promptTokens)),
    outputTokens: Math.max(ZERO, Math.floor(completionTokens)),
    totalTokens: Math.max(ZERO, Math.floor(totalTokens)),
    cacheReadTokens: Math.max(ZERO, Math.floor(usage.prompt_tokens_details?.cached_tokens || ZERO)),
    cacheWriteTokens: Math.max(ZERO, Math.floor(usage.completion_tokens_details?.cached_tokens || ZERO))
  }
}

function toOpenAiUsagePayload(usage: {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}): OpenAiUsagePayload {
  return {
    prompt_tokens: usage.inputTokens,
    completion_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    prompt_tokens_details: {
      cached_tokens: usage.cacheReadTokens
    },
    completion_tokens_details: {
      cached_tokens: usage.cacheWriteTokens
    }
  }
}
