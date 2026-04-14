import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MCPConfig, MCPServerConfig } from './types.js'
import { createLogger } from '../logging/index.js'

interface MCPFileConfig {
  timeoutMs?: number
  defaultServer?: string
  servers?: unknown
}

interface RootConfigFile {
  mcp?: MCPFileConfig
}

const DEFAULT_MCP_CONFIG: MCPConfig = {
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
  ]
}

const mcpConfigLogger = createLogger({
  category: 'runtime',
  component: 'mcp_config'
})

export type MCPConfigSource = 'mcp.config.json' | 'config.json' | 'default'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function getBackendRootDir(): string {
  const override = process.env.APPLE_DEMO_AGENT_BACKEND_ROOT?.trim()
  if (override) {
    return resolve(override)
  }
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return resolve(currentDir, '..', '..')
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    mcpConfigLogger.warn({
      message: 'failed to parse mcp config file',
      data: {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      }
    })
    return null
  }
}

function parseServerList(raw: unknown): MCPServerConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_MCP_CONFIG.servers
  }

  return raw.map((item, index) => {
    const candidate = item as Partial<MCPServerConfig>
    const base: MCPServerConfig = {
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `mcp-${index}`,
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
      mcpConfigLogger.warn({
        message: 'mcp server missing http endpoint and was disabled',
        data: { serverId: base.id }
      })
      return { ...base, enabled: false }
    }

    if (base.transport === 'stdio' && !base.command) {
      mcpConfigLogger.warn({
        message: 'mcp server missing stdio command and was disabled',
        data: { serverId: base.id }
      })
      return { ...base, enabled: false }
    }

    return base
  })
}

function resolveMCPFileConfig():
  | { source: Exclude<MCPConfigSource, 'default'>; config: MCPFileConfig }
  | null {
  const backendRoot = getBackendRootDir()
  const dedicatedPath = resolve(backendRoot, 'mcp.config.json')
  const dedicated = readJsonFile<MCPFileConfig>(dedicatedPath)
  if (dedicated) {
    return { source: 'mcp.config.json', config: dedicated }
  }

  const rootPath = resolve(backendRoot, 'config.json')
  const root = readJsonFile<RootConfigFile>(rootPath)
  if (root?.mcp) {
    return { source: 'config.json', config: root.mcp }
  }

  return null
}

export function loadMCPConfigWithSource(): { source: MCPConfigSource; config: MCPConfig } {
  const resolved = resolveMCPFileConfig()
  if (!resolved) {
    return {
      source: 'default',
      config: { ...DEFAULT_MCP_CONFIG }
    }
  }

  const servers = parseServerList(resolved.config.servers)
  const defaultServer = resolved.config.defaultServer || servers[0].id
  return {
    source: resolved.source,
    config: {
      timeoutMs: parsePositiveInt(
        typeof resolved.config.timeoutMs === 'number' ? String(resolved.config.timeoutMs) : undefined,
        DEFAULT_MCP_CONFIG.timeoutMs
      ),
      defaultServer,
      servers
    }
  }
}

export function loadMCPConfig(): MCPConfig {
  return loadMCPConfigWithSource().config
}
