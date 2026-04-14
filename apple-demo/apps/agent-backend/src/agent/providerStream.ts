import type { AgentLoopToolCall } from './loopTypes.js'
import type { AgentModelConfig } from './types.js'

interface OpenAiStreamToolCallDelta {
  index?: number
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

interface OpenAiStreamChunk {
  choices?: Array<{
    finish_reason?: string | null
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>
      reasoning_content?: string
      tool_calls?: OpenAiStreamToolCallDelta[]
    }
  }>
  usage?: {
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
}

type OpenAiDeltaContent = string | Array<{ type?: string; text?: string }>

interface StreamingToolCallState {
  id: string
  name: string
  arguments: string
}

export interface StreamingUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface StreamingAssembledResponse {
  text: string
  reasoning: string
  toolCalls: AgentLoopToolCall[]
  usage: StreamingUsage
  finishReason: string | null
}

export interface StreamingWatchdogConfig {
  firstByteTimeoutMs: number
  idleTimeoutMs: number
}

interface StreamingAccumulator {
  finishReason: string | null
  textParts: string[]
  reasoningParts: string[]
  toolCalls: Map<number, StreamingToolCallState>
  usage: OpenAiStreamChunk['usage']
  sawMeaningfulChunk: boolean
}

const SSE_CHUNK_SEPARATOR = '\n\n'
const SSE_DONE_MESSAGE = '[DONE]'
const ZERO = 0

export async function readOpenAiStreamingResponse(params: {
  response: Response
  model: AgentModelConfig
  signal: AbortSignal
  watchdog: StreamingWatchdogConfig
  toInternalToolName: (toolName: string) => string
}): Promise<StreamingAssembledResponse> {
  if (!params.response.body) {
    throw new Error('Model streaming response body is missing.')
  }
  const reader = params.response.body.getReader()
  const decoder = new TextDecoder()
  const accumulator = createAccumulator()
  const watchdog = createStreamingWatchdog(params.signal, params.watchdog)
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await readWithAbort(reader, watchdog.signal)
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const next = consumeSseBuffer(buffer, payload => {
        if (payload === SSE_DONE_MESSAGE) {
          return
        }
        const chunk = JSON.parse(payload) as OpenAiStreamChunk
        const progressed = applyChunk(accumulator, chunk)
        if (progressed) {
          watchdog.markProgress()
        }
      })
      buffer = next
    }
    const tail = decoder.decode()
    if (tail) {
      buffer += tail
    }
    consumeSseBuffer(buffer, payload => {
      if (payload === SSE_DONE_MESSAGE) {
        return
      }
      const chunk = JSON.parse(payload) as OpenAiStreamChunk
      const progressed = applyChunk(accumulator, chunk)
      if (progressed) {
        watchdog.markProgress()
      }
    }, true)
    return finalizeAccumulator(accumulator, params.model, params.toInternalToolName)
  } finally {
    watchdog.dispose()
    reader.releaseLock()
  }
}

export function buildStreamInterruptionErrorMessage(model: AgentModelConfig): string {
  return `Model stream interrupted before completion; provider=${model.provider}; model=${model.modelName}`
}

export function buildWatchdogTimeoutMessage(params: {
  model: AgentModelConfig
  requestUrl: string
  stage: 'first_byte' | 'idle'
}): string {
  const label = params.stage === 'first_byte' ? 'first byte' : 'idle'
  return `Model stream ${label} timeout; provider=${params.model.provider}; model=${params.model.modelName}; requestUrl=${params.requestUrl}`
}

function createAccumulator(): StreamingAccumulator {
  return {
    finishReason: null,
    textParts: [],
    reasoningParts: [],
    toolCalls: new Map(),
    usage: undefined,
    sawMeaningfulChunk: false
  }
}

function consumeSseBuffer(
  buffer: string,
  onPayload: (payload: string) => void,
  flush = false
): string {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const events = normalized.split(SSE_CHUNK_SEPARATOR)
  const tail = flush ? '' : (events.pop() || '')
  for (const event of events) {
    const payload = extractSsePayload(event)
    if (payload) {
      onPayload(payload)
    }
  }
  if (flush) {
    const finalPayload = extractSsePayload(tail)
    if (finalPayload) {
      onPayload(finalPayload)
    }
    return ''
  }
  return tail
}

function extractSsePayload(event: string): string | null {
  const lines = event
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return null
  }
  return lines.join('\n')
}

