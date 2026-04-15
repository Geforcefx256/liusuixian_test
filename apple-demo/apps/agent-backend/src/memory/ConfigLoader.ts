/**
 * Configuration Loader
 *
 * Loads configuration from config.json with support for:
 * - Environment variable substitution (${VAR} and ${VAR:-default})
 * - Environment variable overrides
 * - Relative path resolution
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { MemoryConfig, EmbeddingProviderConfig } from './types.js'
import type { AgentModelConfig } from '../agent/types.js'
import type {
  LoopDetectionPolicy,
  ModelRecoveryPolicy,
  RuntimeRetryPolicy
} from '../agent/toolFailurePolicy.js'
import { resolveModelContextWindow } from '../agent/modelDefaults.js'
import { resolveBackendRoot } from '../support/runtimePaths.js'
import {
  DEFAULT_CONTEXT_AUTO,
  DEFAULT_CONTEXT_LOG_DETAIL,
  DEFAULT_CONTEXT_PRUNE
} from '../agent/service/constants.js'
import {
  BUILD_PRIMARY_AGENT,
  PLAN_PRIMARY_AGENT
} from '../agent/workspace/constants.js'
import { createLogger } from '../logging/index.js'

// ============================================================================
// Configuration Types
// ============================================================================

export interface HttpsConfig {
  enabled: boolean
  key: string
  cert: string
}

export interface RequestBodyLimitsConfig {
  defaultJson: string
  fileSaveJson: string
}

export interface ServerConfig {
  port: number
  host: string
  https?: HttpsConfig
  requestBodyLimits: RequestBodyLimitsConfig
}

export interface SameOriginProtectionConfig {
  enabled: boolean
  allowedOrigins: string[]
}

export type RuntimeLogSwitch = 'on' | 'off'
export type RuntimeFileLogFormat = 'jsonl'
export type RuntimeFileLogSplit = 'daily'

export interface RuntimeFileLoggingConfig {
  enabled: boolean
  directory: string
  format: RuntimeFileLogFormat
  split: RuntimeFileLogSplit
  redactSensitive: boolean
}

export interface RuntimeManagedSkillsConfig {
  registryPath: string
  packagesDir: string
}

export type RuntimeToolDisplayNames = Record<string, string>

export interface Config {
  server: ServerConfig
  memory: { workspaceDir: string; dbPath: string }
  auth: { baseUrl: string; sameOriginProtection: SameOriginProtectionConfig }
  runtime: {
    workspaceDir: string
    agentLoop: {
      maxSteps: number
      modelRecovery: ModelRecoveryPolicy
      loopDetection: LoopDetectionPolicy
    }
    workspaceAgent: {
      plannerEnabled: boolean
      defaultPrimaryAgent: 'plan' | 'build'
    }
    filesystemTools: {
      compatibilityMode: boolean
    }
    tools: {
      deny: string[]
      displayNames: RuntimeToolDisplayNames
      runtimeRetry: RuntimeRetryPolicy
    }
    context: {
      auto: boolean
      prune: boolean
      logDetail: boolean
    }
    providerLogging: RuntimeLogSwitch
    managedSkills: RuntimeManagedSkillsConfig
    fileLogging: RuntimeFileLoggingConfig
  }
  embedding: EmbeddingProviderConfig
  agent: {
    defaultModel: AgentModelConfig | null
    modelRegistry: Record<string, AgentModelConfig>
    activeModel?: string
    modelsByAgent: Record<string, AgentModelConfig>
  }
  search: {
    vectorWeight: number
    keywordWeight: number
    chunkSize: number
    chunkOverlap: number
    searchLimit: number
  }
}

export interface ConfigLoadDiagnostics {
  configPath: string
  configRoot: string
  configSource: 'config.json' | 'defaults'
}

interface RawConfig {
  server?: {
    port?: number
    host?: string
    https?: HttpsConfig
    requestBodyLimits?: {
      defaultJson?: unknown
      fileSaveJson?: unknown
    }
  }
  memory?: { workspaceDir?: string; dbPath?: string }
  auth?: {
    baseUrl?: string
    sameOriginProtection?: {
      enabled?: boolean
      allowedOrigins?: string[]
    }
  }
  runtime?: {
    workspaceDir?: string
    agentLoop?: {
      maxSteps?: number
      modelRecovery?: {
        maxCorrectionCalls?: unknown
      }
      loopDetection?: {
        enabled?: unknown
        sameFailureThreshold?: unknown
        sameOutcomeThreshold?: unknown
      }
    }
    workspaceAgent?: {
      plannerEnabled?: unknown
      defaultPrimaryAgent?: unknown
    }
    filesystemTools?: {
      compatibilityMode?: boolean
    }
    tools?: {
      deny?: unknown
      displayNames?: unknown
      runtimeRetry?: {
        maxAttempts?: unknown
      }
    }
    context?: {
      auto?: unknown
      prune?: unknown
      logDetail?: unknown
    }
    providerLogging?: unknown
    managedSkills?: {
      registryPath?: unknown
      packagesDir?: unknown
    }
    fileLogging?: {
      enabled?: unknown
      directory?: unknown
      format?: unknown
      split?: unknown
      redactSensitive?: unknown
    }
    logging?: {
      providerLogging?: unknown
    }
  }
  embedding?: EmbeddingProviderConfig
  agent?: {
    defaultModel?: AgentModelConfig | null
    modelRegistry?: Record<string, AgentModelConfig>
    activeModel?: string
    modelsByAgent?: Record<string, AgentModelConfig | string>
  }
  search?: {
    vectorWeight?: number
    keywordWeight?: number
    chunkSize?: number
    chunkOverlap?: number
    searchLimit?: number
  }
}

const configLoaderLogger = createLogger({
  category: 'runtime',
  component: 'config_loader'
})

const DEFAULT_RUNTIME_TOOL_DISPLAY_NAMES: RuntimeToolDisplayNames = Object.freeze({
  'local:read_file': '读取工作区文件',
  'local:list_directory': '查看工作区目录',
  'local:find_files': '查找工作区文件',
  'local:grep': '搜索文件内容',
  'local:write': '写入工作区文件',
  'local:edit': '编辑工作区文件',
  'local:question': '等待你回答',
  'skill:skill': '加载技能说明',
  'skill:read_asset': '读取技能文件',
  'skill:list_assets': '查看技能目录',
  'skill:find_assets': '查找技能文件',
  'skill:exec': '执行技能脚本'
})

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_CONFIG: Config = {
  server: {
    port: 3100,
    host: '127.0.0.1',
    https: {
      enabled: false,
      key: './certs/key.pem',
      cert: './certs/cert.pem'
    },
    requestBodyLimits: {
      defaultJson: '2mb',
      fileSaveJson: '50mb'
    }
  },
  memory: {
    workspaceDir: './workspace',
    dbPath: './data/memory.db'
  },
  auth: {
    baseUrl: '',
    sameOriginProtection: {
      enabled: true,
      allowedOrigins: []
    }
  },
  runtime: {
    workspaceDir: '../..',
    agentLoop: {
      maxSteps: 50,
      modelRecovery: {
        maxCorrectionCalls: 1
      },
      loopDetection: {
        enabled: true,
        sameFailureThreshold: 2,
        sameOutcomeThreshold: 3
      }
    },
    workspaceAgent: {
      plannerEnabled: false,
      defaultPrimaryAgent: BUILD_PRIMARY_AGENT
    },
    filesystemTools: {
      compatibilityMode: true
    },
    tools: {
      deny: [],
      displayNames: { ...DEFAULT_RUNTIME_TOOL_DISPLAY_NAMES },
      runtimeRetry: {
        maxAttempts: 0
      }
    },
    context: {
      auto: DEFAULT_CONTEXT_AUTO,
      prune: DEFAULT_CONTEXT_PRUNE,
      logDetail: DEFAULT_CONTEXT_LOG_DETAIL
    },
    providerLogging: 'off',
    managedSkills: {
      registryPath: './data/managed-skills.json',
      packagesDir: './data/skills'
    },
    fileLogging: {
      enabled: false,
      directory: './data/logs',
      format: 'jsonl',
      split: 'daily',
      redactSensitive: true
    }
  },
  embedding: {
    provider: 'none'
  },
  agent: {
    defaultModel: null,
    modelRegistry: {},
    activeModel: undefined,
    modelsByAgent: {}
  },
  search: {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    chunkSize: 400,
    chunkOverlap: 80,
    searchLimit: 6
  }
}

// ============================================================================
// Environment Variable Substitution
// ============================================================================

/**
 * Substitute environment variables in a string
 * Supports ${VAR} and ${VAR:-default} syntax
 */
