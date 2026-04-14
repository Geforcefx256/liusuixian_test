import type { AgentModelConfig } from './types.js'
import type { Config } from '../memory/ConfigLoader.js'

export interface AgentRuntimeModelInfo {
  provider: AgentModelConfig['provider']
  modelName: string
  apiEndpoint?: string
  maxTokens?: number
  stream?: boolean
  streamFirstByteTimeoutMs?: number
  streamIdleTimeoutMs?: number
  hasApiKey: boolean
  hasCustomHeaders: boolean
  source: 'agent' | 'active' | 'default'
}

export class AgentModelRegistry {
  constructor(
    private readonly config: Config['agent']
  ) {}

  resolve(agentId: string): AgentModelConfig | null {
    const scoped = this.config.modelsByAgent?.[agentId]
    if (this.isModelConfig(scoped)) {
      return scoped
    }

    const activeConfig = this.config.modelsByAgent?.activeModel
    if (this.isModelConfig(activeConfig)) {
      return activeConfig
    }

    const fallback = this.config.defaultModel
    if (this.isModelConfig(fallback)) {
      return fallback
    }

    return null
  }

  getRuntime(agentId: string): AgentRuntimeModelInfo | null {
    const scoped = this.config.modelsByAgent?.[agentId]
    if (this.isModelConfig(scoped)) return this.toRuntime(scoped, 'agent')

    const activeConfig = this.config.modelsByAgent?.activeModel
    if (this.isModelConfig(activeConfig)) {
      return this.toRuntime(activeConfig, 'active')
    }

    const fallback = this.config.defaultModel
    if (this.isModelConfig(fallback)) return this.toRuntime(fallback, 'default')
    return null
  }

  private toRuntime(model: AgentModelConfig, source: 'agent' | 'active' | 'default'): AgentRuntimeModelInfo {
    return {
      provider: model.provider,
      modelName: model.modelName,
      apiEndpoint: model.apiEndpoint,
      maxTokens: model.maxTokens,
      stream: model.stream !== false,
      streamFirstByteTimeoutMs: model.streamFirstByteTimeoutMs,
      streamIdleTimeoutMs: model.streamIdleTimeoutMs,
      hasApiKey: Boolean(model.apiKey && model.apiKey.trim().length > 0),
      hasCustomHeaders: Boolean(model.custom?.headers && Object.keys(model.custom.headers).length > 0),
      source
    }
  }

  private isModelConfig(model: unknown): model is AgentModelConfig {
    if (!model || typeof model !== 'object') return false
    const candidate = model as Partial<AgentModelConfig>
    return typeof candidate.provider === 'string' && typeof candidate.modelName === 'string'
  }
}
