import type { AgentModelConfig } from './types.js'

const FALLBACK_CONTEXT_WINDOW = 16384
const DEEPSEEK_CHAT_CONTEXT_WINDOW = 131072

export function resolveModelContextWindow(model: AgentModelConfig | null | undefined): number {
  if (typeof model?.contextWindow === 'number') {
    return Math.max(0, Math.floor(model.contextWindow))
  }
  const inferred = inferOfficialContextWindow(model)
  if (inferred !== null) {
    return inferred
  }
  return FALLBACK_CONTEXT_WINDOW
}

function inferOfficialContextWindow(model: AgentModelConfig | null | undefined): number | null {
  if (!model) return null
  if (model.provider === 'deepseek' && model.modelName === 'deepseek-chat') {
    return DEEPSEEK_CHAT_CONTEXT_WINDOW
  }
  return null
}

