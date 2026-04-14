import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  GatewayConfig,
  GatewayToolPolicyConfig,
  GatewayToolProviderPolicy,
  GatewayToolServerConfig
} from './types.js'
import { createLogger } from '../../logging/index.js'

interface GatewayFileConfig {
  timeoutMs?: number
  defaultServer?: string
  servers?: unknown
  tools?: unknown
  agents?: unknown
  gateway?: unknown
}

interface RootConfigFile {
  gateway?: GatewayFileConfig
}

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  timeoutMs: 15000,
  defaultServer: 'default',
  servers: [
    {
      id: 'default',
      enabled: true,
      transport: 'http',
      endpoint: 'http://localhost:3200/mcp',
      tools: []
    }
  ],
  tools: {
    allow: [],
    deny: []
  },
  agents: {},
  gateway: {
    tools: {
      deny: []
    }
  }
}

const gatewayConfigLogger = createLogger({
  category: 'runtime',
  component: 'gateway_tools_config'
})

export type GatewayConfigSource = 'gateway.config.json' | 'config.json' | 'default'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function parseProviderPolicy(value: unknown): Record<string, GatewayToolProviderPolicy> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return undefined

  const parsed: Record<string, GatewayToolProviderPolicy> = {}
  for (const [provider, raw] of entries) {
    if (!raw || typeof raw !== 'object') continue
    const candidate = raw as Record<string, unknown>
    parsed[provider] = {
      profile: typeof candidate.profile === 'string' ? candidate.profile : undefined,
      allow: toStringArray(candidate.allow),
      deny: toStringArray(candidate.deny)
    }
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined
}

function parseProfiles(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return undefined
  const parsed: Record<string, string[]> = {}
  for (const [name, raw] of entries) {
    const list = toStringArray(raw)
    if (list.length > 0) parsed[name] = list
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined
}

function parseToolsPolicy(raw: unknown): GatewayToolPolicyConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const candidate = raw as Record<string, unknown>
  const topK = typeof candidate.topK === 'number' && candidate.topK > 0
    ? Math.floor(candidate.topK)
    : undefined
  return {
    profile: typeof candidate.profile === 'string' ? candidate.profile : undefined,
    profiles: parseProfiles(candidate.profiles),
    byProvider: parseProviderPolicy(candidate.byProvider),
    allow: toStringArray(candidate.allow),
    deny: toStringArray(candidate.deny),
    topK
  }
}

function parseAgents(raw: unknown): GatewayConfig['agents'] {
  if (!raw || typeof raw !== 'object') return {}
  const parsed: NonNullable<GatewayConfig['agents']> = {}
  for (const [agentId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const candidate = value as Record<string, unknown>
    const tools = candidate.tools && typeof candidate.tools === 'object'
      ? (candidate.tools as Record<string, unknown>)
      : undefined
    parsed[agentId] = {
      tools: {
        allow: toStringArray(tools?.allow)
      }
    }
  }
  return parsed
}

function parseGatewayDeny(raw: unknown): GatewayConfig['gateway'] {
  if (!raw || typeof raw !== 'object') return { tools: { deny: [] } }
  const candidate = raw as Record<string, unknown>
  const tools = candidate.tools && typeof candidate.tools === 'object'
    ? (candidate.tools as Record<string, unknown>)
    : undefined
  return {
    tools: {
      deny: toStringArray(tools?.deny)
    }
  }
}

function getBackendRootDir(): string {
  const override = process.env.APPLE_DEMO_AGENT_BACKEND_ROOT?.trim()
  if (override) {
    return resolve(override)
  }
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return resolve(currentDir, '..', '..', '..')
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    gatewayConfigLogger.warn({
      message: 'failed to parse gateway config file',
      data: {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      }
    })
    return null
  }
}

function parseServerList(raw: unknown): GatewayToolServerConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_GATEWAY_CONFIG.servers
  }

  return raw.map((item, index) => {
    const candidate = item as Partial<GatewayToolServerConfig>
    const base: GatewayToolServerConfig = {
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `gateway-${index}`,
      enabled: candidate.enabled !== false,
      transport: candidate.transport === 'stdio' ? 'stdio' : 'http',
      tools: Array.isArray(candidate.tools) ? candidate.tools : [],
      endpoint: typeof candidate.endpoint === 'string' ? candidate.endpoint : undefined,
      headers: candidate.headers && typeof candidate.headers === 'object' ? candidate.headers : undefined,
      command: typeof candidate.command === 'string' ? candidate.command : undefined,
      args: Array.isArray(candidate.args) ? candidate.args : undefined,
      env: candidate.env && typeof candidate.env === 'object' ? candidate.env : undefined,
      cwd: typeof candidate.cwd === 'string' ? candidate.cwd : undefined
    }

    if (base.transport === 'http' && !base.endpoint) {
      gatewayConfigLogger.warn({
        message: 'gateway server missing http endpoint and was disabled',
        data: { serverId: base.id }
      })
      return { ...base, enabled: false }
    }

    if (base.transport === 'stdio' && !base.command) {
      gatewayConfigLogger.warn({
        message: 'gateway server missing stdio command and was disabled',
        data: { serverId: base.id }
      })
      return { ...base, enabled: false }
    }

    return base
  })
}

function resolveGatewayFileConfig():
  | { source: Exclude<GatewayConfigSource, 'default'>; config: GatewayFileConfig }
  | null {
  const backendRoot = getBackendRootDir()
  const dedicatedPath = resolve(backendRoot, 'gateway.config.json')
  const dedicated = readJsonFile<GatewayFileConfig>(dedicatedPath)
  if (dedicated) {
    return { source: 'gateway.config.json', config: dedicated }
  }

  const rootPath = resolve(backendRoot, 'config.json')
  const root = readJsonFile<RootConfigFile>(rootPath)
  if (root?.gateway) {
    return { source: 'config.json', config: root.gateway }
  }

  return null
}

export function loadGatewayConfigWithSource(): { source: GatewayConfigSource; config: GatewayConfig } {
  const resolved = resolveGatewayFileConfig()
  if (!resolved) {
    return {
      source: 'default',
      config: { ...DEFAULT_GATEWAY_CONFIG }
    }
  }

  const servers = parseServerList(resolved.config.servers)
  const defaultServer = resolved.config.defaultServer || servers[0].id
  const toolsPolicy = parseToolsPolicy(resolved.config.tools)
  return {
    source: resolved.source,
    config: {
      timeoutMs: parsePositiveInt(
        typeof resolved.config.timeoutMs === 'number' ? String(resolved.config.timeoutMs) : undefined,
        DEFAULT_GATEWAY_CONFIG.timeoutMs
      ),
      defaultServer,
      servers,
      tools: {
        ...DEFAULT_GATEWAY_CONFIG.tools,
        ...(toolsPolicy || {})
      },
      agents: parseAgents(resolved.config.agents),
      gateway: parseGatewayDeny(resolved.config.gateway)
    }
  }
}

export function loadGatewayConfig(): GatewayConfig {
  return loadGatewayConfigWithSource().config
}