function substituteEnvVars(value: string): string {
  // Match ${VAR} or ${VAR:-default}
  const envVarPattern = /\$\{([^}]+)\}/g

  return value.replace(envVarPattern, (match, expr) => {
    // Check for default value syntax: VAR:-default
    const colonIndex = expr.indexOf(':-')

    if (colonIndex !== -1) {
      const varName = expr.substring(0, colonIndex).trim()
      const defaultValue = expr.substring(colonIndex + 2).trim()
      return process.env[varName] || defaultValue
    }

    // Simple variable substitution: ${VAR}
    const varName = expr.trim()
    return process.env[varName] || ''
  })
}

/**
 * Recursively substitute environment variables in an object
 */
function substituteEnvVarsDeep<T>(obj: T): T {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj) as T
  }

  if (Array.isArray(obj)) {
    return obj.map(item => substituteEnvVarsDeep(item)) as T
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsDeep(value)
    }
    return result as T
  }

  return obj
}

function parseListEnv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }

  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be a string array.`)
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error(`${fieldName}[${index}] must be a non-empty string.`)
    }
    return item.trim()
  })
}

function parseStringRecord(value: unknown, fieldName: string): Record<string, string> {
  if (value === undefined) {
    return {}
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object of string values.`)
  }
  return Object.entries(value).reduce<Record<string, string>>((record, [key, entryValue]) => {
    const nextKey = key.trim()
    if (!nextKey) {
      throw new Error(`${fieldName} must not contain empty keys.`)
    }
    if (typeof entryValue !== 'string' || entryValue.trim().length === 0) {
      throw new Error(`${fieldName}.${nextKey} must be a non-empty string.`)
    }
    record[nextKey] = entryValue.trim()
    return record
  }, {})
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get the directory of the config file
 */
function getConfigDir(): string {
  const override = process.env.APPLE_DEMO_AGENT_BACKEND_ROOT?.trim()
  if (override) {
    return resolve(override)
  }
  return resolveBackendRoot(import.meta.url, 2)
}

/**
 * Resolve a path relative to the service root
 */
