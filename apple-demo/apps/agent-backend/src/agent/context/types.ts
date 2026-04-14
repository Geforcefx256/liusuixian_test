import type { AgentSessionMessage } from '../sessionStore.js'
import type { AgentModelConfig } from '../types.js'

export type ContextLogLevel = 'info' | 'warn' | 'error'

export interface ContextLogEntry {
  level: ContextLogLevel
  message: string
  data?: Record<string, unknown>
  loggedAt: number
}

export interface Tokenizer {
  countTokens(text: string): number
}

export interface ContextManagerConfig {
  contextWindow: number
  auto: boolean
  prune: boolean
  summaryMaxTokens: number
  logDetail: boolean
}

export interface ContextBuildParams {
  userId: number
  agentId: string
  sessionId: string
  systemPrompt: string
  messages: AgentSessionMessage[]
  model: AgentModelConfig
}

export interface ContextBuildResult {
  messages: AgentSessionMessage[]
  estimatedTokens: number
  budget: number
  summaryUpdated: boolean
}

export interface SummaryRecord {
  summary: string
  coveredUntil: number
}
