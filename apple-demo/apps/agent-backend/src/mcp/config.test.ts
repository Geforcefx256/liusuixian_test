import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { attachRuntimeLogSink, resetRuntimeLoggingForTests } from '../logging/index.js'
import type { RuntimeLogEntry } from '../logging/types.js'
import { loadMCPConfig, loadMCPConfigWithSource } from './config.js'

let backendRoot = ''
let mcpConfigPath = ''
let configPath = ''

function writeMCPConfig(content: Record<string, unknown>): void {
  writeFileSync(mcpConfigPath, JSON.stringify(content, null, 2), 'utf-8')
}

function writeRootConfig(content: Record<string, unknown>): void {
  writeFileSync(configPath, JSON.stringify(content, null, 2), 'utf-8')
}

describe('loadMCPConfig', () => {
  beforeAll(async () => {
    backendRoot = await mkdtemp(join(tmpdir(), 'agent-backend-mcp-config-'))
    mcpConfigPath = resolve(backendRoot, 'mcp.config.json')
    configPath = resolve(backendRoot, 'config.json')
    process.env.APPLE_DEMO_AGENT_BACKEND_ROOT = backendRoot
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetRuntimeLoggingForTests()

    if (existsSync(mcpConfigPath)) {
      unlinkSync(mcpConfigPath)
    }

    if (existsSync(configPath)) {
      unlinkSync(configPath)
    }
    process.env.APPLE_DEMO_AGENT_BACKEND_ROOT = backendRoot
  })

  afterAll(async () => {
    delete process.env.APPLE_DEMO_AGENT_BACKEND_ROOT
    if (backendRoot) {
      await rm(backendRoot, { recursive: true, force: true })
    }
  })

  it('uses mcp.config.json when present', () => {
    writeMCPConfig({
      timeoutMs: 1234,
      defaultServer: 'local',
      defaultTool: 'legacy_deleted_tool',
      servers: [
        {
          id: 'local',
          enabled: true,
          transport: 'stdio',
          command: 'node',
          tools: ['normalize_rows']
        }
      ]
    })

    const result = loadMCPConfigWithSource()

    expect(result.source).toBe('mcp.config.json')
    expect(result.config.defaultServer).toBe('local')
    expect(result.config.timeoutMs).toBe(1234)
    expect(result.config.servers[0].transport).toBe('stdio')
    expect(result.config).not.toHaveProperty('defaultTool')
  })

  it('falls back to config.json mcp block when dedicated file is missing', () => {
    if (existsSync(mcpConfigPath)) {
      unlinkSync(mcpConfigPath)
    }

    writeRootConfig({
      server: { port: 3100 },
      memory: { workspaceDir: './workspace', dbPath: './data/memory.db' },
      embedding: { provider: 'none' },
      search: {
        vectorWeight: 0.7,
        keywordWeight: 0.3,
        chunkSize: 400,
        chunkOverlap: 80,
        searchLimit: 6
      },
      mcp: {
        defaultServer: 'remote',
        servers: [
          {
            id: 'remote',
            enabled: true,
            transport: 'http',
            endpoint: 'http://localhost:4000/mcp',
            tools: ['normalize_rows']
          }
        ]
      }
    })

    const result = loadMCPConfigWithSource()

    expect(result.source).toBe('config.json')
    expect(result.config.defaultServer).toBe('remote')
    expect(result.config.servers[0]).toMatchObject({
      id: 'remote',
      transport: 'http'
    })
  })

  it('disables invalid http server config without endpoint', () => {
    writeMCPConfig({
      servers: [
        {
          id: 'bad-http',
          enabled: true,
          transport: 'http',
          tools: ['normalize_rows']
        }
      ]
    })

    const entries: RuntimeLogEntry[] = []
    const detach = attachRuntimeLogSink({
      append(entry) {
        entries.push(entry)
      }
    })
    const config = loadMCPConfig()
    detach()

    expect(config.servers).toHaveLength(1)
    expect(config.servers[0].enabled).toBe(false)
    expect(entries.some(entry => entry.level === 'warn' && entry.component === 'mcp_config')).toBe(true)
  })

  it('ignores MCP_* environment variables', () => {
    vi.stubEnv('MCP_DEFAULT_SERVER', 'env-server')
    vi.stubEnv('MCP_TIMEOUT_MS', '1')
    vi.stubEnv('MCP_SERVERS', JSON.stringify([{ id: 'env', enabled: true, tools: ['x'] }]))

    writeMCPConfig({
      defaultServer: 'file-default',
      defaultTool: 'legacy_deleted_tool',
      timeoutMs: 8888,
      servers: [
        {
          id: 'file-default',
          enabled: true,
          transport: 'http',
          endpoint: 'http://localhost:3200/mcp',
          tools: ['normalize_rows']
        }
      ]
    })

    const result = loadMCPConfigWithSource()

    expect(result.source).toBe('mcp.config.json')
    expect(result.config.defaultServer).toBe('file-default')
    expect(result.config.timeoutMs).toBe(8888)
    expect(result.config).not.toHaveProperty('defaultTool')
  })

  it('does not synthesize tools when server tools are omitted', () => {
    writeMCPConfig({
      defaultServer: 'default',
      servers: [
        {
          id: 'default',
          enabled: true,
          transport: 'http',
          endpoint: 'http://localhost:3200/mcp'
        }
      ]
    })

    const config = loadMCPConfig()

    expect(config.servers[0]).toMatchObject({
      id: 'default',
      enabled: true,
      tools: []
    })
  })

  it('preserves explicit empty tool arrays in mcp.config.json', () => {
    writeMCPConfig({
      defaultServer: 'default',
      defaultTool: 'legacy_deleted_tool',
      servers: [
        {
          id: 'default',
          enabled: true,
          transport: 'http',
          endpoint: 'http://localhost:3200/mcp',
          tools: []
        }
      ]
    })

    const config = loadMCPConfig()

    expect(config.servers[0]).toMatchObject({
      id: 'default',
      enabled: true,
      tools: []
    })
    expect(config).not.toHaveProperty('defaultTool')
  })
})