function resolvePath(pathStr: string): string {
  if (!pathStr) return pathStr

  // Already absolute path
  if (pathStr.startsWith('/') || /^[A-Za-z]:/.test(pathStr)) {
    return pathStr
  }

  // Resolve relative to service root
  return resolve(getConfigDir(), pathStr)
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Read config.json file
 */
function readConfigFile(): RawConfig {
  const diagnostics = getConfigLoadDiagnostics()

  try {
    const content = readFileSync(diagnostics.configPath, 'utf-8')
    return JSON.parse(content) as RawConfig
  } catch {
    // Config file doesn't exist or is invalid, return empty config
    return {}
  }
}

export function getConfigLoadDiagnostics(): ConfigLoadDiagnostics {
  const configRoot = getConfigDir()
  const configPath = join(configRoot, 'config.json')
  return {
    configPath,
    configRoot,
    configSource: existsSync(configPath) ? 'config.json' : 'defaults'
  }
}

/**
 * Apply environment variable overrides
 */
function applyEnvOverrides(config: Config): Config {
  const result = { ...config }
  const sameOriginAllowedOrigins = parseListEnv(process.env.SAME_ORIGIN_ALLOWED_ORIGINS)

  // Server port override
  if (process.env.SERVER_PORT) {
    const port = parseInt(process.env.SERVER_PORT, 10)
    if (!isNaN(port)) {
      result.server = { ...result.server, port }
    }
  }

  // Memory workspace dir override
  if (process.env.MEMORY_WORKSPACE_DIR) {
    result.memory = { ...result.memory, workspaceDir: process.env.MEMORY_WORKSPACE_DIR }
  }

  // Memory db path override
  if (process.env.MEMORY_DB_PATH) {
    result.memory = { ...result.memory, dbPath: process.env.MEMORY_DB_PATH }
  }

  if (process.env.RUNTIME_WORKSPACE_DIR) {
    result.runtime = { ...result.runtime, workspaceDir: process.env.RUNTIME_WORKSPACE_DIR }
  }

  if (sameOriginAllowedOrigins) {
    result.auth = {
      ...result.auth,
      sameOriginProtection: {
        ...result.auth.sameOriginProtection,
        allowedOrigins: sameOriginAllowedOrigins
      }
    }
  }

  const runtimeAgentLoopMaxSteps = parsePositiveInteger(process.env.RUNTIME_AGENT_LOOP_MAX_STEPS)
  if (runtimeAgentLoopMaxSteps !== null) {
    result.runtime = {
      ...result.runtime,
      agentLoop: {
        ...result.runtime.agentLoop,
        maxSteps: runtimeAgentLoopMaxSteps
      }
    }
  }

  if (process.env.RUNTIME_FILESYSTEM_COMPATIBILITY_MODE) {
    result.runtime = {
      ...result.runtime,
      filesystemTools: {
        compatibilityMode: process.env.RUNTIME_FILESYSTEM_COMPATIBILITY_MODE === 'true'
      }
    }
  }

  if (process.env.RUNTIME_TOOL_DENY) {
    result.runtime = {
      ...result.runtime,
      tools: {
        ...result.runtime.tools,
        deny: process.env.RUNTIME_TOOL_DENY.split(',').map(item => item.trim()).filter(Boolean)
      }
    }
  }

  if (process.env.RUNTIME_CONTEXT_LOG_DETAIL) {
    result.runtime = {
      ...result.runtime,
      context: {
        ...result.runtime.context,
        logDetail: parseBooleanStrict(process.env.RUNTIME_CONTEXT_LOG_DETAIL, 'RUNTIME_CONTEXT_LOG_DETAIL')
      }
    }
  }

  if (process.env.RUNTIME_CONTEXT_AUTO) {
    result.runtime = {
      ...result.runtime,
      context: {
        ...result.runtime.context,
        auto: parseBooleanStrict(process.env.RUNTIME_CONTEXT_AUTO, 'RUNTIME_CONTEXT_AUTO')
      }
    }
  }

  if (process.env.RUNTIME_CONTEXT_PRUNE) {
    result.runtime = {
      ...result.runtime,
      context: {
        ...result.runtime.context,
        prune: parseBooleanStrict(process.env.RUNTIME_CONTEXT_PRUNE, 'RUNTIME_CONTEXT_PRUNE')
      }
    }
  }

  if (process.env.RUNTIME_PROVIDER_LOGGING) {
    result.runtime = {
      ...result.runtime,
      providerLogging: parseEnvLogSwitch(process.env.RUNTIME_PROVIDER_LOGGING, 'RUNTIME_PROVIDER_LOGGING')
    }
  }

  // Embedding provider override
  if (process.env.EMBEDDING_PROVIDER) {
    result.embedding = { ...result.embedding, provider: process.env.EMBEDDING_PROVIDER as 'openai' | 'none' }
  }

  // Embedding model override
  if (process.env.EMBEDDING_MODEL) {
    result.embedding = { ...result.embedding, model: process.env.EMBEDDING_MODEL }
  }

  // Embedding API key override
  if (process.env.OPENAI_API_KEY) {
    result.embedding = { ...result.embedding, apiKey: process.env.OPENAI_API_KEY }
  }

  // Embedding base URL override
  if (process.env.OPENAI_BASE_URL) {
    result.embedding = { ...result.embedding, baseUrl: process.env.OPENAI_BASE_URL }
  }

  // Agent model default overrides
  if (
    process.env.AGENT_MODEL_PROVIDER
    || process.env.AGENT_MODEL_NAME
    || process.env.AGENT_MODEL_API_KEY
    || process.env.AGENT_MODEL_API_ENDPOINT
    || process.env.AGENT_MODEL_MAX_TOKENS
    || process.env.AGENT_MODEL_CONTEXT_WINDOW
  ) {
    const base = result.agent.defaultModel || {
      provider: 'openai',
      modelName: 'gpt-4o-mini'
    }
    result.agent = {
      ...result.agent,
      defaultModel: {
        ...base,
        provider: (process.env.AGENT_MODEL_PROVIDER as AgentModelConfig['provider']) || base.provider,
        modelName: process.env.AGENT_MODEL_NAME || base.modelName,
        apiKey: process.env.AGENT_MODEL_API_KEY || base.apiKey,
        apiEndpoint: process.env.AGENT_MODEL_API_ENDPOINT || base.apiEndpoint,
        maxTokens: process.env.AGENT_MODEL_MAX_TOKENS
          ? parseInt(process.env.AGENT_MODEL_MAX_TOKENS, 10)
          : base.maxTokens,
        contextWindow: process.env.AGENT_MODEL_CONTEXT_WINDOW
          ? parseInt(process.env.AGENT_MODEL_CONTEXT_WINDOW, 10)
          : base.contextWindow
      }
    }
  }

  return result
}

/**
 * Merge raw config with defaults
 */
function mergeWithDefaults(raw: RawConfig): Config {
  const rawContext = raw.runtime?.context
  const rawAgentLoop = raw.runtime?.agentLoop
  assertNoLegacyContextKeys(rawContext)
  const runtimeAgentLoopMaxSteps = parsePositiveInteger(rawAgentLoop?.maxSteps)
    ?? DEFAULT_CONFIG.runtime.agentLoop.maxSteps
  const modelRecoveryMaxCorrectionCalls = rawAgentLoop?.modelRecovery?.maxCorrectionCalls === undefined
    ? DEFAULT_CONFIG.runtime.agentLoop.modelRecovery.maxCorrectionCalls
    : parseNonNegativeInteger(
      rawAgentLoop.modelRecovery.maxCorrectionCalls,
      'runtime.agentLoop.modelRecovery.maxCorrectionCalls'
    )
  const loopDetectionEnabled = rawAgentLoop?.loopDetection?.enabled === undefined
    ? DEFAULT_CONFIG.runtime.agentLoop.loopDetection.enabled
    : parseBooleanStrict(rawAgentLoop.loopDetection.enabled, 'runtime.agentLoop.loopDetection.enabled')
  const sameFailureThreshold = rawAgentLoop?.loopDetection?.sameFailureThreshold === undefined
    ? DEFAULT_CONFIG.runtime.agentLoop.loopDetection.sameFailureThreshold
    : parseNonNegativeInteger(
      rawAgentLoop.loopDetection.sameFailureThreshold,
      'runtime.agentLoop.loopDetection.sameFailureThreshold'
    )
  const sameOutcomeThreshold = rawAgentLoop?.loopDetection?.sameOutcomeThreshold === undefined
    ? DEFAULT_CONFIG.runtime.agentLoop.loopDetection.sameOutcomeThreshold
    : parseNonNegativeInteger(
      rawAgentLoop.loopDetection.sameOutcomeThreshold,
      'runtime.agentLoop.loopDetection.sameOutcomeThreshold'
    )
  const runtimeRetryMaxAttempts = raw.runtime?.tools?.runtimeRetry?.maxAttempts === undefined
    ? DEFAULT_CONFIG.runtime.tools.runtimeRetry.maxAttempts
    : parseNonNegativeInteger(
      raw.runtime.tools.runtimeRetry.maxAttempts,
      'runtime.tools.runtimeRetry.maxAttempts'
    )
  const contextAuto = rawContext?.auto === undefined
    ? DEFAULT_CONFIG.runtime.context.auto
    : parseBooleanStrict(rawContext.auto, 'runtime.context.auto')
  const contextPrune = rawContext?.prune === undefined
    ? DEFAULT_CONFIG.runtime.context.prune
    : parseBooleanStrict(rawContext.prune, 'runtime.context.prune')
  const contextLogDetail = rawContext?.logDetail === undefined
    ? DEFAULT_CONFIG.runtime.context.logDetail
    : parseBooleanStrict(rawContext.logDetail, 'runtime.context.logDetail')
  const providerLogging = raw.runtime?.providerLogging !== undefined
    ? parseLogSwitch(raw.runtime.providerLogging, 'runtime.providerLogging')
    : raw.runtime?.logging?.providerLogging !== undefined
      ? parseLogSwitch(raw.runtime.logging.providerLogging, 'runtime.logging.providerLogging')
      : DEFAULT_CONFIG.runtime.providerLogging
  const rawFileLogging = raw.runtime?.fileLogging
  const rawManagedSkills = raw.runtime?.managedSkills
  const rawWorkspaceAgent = raw.runtime?.workspaceAgent
  return {
    server: {
      port: raw.server?.port ?? DEFAULT_CONFIG.server.port,
      host: raw.server?.host ?? DEFAULT_CONFIG.server.host,
      https: raw.server?.https ? {
        enabled: raw.server.https.enabled ?? false,
        key: raw.server.https.key ?? DEFAULT_CONFIG.server.https!.key,
        cert: raw.server.https.cert ?? DEFAULT_CONFIG.server.https!.cert
      } : DEFAULT_CONFIG.server.https,
      requestBodyLimits: {
        defaultJson: parseRequestBodyLimit(
          raw.server?.requestBodyLimits?.defaultJson,
          'server.requestBodyLimits.defaultJson',
          DEFAULT_CONFIG.server.requestBodyLimits.defaultJson
        ),
        fileSaveJson: parseRequestBodyLimit(
          raw.server?.requestBodyLimits?.fileSaveJson,
          'server.requestBodyLimits.fileSaveJson',
          DEFAULT_CONFIG.server.requestBodyLimits.fileSaveJson
        )
      }
    },
    memory: {
      workspaceDir: raw.memory?.workspaceDir ?? DEFAULT_CONFIG.memory.workspaceDir,
      dbPath: raw.memory?.dbPath ?? DEFAULT_CONFIG.memory.dbPath
    },
    auth: {
      baseUrl: raw.auth?.baseUrl ?? DEFAULT_CONFIG.auth.baseUrl,
      sameOriginProtection: {
        enabled: raw.auth?.sameOriginProtection?.enabled ?? DEFAULT_CONFIG.auth.sameOriginProtection.enabled,
        allowedOrigins: raw.auth?.sameOriginProtection?.allowedOrigins ?? DEFAULT_CONFIG.auth.sameOriginProtection.allowedOrigins
      }
    },
    runtime: {
      workspaceDir: raw.runtime?.workspaceDir ?? DEFAULT_CONFIG.runtime.workspaceDir,
      agentLoop: {
        maxSteps: runtimeAgentLoopMaxSteps,
        modelRecovery: {
          maxCorrectionCalls: modelRecoveryMaxCorrectionCalls
        },
        loopDetection: {
          enabled: loopDetectionEnabled,
          sameFailureThreshold,
          sameOutcomeThreshold
        }
      },
      workspaceAgent: {
        plannerEnabled: rawWorkspaceAgent?.plannerEnabled === undefined
          ? DEFAULT_CONFIG.runtime.workspaceAgent.plannerEnabled
          : parseBooleanStrict(rawWorkspaceAgent.plannerEnabled, 'runtime.workspaceAgent.plannerEnabled'),
        defaultPrimaryAgent: parseWorkspacePrimaryAgent(
          rawWorkspaceAgent?.defaultPrimaryAgent,
          'runtime.workspaceAgent.defaultPrimaryAgent'
        ) ?? DEFAULT_CONFIG.runtime.workspaceAgent.defaultPrimaryAgent
      },
      filesystemTools: {
        compatibilityMode: raw.runtime?.filesystemTools?.compatibilityMode
          ?? DEFAULT_CONFIG.runtime.filesystemTools.compatibilityMode
      },
      tools: {
        deny: parseStringArray(raw.runtime?.tools?.deny, 'runtime.tools.deny'),
        displayNames: {
          ...DEFAULT_CONFIG.runtime.tools.displayNames,
          ...parseStringRecord(raw.runtime?.tools?.displayNames, 'runtime.tools.displayNames')
        },
        runtimeRetry: {
          maxAttempts: runtimeRetryMaxAttempts
        }
      },
      context: {
        auto: contextAuto,
        prune: contextPrune,
        logDetail: contextLogDetail
      },
      providerLogging,
      managedSkills: {
        registryPath: parseRuntimeManagedSkillsPath(
          rawManagedSkills?.registryPath,
          'runtime.managedSkills.registryPath',
          DEFAULT_CONFIG.runtime.managedSkills.registryPath
        ),
        packagesDir: parseRuntimeManagedSkillsPath(
          rawManagedSkills?.packagesDir,
          'runtime.managedSkills.packagesDir',
          DEFAULT_CONFIG.runtime.managedSkills.packagesDir
        )
      },
      fileLogging: {
        enabled: rawFileLogging?.enabled === undefined
          ? DEFAULT_CONFIG.runtime.fileLogging.enabled
          : parseBooleanStrict(rawFileLogging.enabled, 'runtime.fileLogging.enabled'),
        directory: parseRuntimeFileLoggingDirectory(rawFileLogging?.directory),
        format: parseRuntimeFileLogFormat(rawFileLogging?.format, 'runtime.fileLogging.format'),
        split: parseRuntimeFileLogSplit(rawFileLogging?.split, 'runtime.fileLogging.split'),
        redactSensitive: rawFileLogging?.redactSensitive === undefined
          ? DEFAULT_CONFIG.runtime.fileLogging.redactSensitive
          : parseBooleanStrict(rawFileLogging.redactSensitive, 'runtime.fileLogging.redactSensitive')
      }
    },
    embedding: {
      provider: raw.embedding?.provider ?? DEFAULT_CONFIG.embedding.provider,
      model: raw.embedding?.model,
      apiKey: raw.embedding?.apiKey,
      baseUrl: raw.embedding?.baseUrl,
      dimensions: raw.embedding?.dimensions,
      timeoutMs: raw.embedding?.timeoutMs
    },
    agent: (() => {
      assertNoLegacyRequestTimeoutMsInRawAgent(raw.agent)
      const registry = normalizeModelRegistry(raw.agent)
      return {
        defaultModel: normalizeModelConfig(raw.agent?.defaultModel ?? DEFAULT_CONFIG.agent.defaultModel),
        modelRegistry: registry,
        activeModel: raw.agent?.activeModel,
        modelsByAgent: resolveModelsByAgent(raw.agent, registry)
      }
    })(),
    search: {
      vectorWeight: raw.search?.vectorWeight ?? DEFAULT_CONFIG.search.vectorWeight,
      keywordWeight: raw.search?.keywordWeight ?? DEFAULT_CONFIG.search.keywordWeight,
      chunkSize: raw.search?.chunkSize ?? DEFAULT_CONFIG.search.chunkSize,
      chunkOverlap: raw.search?.chunkOverlap ?? DEFAULT_CONFIG.search.chunkOverlap,
      searchLimit: raw.search?.searchLimit ?? DEFAULT_CONFIG.search.searchLimit
    }
  }
}

/**
 * Resolve paths in configuration
 */
function resolvePaths(config: Config): Config {
  return {
    ...config,
    server: {
      port: config.server.port,
      host: config.server.host,
      https: config.server.https,
      requestBodyLimits: {
        defaultJson: config.server.requestBodyLimits.defaultJson,
        fileSaveJson: config.server.requestBodyLimits.fileSaveJson
      }
    },
    memory: {
      workspaceDir: resolvePath(config.memory.workspaceDir),
      dbPath: resolvePath(config.memory.dbPath)
    },
    runtime: {
      workspaceDir: resolvePath(config.runtime.workspaceDir),
      agentLoop: {
        maxSteps: config.runtime.agentLoop.maxSteps,
        modelRecovery: {
          maxCorrectionCalls: config.runtime.agentLoop.modelRecovery.maxCorrectionCalls
        },
        loopDetection: {
          enabled: config.runtime.agentLoop.loopDetection.enabled,
          sameFailureThreshold: config.runtime.agentLoop.loopDetection.sameFailureThreshold,
          sameOutcomeThreshold: config.runtime.agentLoop.loopDetection.sameOutcomeThreshold
        }
      },
      workspaceAgent: {
        plannerEnabled: config.runtime.workspaceAgent.plannerEnabled,
        defaultPrimaryAgent: config.runtime.workspaceAgent.defaultPrimaryAgent
      },
      filesystemTools: {
        compatibilityMode: config.runtime.filesystemTools.compatibilityMode
      },
      tools: {
        deny: [...config.runtime.tools.deny],
        displayNames: { ...config.runtime.tools.displayNames },
        runtimeRetry: {
          maxAttempts: config.runtime.tools.runtimeRetry.maxAttempts
        }
      },
      context: {
        auto: config.runtime.context.auto,
        prune: config.runtime.context.prune,
        logDetail: config.runtime.context.logDetail
      },
      providerLogging: config.runtime.providerLogging,
      managedSkills: {
        registryPath: resolvePath(config.runtime.managedSkills.registryPath),
        packagesDir: resolvePath(config.runtime.managedSkills.packagesDir)
      },
      fileLogging: {
        enabled: config.runtime.fileLogging.enabled,
        directory: resolvePath(config.runtime.fileLogging.directory),
        format: config.runtime.fileLogging.format,
        split: config.runtime.fileLogging.split,
        redactSensitive: config.runtime.fileLogging.redactSensitive
      }
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load configuration with the following priority:
 * 1. Environment variables (highest priority)
 * 2. config.json values
 * 3. Default values (lowest priority)
 */
export function loadConfig(): Config {
  // Step 1: Read config file
  const rawConfig = readConfigFile()

  // Step 2: Substitute environment variables in config values
  const substituted = substituteEnvVarsDeep(rawConfig)

  // Step 3: Merge with defaults
  const merged = mergeWithDefaults(substituted)

  // Step 4: Apply environment variable overrides
  const withOverrides = applyEnvOverrides(merged)

  // Step 5: Resolve paths
  const resolved = resolvePaths(withOverrides)

  return validateConfig(resolved)
}

/**
 * Convert Config to MemoryConfig
 */
export function toMemoryConfig(config: Config): MemoryConfig {
  return {
    workspaceDir: config.memory.workspaceDir,
    dbPath: config.memory.dbPath,
    embedding: config.embedding,
    chunkSize: config.search.chunkSize,
    chunkOverlap: config.search.chunkOverlap,
    searchLimit: config.search.searchLimit,
    vectorWeight: config.search.vectorWeight,
    keywordWeight: config.search.keywordWeight
  }
}

const BASE_10 = 10
const NON_NEGATIVE_MIN = 0
const POSITIVE_MIN = 1
const RESERVED_AGENT_MODEL_KEYS = new Set(['defaultModel', 'modelRegistry', 'activeModel', 'modelsByAgent'])

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= POSITIVE_MIN ? value : null
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number.parseInt(value, BASE_10)
  return Number.isInteger(parsed) && parsed >= POSITIVE_MIN ? parsed : null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CONFIG.runtime.tools.deny]
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseNonEmptyString(value: unknown, fieldName: string): string | null {
  if (value === undefined) {
    return null
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`)
  }
  return value.trim()
}

function validateConfig(config: Config): Config {
  return {
    ...config,
    server: validateServerConfig(config.server),
    embedding: validateEmbeddingConfig(config.embedding),
    runtime: {
      ...config.runtime,
      agentLoop: validateAgentLoopPolicyConfig(config.runtime.agentLoop),
      workspaceAgent: validateWorkspaceAgentConfig(config.runtime.workspaceAgent),
      context: validateContextConfig(config.runtime.context),
      tools: validateRuntimeToolsConfig(config.runtime.tools),
      providerLogging: parseLogSwitch(config.runtime.providerLogging, 'runtime.providerLogging'),
      managedSkills: validateRuntimeManagedSkillsConfig(config.runtime.managedSkills),
      fileLogging: validateRuntimeFileLoggingConfig(config.runtime.fileLogging)
    },
    agent: validateAgentConfig(config.agent)
  }
}

function validateServerConfig(server: Config['server']): Config['server'] {
  return {
    port: server.port,
    host: server.host,
    https: server.https,
    requestBodyLimits: validateRequestBodyLimitsConfig(server.requestBodyLimits)
  }
}

function validateAgentLoopPolicyConfig(
  agentLoop: Config['runtime']['agentLoop']
): Config['runtime']['agentLoop'] {
  return {
    maxSteps: agentLoop.maxSteps,
    modelRecovery: {
      maxCorrectionCalls: parseNonNegativeInteger(
        agentLoop.modelRecovery.maxCorrectionCalls,
        'runtime.agentLoop.modelRecovery.maxCorrectionCalls'
      )
    },
    loopDetection: {
      enabled: parseBooleanStrict(agentLoop.loopDetection.enabled, 'runtime.agentLoop.loopDetection.enabled'),
      sameFailureThreshold: parseNonNegativeInteger(
        agentLoop.loopDetection.sameFailureThreshold,
        'runtime.agentLoop.loopDetection.sameFailureThreshold'
      ),
      sameOutcomeThreshold: parseNonNegativeInteger(
        agentLoop.loopDetection.sameOutcomeThreshold,
        'runtime.agentLoop.loopDetection.sameOutcomeThreshold'
      )
    }
  }
}

function validateRuntimeToolsConfig(
  tools: Config['runtime']['tools']
): Config['runtime']['tools'] {
  return {
    deny: [...tools.deny],
    displayNames: parseStringRecord(tools.displayNames, 'runtime.tools.displayNames'),
    runtimeRetry: {
      maxAttempts: parseNonNegativeInteger(
        tools.runtimeRetry.maxAttempts,
        'runtime.tools.runtimeRetry.maxAttempts'
      )
    }
  }
}

function validateAgentConfig(agent: Config['agent']): Config['agent'] {
  const validatedModelRegistry: Record<string, AgentModelConfig> = {}
  for (const [name, model] of Object.entries(agent.modelRegistry)) {
    validatedModelRegistry[name] = validateRequiredModelConfig(model, `agent.modelRegistry.${name}`)
  }

  const validatedModelsByAgent: Record<string, AgentModelConfig> = {}
  for (const [agentId, model] of Object.entries(agent.modelsByAgent)) {
    validatedModelsByAgent[agentId] = validateRequiredModelConfig(model, `agent.modelsByAgent.${agentId}`)
  }

  return {
    defaultModel: validateModelConfig(agent.defaultModel, 'agent.defaultModel'),
    modelRegistry: validatedModelRegistry,
    activeModel: agent.activeModel,
    modelsByAgent: validatedModelsByAgent
  }
}

function validateWorkspaceAgentConfig(
  workspaceAgent: Config['runtime']['workspaceAgent']
): Config['runtime']['workspaceAgent'] {
  return {
    plannerEnabled: parseBooleanStrict(
      workspaceAgent.plannerEnabled,
      'runtime.workspaceAgent.plannerEnabled'
    ),
    defaultPrimaryAgent: parseWorkspacePrimaryAgent(
      workspaceAgent.defaultPrimaryAgent,
      'runtime.workspaceAgent.defaultPrimaryAgent'
    ) ?? BUILD_PRIMARY_AGENT
  }
}

function validateContextConfig(context: Config['runtime']['context']): Config['runtime']['context'] {
  return {
    auto: parseBooleanStrict(context.auto, 'runtime.context.auto'),
    prune: parseBooleanStrict(context.prune, 'runtime.context.prune'),
    logDetail: parseBooleanStrict(context.logDetail, 'runtime.context.logDetail')
  }
}

function validateRuntimeFileLoggingConfig(
  fileLogging: Config['runtime']['fileLogging']
): Config['runtime']['fileLogging'] {
  return {
    enabled: parseBooleanStrict(fileLogging.enabled, 'runtime.fileLogging.enabled'),
    directory: parseRuntimeFileLoggingDirectory(fileLogging.directory),
    format: parseRuntimeFileLogFormat(fileLogging.format, 'runtime.fileLogging.format'),
    split: parseRuntimeFileLogSplit(fileLogging.split, 'runtime.fileLogging.split'),
    redactSensitive: parseBooleanStrict(fileLogging.redactSensitive, 'runtime.fileLogging.redactSensitive')
  }
}

function validateRuntimeManagedSkillsConfig(
  managedSkills: Config['runtime']['managedSkills']
): Config['runtime']['managedSkills'] {
  return {
    registryPath: parseRuntimeManagedSkillsPath(
      managedSkills.registryPath,
      'runtime.managedSkills.registryPath',
      DEFAULT_CONFIG.runtime.managedSkills.registryPath
    ),
    packagesDir: parseRuntimeManagedSkillsPath(
      managedSkills.packagesDir,
      'runtime.managedSkills.packagesDir',
      DEFAULT_CONFIG.runtime.managedSkills.packagesDir
    )
  }
}

function validateRequestBodyLimitsConfig(
  limits: Config['server']['requestBodyLimits']
): Config['server']['requestBodyLimits'] {
  return {
    defaultJson: parseRequestBodyLimit(
      limits.defaultJson,
      'server.requestBodyLimits.defaultJson',
      DEFAULT_CONFIG.server.requestBodyLimits.defaultJson
    ),
    fileSaveJson: parseRequestBodyLimit(
      limits.fileSaveJson,
      'server.requestBodyLimits.fileSaveJson',
      DEFAULT_CONFIG.server.requestBodyLimits.fileSaveJson
    )
  }
}

function parseLogSwitch(value: unknown, fieldName: string): RuntimeLogSwitch {
  if (value === 'on' || value === 'off') {
    return value
  }
  throw new Error(`${fieldName} must be "on" or "off".`)
}

function parseEnvLogSwitch(value: unknown, fieldName: string): RuntimeLogSwitch {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be "on", "off", "true", or "false".`)
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'on' || normalized === 'true') {
    return 'on'
  }
  if (normalized === 'off' || normalized === 'false') {
    return 'off'
  }
  throw new Error(`${fieldName} must be "on", "off", "true", or "false".`)
}

function parseRuntimeFileLoggingDirectory(value: unknown): string {
  if (value === undefined) {
    return DEFAULT_CONFIG.runtime.fileLogging.directory
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }
  throw new Error('runtime.fileLogging.directory must be a non-empty string.')
}

function parseRuntimeManagedSkillsPath(value: unknown, fieldName: string, fallback: string): string {
  if (value === undefined) {
    return fallback
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }
  throw new Error(`${fieldName} must be a non-empty string.`)
}

function parseRequestBodyLimit(value: unknown, fieldName: string, fallback: string): string {
  if (value === undefined) {
    return fallback
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }
  throw new Error(`${fieldName} must be a non-empty string.`)
}

function parseRuntimeFileLogFormat(
  value: unknown,
  fieldName: string
): RuntimeFileLogFormat {
  if (value === undefined) {
    return DEFAULT_CONFIG.runtime.fileLogging.format
  }
  if (value === 'jsonl') {
    return value
  }
  throw new Error(`${fieldName} must be "jsonl".`)
}

function parseRuntimeFileLogSplit(
  value: unknown,
  fieldName: string
): RuntimeFileLogSplit {
  if (value === undefined) {
    return DEFAULT_CONFIG.runtime.fileLogging.split
  }
  if (value === 'daily') {
    return value
  }
  throw new Error(`${fieldName} must be "daily".`)
}

function assertNoLegacyContextKeys(
  context: { auto?: unknown; prune?: unknown; logDetail?: unknown } | undefined
): void {
  if (!context || typeof context !== 'object') return
  const candidate = context as Record<string, unknown>
  if ('compactionTriggerRatio' in candidate) {
    throw new Error('Legacy runtime.context.compactionTriggerRatio is no longer supported.')
  }
  if ('keepRecentMessages' in candidate) {
    throw new Error('Legacy runtime.context.keepRecentMessages is no longer supported.')
  }
}

function parseWorkspacePrimaryAgent(
  value: unknown,
  fieldName: string
): 'plan' | 'build' | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (value === PLAN_PRIMARY_AGENT || value === BUILD_PRIMARY_AGENT) {
    return value
  }
  throw new Error(`${fieldName} must be "plan" or "build".`)
}

function parseNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < NON_NEGATIVE_MIN) {
      throw new Error(`Invalid ${label}: must be a non-negative number.`)
    }
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed) || parsed < NON_NEGATIVE_MIN) {
      throw new Error(`Invalid ${label}: must be a non-negative number.`)
    }
    return parsed
  }
  throw new Error(`Invalid ${label}: must be a non-negative number.`)
}

function parseNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < NON_NEGATIVE_MIN) {
      throw new Error(`Invalid ${label}: must be a non-negative integer.`)
    }
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, BASE_10)
    if (!Number.isInteger(parsed) || parsed < NON_NEGATIVE_MIN) {
      throw new Error(`Invalid ${label}: must be a non-negative integer.`)
    }
    return parsed
  }
  throw new Error(`Invalid ${label}: must be a non-negative integer.`)
}

function parsePositiveNumberInUnitInterval(value: unknown, label: string): number {
  const parsed = parseNonNegativeNumber(value, label)
  if (parsed <= 0 || parsed > 1) {
    throw new Error(`Invalid ${label}: must be greater than 0 and less than or equal to 1.`)
  }
  return parsed
}

function hasSamplingOverrides(candidate: Partial<AgentModelConfig>): boolean {
  return candidate.temperature !== undefined || candidate.topP !== undefined || candidate.topK !== undefined
}

function assertModelsByAgentSamplingNotConfigured(candidate: Partial<AgentModelConfig>, agentId: string): void {
  if (hasSamplingOverrides(candidate)) {
    throw new Error(
      `modelsByAgent.${agentId} cannot declare temperature/topP/topK directly; reference modelRegistry instead.`
    )
  }
}

function normalizeModelMap(modelsByAgent: Record<string, AgentModelConfig>): Record<string, AgentModelConfig> {
  return Object.fromEntries(
    Object.entries(modelsByAgent).map(([agentId, model]) => [agentId, normalizeModelConfig(model) as AgentModelConfig])
  )
}

