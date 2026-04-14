import type { AgentLoopToolCall, ProviderClientWithTools } from './loopTypes.js'

const DEFAULT_LATENCY_MS = 5
const DEFAULT_INPUT_TOKENS = 10
const DEFAULT_OUTPUT_TOKENS = 8
const DEFAULT_TOTAL_TOKENS = 18

export function createProvider(
  calls: Array<{ text: string; toolCalls?: AgentLoopToolCall[] }>
): ProviderClientWithTools {
  let index = 0

  return {
    async completeWithTools(request) {
      const current = calls[index]
      index += 1
      if (!current) {
        throw new Error('unexpected provider call')
      }
      return {
        text: current.text,
        reasoning: '',
        toolCalls: current.toolCalls || [],
        metrics: {
          provider: request.model.provider,
          modelName: request.model.modelName,
          latencyMs: DEFAULT_LATENCY_MS,
          inputTokens: DEFAULT_INPUT_TOKENS,
          outputTokens: DEFAULT_OUTPUT_TOKENS,
          totalTokens: DEFAULT_TOTAL_TOKENS,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          finishReason: current.toolCalls?.length ? 'tool_calls' : 'stop'
        }
      }
    }
  }
}