function applyChunk(accumulator: StreamingAccumulator, chunk: OpenAiStreamChunk): boolean {
  let progressed = false
  for (const choice of chunk.choices || []) {
    if (typeof choice.finish_reason === 'string' && choice.finish_reason.length > ZERO) {
      accumulator.finishReason = choice.finish_reason
      progressed = true
    }
    const delta = choice.delta
    const content = normalizeDeltaContent(delta?.content)
    if (content) {
      accumulator.textParts.push(content)
      progressed = true
    }
    const reasoning = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : ''
    if (reasoning) {
      accumulator.reasoningParts.push(reasoning)
      progressed = true
    }
    for (const toolCall of delta?.tool_calls || []) {
      progressed = applyToolCallDelta(accumulator.toolCalls, toolCall) || progressed
    }
  }
  if (chunk.usage) {
    accumulator.usage = chunk.usage
  }
  if (progressed) {
    accumulator.sawMeaningfulChunk = true
  }
  return progressed
}

function normalizeDeltaContent(content: OpenAiDeltaContent | undefined): string {
  if (typeof content === 'string') {
    return content
  }
  return (content || []).map((part: { text?: string }) => part.text || '').join('')
}

function applyToolCallDelta(
  toolCalls: Map<number, StreamingToolCallState>,
  delta: OpenAiStreamToolCallDelta
): boolean {
  const index = typeof delta.index === 'number' ? delta.index : ZERO
  const current = toolCalls.get(index) || {
    id: delta.id || crypto.randomUUID(),
    name: '',
    arguments: ''
  }
  let progressed = false
  if (typeof delta.id === 'string' && delta.id.length > ZERO && current.id !== delta.id) {
    current.id = delta.id
    progressed = true
  }
  const nextName = delta.function?.name || ''
  if (nextName) {
    current.name += nextName
    progressed = true
  }
  const nextArguments = delta.function?.arguments || ''
  if (nextArguments) {
    current.arguments += nextArguments
    progressed = true
  }
  toolCalls.set(index, current)
  return progressed
}

function finalizeAccumulator(
  accumulator: StreamingAccumulator,
  model: AgentModelConfig,
  toInternalToolName: (toolName: string) => string
): StreamingAssembledResponse {
  if (!accumulator.sawMeaningfulChunk) {
    throw new Error(buildStreamInterruptionErrorMessage(model))
  }
  if (!accumulator.finishReason) {
    throw new Error(buildStreamInterruptionErrorMessage(model))
  }
  assertSupportedFinishReason(accumulator.finishReason, model)
  const text = accumulator.textParts.join('')
  const reasoning = accumulator.reasoningParts.join('')
  const toolCalls = Array.from(accumulator.toolCalls.values()).map(toolCall => ({
    id: toolCall.id,
    name: toInternalToolName(toolCall.name),
    input: parseJsonObject(toolCall.arguments)
  }))
  if (!text && toolCalls.length === ZERO && !reasoning) {
    throw new Error('Model returned empty response')
  }
  return {
    text,
    reasoning,
    toolCalls,
    usage: parseOpenAiUsage(accumulator.usage, model),
    finishReason: accumulator.finishReason
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

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw) {
    return {}
  }
  return JSON.parse(raw) as Record<string, unknown>
}

function parseOpenAiUsage(
  usage: OpenAiStreamChunk['usage'],
  model: AgentModelConfig
): StreamingUsage {
  if (!usage) {
    throw new Error(`Model response missing usage payload; provider=${model.provider}; model=${model.modelName}`)
  }
  if (!Number.isFinite(usage.prompt_tokens) || !Number.isFinite(usage.completion_tokens) || !Number.isFinite(usage.total_tokens)) {
    throw new Error(`Model response returned invalid usage payload; provider=${model.provider}; model=${model.modelName}`)
  }
  return {
    inputTokens: Math.max(ZERO, Math.floor(Number(usage.prompt_tokens))),
    outputTokens: Math.max(ZERO, Math.floor(Number(usage.completion_tokens))),
    totalTokens: Math.max(ZERO, Math.floor(Number(usage.total_tokens))),
    cacheReadTokens: Math.max(ZERO, Math.floor(Number(usage.prompt_tokens_details?.cached_tokens || ZERO))),
    cacheWriteTokens: Math.max(ZERO, Math.floor(Number(usage.completion_tokens_details?.cached_tokens || ZERO)))
  }
}

function createStreamingWatchdog(signal: AbortSignal, config: StreamingWatchdogConfig) {
  const controller = new AbortController()
  const combinedSignal = AbortSignal.any([signal, controller.signal])
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  let stage: 'first_byte' | 'idle' = 'first_byte'

  const schedule = (delayMs: number) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
    timeoutHandle = setTimeout(() => {
      controller.abort(new Error(stage))
    }, delayMs)
  }

  schedule(config.firstByteTimeoutMs)

  return {
    signal: combinedSignal,
    stage: () => stage,
    markProgress() {
      stage = 'idle'
      schedule(config.idleTimeoutMs)
    },
    dispose() {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
    }
  }
}

async function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal
): Promise<Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>> {
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('aborted')
  }
  return await new Promise<Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void reader.read().then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}