/**
 * 从 raw.agent.modelRegistry 中读取模型配置
 * 同时也支持在 agent 根级别定义模型配置（排除 defaultModel, activeModel, modelsByAgent）
 */
function normalizeModelRegistry(rawAgent: RawConfig['agent']): Record<string, AgentModelConfig> {
  if (!rawAgent) return {}
  const registry: Record<string, AgentModelConfig> = {}

  // 1. 从 modelRegistry 字段读取
  if (rawAgent.modelRegistry && typeof rawAgent.modelRegistry === 'object') {
    for (const [key, value] of Object.entries(rawAgent.modelRegistry)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const candidate = value as Partial<AgentModelConfig>
        if (typeof candidate.provider === 'string' && typeof candidate.modelName === 'string') {
          registry[key] = normalizeModelConfig(candidate as AgentModelConfig) as AgentModelConfig
        }
      }
    }
  }

  // 2. 从 agent 根级别读取（兼容旧配置）
  for (const [key, value] of Object.entries(rawAgent)) {
    if (RESERVED_AGENT_MODEL_KEYS.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const candidate = value as Partial<AgentModelConfig>
      if (typeof candidate.provider === 'string' && typeof candidate.modelName === 'string') {
        registry[key] = normalizeModelConfig(candidate as AgentModelConfig) as AgentModelConfig
      }
    }
  }

  return registry
}

