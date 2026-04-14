import { describe, expect, it } from 'vitest'
import { AgentModelRegistry } from '../../src/agent/modelRegistry.js'

describe('AgentModelRegistry', () => {
  it('resolves agent-specific model first', () => {
    const registry = new AgentModelRegistry({
      defaultModel: {
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'default-key'
      },
      modelRegistry: {},
      modelsByAgent: {
        'mml-converter': {
          provider: 'deepseek',
          modelName: 'deepseek-chat',
          apiKey: 'agent-key',
          stream: false
        }
      }
    })

    const model = registry.resolve('mml-converter')
    const runtime = registry.getRuntime('mml-converter')

    expect(model?.provider).toBe('deepseek')
    expect(model?.stream).toBe(false)
    expect(runtime?.source).toBe('agent')
    expect(runtime?.stream).toBe(false)
    expect(runtime?.hasApiKey).toBe(true)
  })

  it('falls back to default model when no binding exists', () => {
    const registry = new AgentModelRegistry({
      defaultModel: {
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'default-key'
      },
      modelRegistry: {},
      modelsByAgent: {}
    })

    const model = registry.resolve('unknown-agent')
    const runtime = registry.getRuntime('unknown-agent')

    expect(model?.provider).toBe('openai')
    expect(runtime?.stream).toBe(true)
    expect(runtime?.source).toBe('default')
  })

  it('exposes configured context window in runtime model info', () => {
    const registry = new AgentModelRegistry({
      defaultModel: {
        provider: 'deepseek',
        modelName: 'deepseek-chat',
        apiKey: 'default-key',
        contextWindow: 131072
      },
      modelRegistry: {},
      modelsByAgent: {}
    })

    const runtime = registry.getRuntime('unknown-agent')

    expect(runtime?.provider).toBe('deepseek')
    expect(runtime?.modelName).toBe('deepseek-chat')
    expect(runtime?.source).toBe('default')
  })

  it('supports hw provider models with request headers', () => {
    const registry = new AgentModelRegistry({
      defaultModel: {
        provider: 'hw',
        modelName: 'hw-chat',
        headers: {
          'X-Real-IP': '127.0.0.1',
          'X-HW-ID': 'device-1',
          'X-HW-APPKEY': 'app-key'
        }
      },
      modelRegistry: {},
      modelsByAgent: {}
    })

    const model = registry.resolve('unknown-agent')
    const runtime = registry.getRuntime('unknown-agent')

    expect(model?.provider).toBe('hw')
    expect(model?.headers?.['X-HW-ID']).toBe('device-1')
    expect(runtime?.provider).toBe('hw')
    expect(runtime?.hasApiKey).toBe(false)
  })

  it('uses modelsByAgent.activeModel as the global active model', () => {
    const registry = new AgentModelRegistry({
      defaultModel: {
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'default-key'
      },
      modelRegistry: {
        huaweiHisApi: {
          provider: 'huaweiHisApi',
          modelName: 'deepseek-chat',
          apiKey: 'active-key',
          stream: false,
          streamFirstByteTimeoutMs: 30000,
          streamIdleTimeoutMs: 300000
        }
      },
      modelsByAgent: {
        activeModel: {
          provider: 'huaweiHisApi',
          modelName: 'deepseek-chat',
          apiKey: 'active-key',
          stream: false,
          streamFirstByteTimeoutMs: 30000,
          streamIdleTimeoutMs: 300000
        }
      }
    })

    const model = registry.resolve('unknown-agent')
    const runtime = registry.getRuntime('unknown-agent')

    expect(model?.provider).toBe('huaweiHisApi')
    expect(model?.modelName).toBe('deepseek-chat')
    expect(runtime?.stream).toBe(false)
    expect(runtime?.source).toBe('active')
    expect(runtime?.streamFirstByteTimeoutMs).toBe(30000)
    expect(runtime?.streamIdleTimeoutMs).toBe(300000)
    expect(runtime).not.toHaveProperty('requestTimeoutMs')
  })
})
