import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, resolve } from 'node:path'
import { loadConfig } from './ConfigLoader.js'

const originalRuntimeWorkspaceDir = process.env.RUNTIME_WORKSPACE_DIR
const originalRuntimeAgentLoopMaxSteps = process.env.RUNTIME_AGENT_LOOP_MAX_STEPS
const originalFilesystemCompatibilityMode = process.env.RUNTIME_FILESYSTEM_COMPATIBILITY_MODE
const originalRuntimeToolDeny = process.env.RUNTIME_TOOL_DENY
const originalContextLogDetail = process.env.RUNTIME_CONTEXT_LOG_DETAIL
const originalContextAuto = process.env.RUNTIME_CONTEXT_AUTO
const originalContextPrune = process.env.RUNTIME_CONTEXT_PRUNE
const originalAgentModelContextWindow = process.env.AGENT_MODEL_CONTEXT_WINDOW

const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config.json')
const originalConfigContent = readFileSync(configPath, 'utf-8')

describe('loadConfig runtime workspace', () => {
  afterEach(() => {
    restoreEnvVar('RUNTIME_WORKSPACE_DIR', originalRuntimeWorkspaceDir)
    restoreEnvVar('RUNTIME_AGENT_LOOP_MAX_STEPS', originalRuntimeAgentLoopMaxSteps)
    restoreEnvVar('RUNTIME_FILESYSTEM_COMPATIBILITY_MODE', originalFilesystemCompatibilityMode)
    restoreEnvVar('RUNTIME_TOOL_DENY', originalRuntimeToolDeny)
    restoreEnvVar('RUNTIME_CONTEXT_LOG_DETAIL', originalContextLogDetail)
    restoreEnvVar('RUNTIME_CONTEXT_AUTO', originalContextAuto)
    restoreEnvVar('RUNTIME_CONTEXT_PRUNE', originalContextPrune)
    restoreEnvVar('AGENT_MODEL_CONTEXT_WINDOW', originalAgentModelContextWindow)
    writeFileSync(configPath, originalConfigContent, 'utf-8')
  })

  it('resolves runtime workspace dir to an absolute path', () => {
    delete process.env.RUNTIME_WORKSPACE_DIR

    const config = loadConfig() as unknown as {
      runtime?: { workspaceDir?: string }
    }

    expect(config.runtime?.workspaceDir).toBeDefined()
    expect(isAbsolute(config.runtime?.workspaceDir || '')).toBe(true)
  })

  it('prefers RUNTIME_WORKSPACE_DIR over config and defaults', () => {
    process.env.RUNTIME_WORKSPACE_DIR = '/tmp/runtime-workspace'

    const config = loadConfig() as unknown as {
      runtime?: { workspaceDir?: string }
    }

    expect(config.runtime?.workspaceDir).toBe('/tmp/runtime-workspace')
  })

  it('loads auth base url from config', () => {
    const config = loadConfig() as unknown as {
      auth?: { baseUrl?: string }
    }

    expect(config.auth?.baseUrl).toBe('http://localhost:3200')
  })

  it('loads shipped request body limits from config', () => {
    const config = loadConfig() as unknown as {
      server?: {
        requestBodyLimits?: {
          defaultJson?: string
          fileSaveJson?: string
        }
      }
    }

    expect(config.server?.requestBodyLimits).toEqual({
      defaultJson: '2mb',
      fileSaveJson: '50mb'
    })
  })

  it('defaults request body limits when omitted', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.server = {
      ...((mutated.server || {}) as Record<string, unknown>)
    }
    delete (mutated.server as Record<string, unknown>).requestBodyLimits
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig() as unknown as {
      server?: {
        requestBodyLimits?: {
          defaultJson?: string
          fileSaveJson?: string
        }
      }
    }

    expect(config.server?.requestBodyLimits).toEqual({
      defaultJson: '2mb',
      fileSaveJson: '50mb'
    })
  })

  it('throws on invalid file save request body limit config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.server = mutated.server || {}
    const server = mutated.server as Record<string, unknown>
    server.requestBodyLimits = {
      defaultJson: '2mb',
      fileSaveJson: ''
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow('server.requestBodyLimits.fileSaveJson must be a non-empty string.')
  })

  it('defaults auth base url to empty string when omitted', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    delete mutated.auth
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig() as unknown as {
      auth?: { baseUrl?: string }
    }

    expect(config.auth?.baseUrl).toBe('')
  })

  it('loads filesystem tool compatibility mode from shipped config', () => {
    delete process.env.RUNTIME_FILESYSTEM_COMPATIBILITY_MODE

    const config = loadConfig() as unknown as {
      runtime?: {
        filesystemTools?: { compatibilityMode?: boolean }
        managedSkills?: {
          registryPath?: string
          packagesDir?: string
        }
      }
    }

    expect(config.runtime?.filesystemTools?.compatibilityMode).toBe(true)
    expect(config.runtime?.managedSkills?.registryPath).toBeDefined()
    expect(isAbsolute(config.runtime?.managedSkills?.registryPath || '')).toBe(true)
    expect(config.runtime?.managedSkills?.packagesDir).toBeDefined()
    expect(isAbsolute(config.runtime?.managedSkills?.packagesDir || '')).toBe(true)
  })

  it('resolves configured managed skill runtime paths to absolute paths', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.managedSkills = {
      registryPath: './runtime-data/managed-skills.json',
      packagesDir: './runtime-data/skills'
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig() as unknown as {
      runtime?: {
        managedSkills?: {
          registryPath?: string
          packagesDir?: string
        }
      }
    }

    expect(config.runtime?.managedSkills?.registryPath).toBe(resolve(dirname(configPath), 'runtime-data', 'managed-skills.json'))
    expect(config.runtime?.managedSkills?.packagesDir).toBe(resolve(dirname(configPath), 'runtime-data', 'skills'))
  })

  it('throws on invalid managed skill runtime path config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.managedSkills = {
      registryPath: '',
      packagesDir: './runtime-data/skills'
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow('runtime.managedSkills.registryPath must be a non-empty string.')
  })

  it('loads runtime tool deny list from shipped config', () => {
    delete process.env.RUNTIME_TOOL_DENY

    const config = loadConfig() as unknown as {
      runtime?: {
        tools?: {
          deny?: string[]
          displayNames?: Record<string, string>
        }
      }
    }

    expect(config.runtime?.tools?.deny).toEqual([])
    expect(config.runtime?.tools?.displayNames).toMatchObject({
      'local:grep': '搜索文件内容',
      'local:question': '等待你回答',
      'skill:read_asset': '读取技能文件'
    })
  })

  it('defaults agent loop max steps to 20', () => {
    delete process.env.RUNTIME_AGENT_LOOP_MAX_STEPS

    const config = loadConfig() as unknown as {
      runtime?: {
        agentLoop?: {
          maxSteps?: number
          modelRecovery?: { maxCorrectionCalls?: number }
          loopDetection?: {
            enabled?: boolean
            sameFailureThreshold?: number
            sameOutcomeThreshold?: number
          }
        }
        tools?: {
          runtimeRetry?: { maxAttempts?: number }
        }
      }
    }

    expect(config.runtime?.agentLoop?.maxSteps).toBe(20)
    expect(config.runtime?.agentLoop?.modelRecovery?.maxCorrectionCalls).toBe(1)
    expect(config.runtime?.agentLoop?.loopDetection).toEqual({
      enabled: true,
      sameFailureThreshold: 2,
      sameOutcomeThreshold: 3
    })
    expect(config.runtime?.tools?.runtimeRetry?.maxAttempts).toBe(0)
  })

  it('defaults workspace-agent runtime to build with planner disabled', () => {
    delete process.env.RUNTIME_WORKSPACE_DIR

    const config = loadConfig() as unknown as {
      runtime?: {
        workspaceAgent?: {
          plannerEnabled?: boolean
          defaultPrimaryAgent?: string
        }
      }
    }

    expect(config.runtime?.workspaceAgent?.plannerEnabled).toBe(false)
    expect(config.runtime?.workspaceAgent?.defaultPrimaryAgent).toBe('build')
  })

  it('prefers RUNTIME_AGENT_LOOP_MAX_STEPS over config and defaults', () => {
    process.env.RUNTIME_AGENT_LOOP_MAX_STEPS = '24'

    const config = loadConfig() as unknown as {
      runtime?: {
        agentLoop?: { maxSteps?: number }
      }
    }

    expect(config.runtime?.agentLoop?.maxSteps).toBe(24)
  })

  it('falls back to default max steps for invalid RUNTIME_AGENT_LOOP_MAX_STEPS', () => {
    process.env.RUNTIME_AGENT_LOOP_MAX_STEPS = 'invalid'

    const config = loadConfig() as unknown as {
      runtime?: {
        agentLoop?: { maxSteps?: number }
      }
    }

    expect(config.runtime?.agentLoop?.maxSteps).toBe(20)
  })

  it('prefers RUNTIME_FILESYSTEM_COMPATIBILITY_MODE over config and defaults', () => {
    process.env.RUNTIME_FILESYSTEM_COMPATIBILITY_MODE = 'true'

    const config = loadConfig() as unknown as {
      runtime?: {
        filesystemTools?: { compatibilityMode?: boolean }
      }
    }

    expect(config.runtime?.filesystemTools?.compatibilityMode).toBe(true)
  })

  it('prefers RUNTIME_TOOL_DENY over config and defaults', () => {
    process.env.RUNTIME_TOOL_DENY = 'local:grep, gateway:default:normalize_rows'

    const config = loadConfig() as unknown as {
      runtime?: {
        tools?: { deny?: string[] }
      }
    }

    expect(config.runtime?.tools?.deny).toEqual([
      'local:grep',
      'gateway:default:normalize_rows'
    ])
  })

  it('defaults runtime context log detail to true', () => {
    delete process.env.RUNTIME_CONTEXT_LOG_DETAIL

    const config = loadConfig() as unknown as {
      runtime?: { context?: { logDetail?: boolean } }
    }

    expect(config.runtime?.context?.logDetail).toBe(true)
  })

  it('prefers RUNTIME_CONTEXT_LOG_DETAIL over config', () => {
    process.env.RUNTIME_CONTEXT_LOG_DETAIL = 'true'

    const config = loadConfig() as unknown as {
      runtime?: { context?: { logDetail?: boolean } }
    }

    expect(config.runtime?.context?.logDetail).toBe(true)
  })

  it('prefers RUNTIME_CONTEXT_AUTO and RUNTIME_CONTEXT_PRUNE over config', () => {
    process.env.RUNTIME_CONTEXT_AUTO = 'false'
    process.env.RUNTIME_CONTEXT_PRUNE = 'false'

    const config = loadConfig() as unknown as {
      runtime?: { context?: { auto?: boolean; prune?: boolean } }
    }

    expect(config.runtime?.context?.auto).toBe(false)
    expect(config.runtime?.context?.prune).toBe(false)
  })

  it('does not expose runtime sandbox config or honor legacy sandbox env overrides', () => {
    process.env.RUNTIME_SANDBOX_BACKEND = 'macos-seatbelt'
    process.env.RUNTIME_SANDBOX_TIMEOUT_SECONDS = '9'
    process.env.RUNTIME_SANDBOX_CPU_SECONDS = '7'
    process.env.RUNTIME_SANDBOX_MEMORY_MB = '256'

    const config = loadConfig() as unknown as {
      runtime?: Record<string, unknown>
    }

    expect(config.runtime).toBeDefined()
    expect(config.runtime).not.toHaveProperty('sandbox')
  })

  it('throws on invalid runtime context config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.context = {
      auto: 'bad',
      prune: true,
      logDetail: false
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow()
  })

  it('throws on invalid workspace-agent runtime config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.workspaceAgent = {
      plannerEnabled: 'bad',
      defaultPrimaryAgent: 'invalid'
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow()
  })

  it('throws on invalid tool failure policy config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.agentLoop = {
      maxSteps: 20,
      modelRecovery: {
        maxCorrectionCalls: -1
      },
      loopDetection: {
        enabled: true,
        sameFailureThreshold: 2,
        sameOutcomeThreshold: 3
      }
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow('Invalid runtime.agentLoop.modelRecovery.maxCorrectionCalls: must be a non-negative integer.')
  })

  it('throws on invalid runtime retry config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.tools = {
      deny: [],
      runtimeRetry: {
        maxAttempts: 'bad'
      }
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow('Invalid runtime.tools.runtimeRetry.maxAttempts: must be a non-negative integer.')
  })

  it('throws on invalid runtime tool display-name config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.tools = {
      deny: [],
      displayNames: {
        'local:question': ''
      },
      runtimeRetry: {
        maxAttempts: 0
      }
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow('runtime.tools.displayNames.local:question must be a non-empty string.')
  })

  it('ignores legacy sandbox config blocks from config.json', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.runtime = mutated.runtime || {}
    const runtime = mutated.runtime as Record<string, unknown>
    runtime.sandbox = {
      backend: 'invalid-backend',
      timeoutSeconds: 30,
      cpuSeconds: 20,
      memoryMb: 512
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig() as unknown as {
      runtime?: Record<string, unknown>
    }

    expect(config.runtime).not.toHaveProperty('sandbox')
  })

  it('loads default agent model from config', () => {
    const config = loadConfig() as unknown as {
      agent?: {
        defaultModel?: {
          provider?: string
          modelName?: string
          contextWindow?: number
          maxTokens?: number
          stream?: boolean
          streamFirstByteTimeoutMs?: number
          streamIdleTimeoutMs?: number
        } | null
      }
    }

    expect(config.agent?.defaultModel?.provider).toBe('openai')
    expect(config.agent?.defaultModel?.modelName).toBe('deepseek-chat')
    expect(config.agent?.defaultModel?.maxTokens).toBe(8192)
    expect(config.agent?.defaultModel?.stream).toBe(true)
    expect(config.agent?.defaultModel?.streamFirstByteTimeoutMs).toBe(300000)
    expect(config.agent?.defaultModel?.streamIdleTimeoutMs).toBe(300000)
    expect(config.agent?.defaultModel?.contextWindow).toBe(131072)
  })

  it('defaults omitted model stream config to true', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    const agent = (mutated.agent || {}) as Record<string, unknown>
    const defaultModel = { ...((agent.defaultModel || {}) as Record<string, unknown>) }

    delete defaultModel.stream
    agent.defaultModel = defaultModel
    mutated.agent = agent
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig()

    expect(config.agent.defaultModel?.stream).toBe(true)
  })

  it('preserves explicit stream false on defaultModel', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    const agent = (mutated.agent || {}) as Record<string, unknown>
    agent.defaultModel = {
      ...((agent.defaultModel || {}) as Record<string, unknown>),
      stream: false
    }
    mutated.agent = agent
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig()

    expect(config.agent.defaultModel?.stream).toBe(false)
  })

  it('ignores legacy model timeout override environment variables', () => {
    process.env.AGENT_MODEL_REQUEST_TIMEOUT_MS = '111'
    process.env.AGENT_MODEL_STREAM_FIRST_BYTE_TIMEOUT_MS = '222'
    process.env.AGENT_MODEL_STREAM_IDLE_TIMEOUT_MS = '333'

    const config = loadConfig()

    expect(config.agent.defaultModel?.streamFirstByteTimeoutMs).toBe(300000)
    expect(config.agent.defaultModel?.streamIdleTimeoutMs).toBe(300000)
  })

  it('prefers AGENT_MODEL_CONTEXT_WINDOW over config', () => {
    process.env.AGENT_MODEL_CONTEXT_WINDOW = '65536'

    const config = loadConfig() as unknown as {
      agent?: {
        defaultModel?: {
          contextWindow?: number
        } | null
      }
    }

    expect(config.agent?.defaultModel?.contextWindow).toBe(65536)
  })

  it('maps legacy agent.activeModel into modelsByAgent.activeModel', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.agent = mutated.agent || {}
    const agent = mutated.agent as Record<string, unknown>
    agent.modelRegistry = {
      huaweiHisApi: {
        provider: 'huaweiHisApi',
        modelName: 'deepseek-chat',
        apiEndpoint: 'https://api.deepseek.com',
        maxTokens: 8192,
        stream: false,
        streamFirstByteTimeoutMs: 30000,
        streamIdleTimeoutMs: 300000
      }
    }
    agent.activeModel = 'huaweiHisApi'
    agent.modelsByAgent = {}
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig()

    expect(config.agent.modelsByAgent.activeModel).toMatchObject({
      provider: 'huaweiHisApi',
      modelName: 'deepseek-chat',
      apiEndpoint: 'https://api.deepseek.com',
      maxTokens: 8192,
      stream: false,
      streamFirstByteTimeoutMs: 30000,
      streamIdleTimeoutMs: 300000
    })
  })

  it('preserves stream resolution across modelRegistry and modelsByAgent', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    const agent = (mutated.agent || {}) as Record<string, unknown>
    agent.modelRegistry = {
      registryNonStream: {
        provider: 'openai',
        modelName: 'gpt-4.1',
        stream: false
      }
    }
    agent.modelsByAgent = {
      build: 'registryNonStream',
      review: {
        provider: 'openai',
        modelName: 'gpt-4.1-mini',
        stream: false
      }
    }
    mutated.agent = agent
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig()

    expect(config.agent.modelRegistry.registryNonStream.stream).toBe(false)
    expect(config.agent.modelsByAgent.build.stream).toBe(false)
    expect(config.agent.modelsByAgent.review.stream).toBe(false)
  })

  it('loads shipped huaweiHisApi registry baseline from config', () => {
    const config = loadConfig()

    expect(config.agent.modelRegistry.huaweiHisApi).toMatchObject({
      provider: 'huaweiHisApi',
      modelName: 'deepseek-chat',
      apiEndpoint: 'https://api.deepseek.com',
      maxTokens: 8192,
      stream: true,
      streamFirstByteTimeoutMs: 300000,
      streamIdleTimeoutMs: 300000,
      thinking: {
        enabled: true
      },
      custom: {
        headers: {
          'X-Token': 'xxxx',
          HWID: 'xxxx'
        },
        body: {
          chat_template_kwargs: {
            enable_thinking: true
          }
        }
      }
    })
  })

  it('rejects sampling fields on inline modelsByAgent config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    const agent = (mutated.agent || {}) as Record<string, unknown>
    agent.modelsByAgent = {
      build: {
        provider: 'openai',
        modelName: 'gpt-4.1',
        temperature: 0.7
      }
    }
    mutated.agent = agent
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow(
      'modelsByAgent.build cannot declare temperature/topP/topK directly; reference modelRegistry instead.'
    )
  })

  it('allows modelsByAgent string references to inherit sampling fields from modelRegistry', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    const agent = (mutated.agent || {}) as Record<string, unknown>
    agent.modelRegistry = {
      sampledModel: {
        provider: 'openai',
        modelName: 'gpt-4.1',
        temperature: 0.6,
        topP: 0.9,
        topK: 18
      }
    }
    agent.modelsByAgent = {
      build: 'sampledModel'
    }
    mutated.agent = agent
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig()

    expect(config.agent.modelsByAgent.build).toMatchObject({
      provider: 'openai',
      modelName: 'gpt-4.1',
      temperature: 0.6,
      topP: 0.9,
      topK: 18
    })
  })

  it('throws on invalid agent model context window config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.agent = mutated.agent || {}
    const agent = mutated.agent as Record<string, unknown>
    agent.defaultModel = {
      provider: 'deepseek',
      modelName: 'deepseek-chat',
      contextWindow: 0
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow('Invalid agent.defaultModel.contextWindow: must be a positive integer.')
  })

  it.each([
    {
      label: 'agent.defaultModel',
      mutate: (agent: Record<string, unknown>) => {
        const defaultModel = (agent.defaultModel ?? {}) as Record<string, unknown>
        defaultModel.requestTimeoutMs = 1000
        agent.defaultModel = defaultModel
      }
    },
    {
      label: 'agent.modelRegistry.huaweiHisApi',
      mutate: (agent: Record<string, unknown>) => {
        const modelRegistry = (agent.modelRegistry ?? {}) as Record<string, unknown>
        const registryModel = (modelRegistry.huaweiHisApi ?? {}) as Record<string, unknown>
        registryModel.requestTimeoutMs = 1000
        modelRegistry.huaweiHisApi = registryModel
        agent.modelRegistry = modelRegistry
      }
    },
    {
      label: 'agent.modelsByAgent.build',
      mutate: (agent: Record<string, unknown>) => {
        agent.modelsByAgent = {
          build: {
            provider: 'openai',
            modelName: 'deepseek-chat',
            requestTimeoutMs: 1000
          }
        }
      }
    }
  ])('rejects legacy requestTimeoutMs in $label', ({ label, mutate }) => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    const agent = (mutated.agent ?? {}) as Record<string, unknown>

    mutate(agent)
    mutated.agent = agent
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    expect(() => loadConfig()).toThrow(
      `Legacy ${label}.requestTimeoutMs is no longer supported; use ${label}.streamFirstByteTimeoutMs and ${label}.streamIdleTimeoutMs instead.`
    )
  })

  it('loads provider request headers from config', () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.agent = mutated.agent || {}
    const agent = mutated.agent as Record<string, unknown>
    agent.defaultModel = {
      provider: 'hw',
      modelName: 'hw-chat',
      headers: {
        'X-Real-IP': '127.0.0.1',
        'X-HW-ID': 'device-1',
        'X-HW-APPKEY': ''
      }
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const config = loadConfig() as unknown as {
      agent?: {
        defaultModel?: {
          provider?: string
          headers?: Record<string, string>
        } | null
      }
    }

    expect(config.agent?.defaultModel?.provider).toBe('hw')
    expect(config.agent?.defaultModel?.headers).toEqual({
      'X-Real-IP': '127.0.0.1',
      'X-HW-ID': 'device-1',
      'X-HW-APPKEY': ''
    })
  })
})

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}