/**
 * 解析 modelsByAgent，支持通过字符串引用 modelRegistry 中的模型
 */
function resolveModelsByAgent(
  rawAgent: RawConfig['agent'],
  modelRegistry: Record<string, AgentModelConfig>
): Record<string, AgentModelConfig> {
  const result: Record<string, AgentModelConfig> = {}

  if (rawAgent?.modelsByAgent) {
    for (const [agentId, value] of Object.entries(rawAgent.modelsByAgent)) {
      if (typeof value === 'string') {
        const modelConfig = modelRegistry[value]
        if (modelConfig) {
          result[agentId] = modelConfig
        } else {
          configLoaderLogger.warn({
            message: 'modelsByAgent references unknown model',
            data: {
              agentId,
              modelRef: value
            }
          })
        }
      } else if (value && typeof value === 'object') {
        const candidate = value as Partial<AgentModelConfig>
        assertModelsByAgentSamplingNotConfigured(candidate, agentId)
        if (typeof candidate.provider === 'string' && typeof candidate.modelName === 'string') {
          result[agentId] = normalizeModelConfig(value as AgentModelConfig) as AgentModelConfig
        }
      }
    }
  }

  if (!result.activeModel && typeof rawAgent?.activeModel === 'string') {
    const activeModelConfig = modelRegistry[rawAgent.activeModel]
    if (activeModelConfig) {
      result.activeModel = activeModelConfig
    } else {
      configLoaderLogger.warn({
        message: 'agent.activeModel references unknown model',
        data: {
          modelRef: rawAgent.activeModel
        }
      })
    }
  }

  return result
}

function normalizeModelConfig(model: AgentModelConfig | null): AgentModelConfig | null {
  if (!model) return null
  return {
    ...model,
    contextWindow: typeof model.contextWindow === 'number'
      ? model.contextWindow
      : resolveModelContextWindow(model)
  }
}

function validateModelConfig(model: AgentModelConfig | null, label: string): AgentModelConfig | null {
  if (!model) return null
  assertNoLegacyRequestTimeoutMs(model, label)
  const validated: AgentModelConfig = { ...model }
  validated.stream = validated.stream === undefined
    ? true
    : parseBooleanStrict(validated.stream, `${label}.stream`)
  if (validated.maxTokens !== undefined) {
    validated.maxTokens = parseNonNegativeInteger(validated.maxTokens, `${label}.maxTokens`)
  }
  if (validated.temperature !== undefined) {
    validated.temperature = parseNonNegativeNumber(validated.temperature, `${label}.temperature`)
  }
  if (validated.topP !== undefined) {
    validated.topP = parsePositiveNumberInUnitInterval(validated.topP, `${label}.topP`)
  }
  if (validated.topK !== undefined) {
    validated.topK = parsePositiveIntegerStrict(validated.topK, `${label}.topK`)
  }
  if (validated.contextWindow !== undefined) {
    validated.contextWindow = parsePositiveIntegerStrict(validated.contextWindow, `${label}.contextWindow`)
  }
  if (validated.inputLimit !== undefined) {
    validated.inputLimit = parseNonNegativeInteger(validated.inputLimit, `${label}.inputLimit`)
  }
  if (validated.streamFirstByteTimeoutMs !== undefined) {
    validated.streamFirstByteTimeoutMs = parsePositiveIntegerStrict(
      validated.streamFirstByteTimeoutMs,
      `${label}.streamFirstByteTimeoutMs`
    )
  }
  if (validated.streamIdleTimeoutMs !== undefined) {
    validated.streamIdleTimeoutMs = parsePositiveIntegerStrict(
      validated.streamIdleTimeoutMs,
      `${label}.streamIdleTimeoutMs`
    )
  }
  return validated
}

function validateRequiredModelConfig(model: AgentModelConfig, label: string): AgentModelConfig {
  return validateModelConfig(model, label) as AgentModelConfig
}

function assertNoLegacyRequestTimeoutMsInRawAgent(rawAgent: RawConfig['agent']): void {
  if (!rawAgent) return
  assertNoLegacyRequestTimeoutMs(rawAgent.defaultModel, 'agent.defaultModel')
  for (const [key, model] of Object.entries(rawAgent.modelRegistry ?? {})) {
    assertNoLegacyRequestTimeoutMs(model, `agent.modelRegistry.${key}`)
  }
  for (const [key, model] of Object.entries(rawAgent.modelsByAgent ?? {})) {
    if (typeof model === 'string') continue
    assertNoLegacyRequestTimeoutMs(model, `agent.modelsByAgent.${key}`)
  }
  for (const [key, model] of Object.entries(rawAgent)) {
    if (RESERVED_AGENT_MODEL_KEYS.has(key)) continue
    assertNoLegacyRequestTimeoutMs(model, `agent.modelRegistry.${key}`)
  }
}

function assertNoLegacyRequestTimeoutMs(model: unknown, label: string): void {
  if (!model || typeof model !== 'object' || Array.isArray(model)) return
  const legacyTimeoutMs = (model as Record<string, unknown>).requestTimeoutMs
  if (legacyTimeoutMs !== undefined) {
    throw new Error(buildLegacyRequestTimeoutError(label))
  }
}

function buildLegacyRequestTimeoutError(label: string): string {
  return `Legacy ${label}.requestTimeoutMs is no longer supported; use ${label}.streamFirstByteTimeoutMs and ${label}.streamIdleTimeoutMs instead.`
}

function validateEmbeddingConfig(config: EmbeddingProviderConfig): EmbeddingProviderConfig {
  const validated: EmbeddingProviderConfig = { ...config }
  if (validated.dimensions !== undefined) {
    validated.dimensions = parsePositiveIntegerStrict(validated.dimensions, 'embedding.dimensions')
  }
  if (validated.timeoutMs !== undefined) {
    validated.timeoutMs = parsePositiveIntegerStrict(validated.timeoutMs, 'embedding.timeoutMs')
  }
  return validated
}

function parsePositiveIntegerStrict(value: unknown, label: string): number {
  const parsed = parsePositiveInteger(value)
  if (parsed === null) {
    throw new Error(`Invalid ${label}: must be a positive integer.`)
  }
  return parsed
}

function parseBooleanStrict(value: unknown, label: string): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  throw new Error(`Invalid ${label}: must be a boolean.`)
}
