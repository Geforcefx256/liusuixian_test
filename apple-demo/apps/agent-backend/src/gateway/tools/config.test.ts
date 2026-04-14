import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { attachRuntimeLogSink, resetRuntimeLoggingForTests } from '../../logging/index.js'
import type { RuntimeLogEntry } from '../../logging/types.js'
import { loadGatewayConfig, loadGatewayConfigWithSource } from './config.js'

let backendRoot = ''
let gatewayConfigPath = ''
let configPath = ''

function writeGatewayConfig(content: Record<string, unknown>): void {
  writeFileSync(gatewayConfigPath, JSON.stringify(content, null, 2), 'utf-8')
}

function writeRootConfig(content: Record<string, unknown>): void {
  writeFileSync(configPath, JSON.stringify(content, null, 2), 'utf-8')
}

describe('loadGatewayConfig', () => {
  beforeAll(async () => {
    backendRoot = await mkdtemp(join(tmpdir(), 'agent-backend-gateway-config-'))
    gatewayConfigPath = resolve(backendRoot, 'gateway.config.json')
    configPath = resolve(backendRoot, 'config.json')
    process.env.APPLE_DEMO_AGENT_BACKEND_ROOT = backendRoot
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetRuntimeLoggingForTests()

    if (existsSync(gatewayConfigPath)) {
      unlinkSync(gatewayConfigPath)
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

  it('uses gateway.config.json when present', () => {
    writeGatewayConfig({
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

    const result = loadGatewayConfigWithSource()

    expect(result.source).toBe('gateway.config.json')
    expect(result.config.defaultServer).toBe('local')
    expect(result.config.timeoutMs).toBe(1234)
    expect(result.config.servers[0].transport).toBe('stdio')
    expect(result.config).not.toHaveProperty('defaultTool')
  })

  it('falls back to config.json gateway block when dedicated file is missing', () => {
    if (existsSync(gatewayConfigPath)) {
      unlinkSync(gatewayConfigPath)
    }

    writeRootConfig({
      gateway: {
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

    const result = loadGatewayConfigWithSource()

    expect(result.source).toBe('config.json')
    expect(result.config.defaultServer).toBe('remote')
    expect(result.config.servers[0]).toMatchObject({
      id: 'remote',
      transport: 'http'
    })
  })

  it('disables invalid http server config without endpoint', () => {
    writeGatewayConfig({
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
    const config = loadGatewayConfig()
    detach()

    expect(config.servers).toHaveLength(1)
    expect(config.servers[0].enabled).toBe(false)
    expect(entries.some(entry => entry.level === 'warn' && entry.component === 'gateway_tools_config')).toBe(true)
  })

  it('does not synthesize tools when server tools are omitted', () => {
    writeGatewayConfig({
      defaultServer: 'local',
      servers: [
        {
          id: 'local',
          enabled: true,
          transport: 'stdio',
          command: 'node'
        }
      ]
    })

    const config = loadGatewayConfig()

    expect(config.servers[0]).toMatchObject({
      id: 'local',
      enabled: true,
      tools: []
    })
  })

  it('preserves explicit empty tool arrays in gateway.config.json', () => {
    writeGatewayConfig({
      defaultServer: 'local',
      servers: [
        {
          id: 'local',
          enabled: true,
          transport: 'stdio',
          command: 'node',
          tools: []
        }
      ]
    })

    const config = loadGatewayConfig()

    expect(config.servers[0]).toMatchObject({
      id: 'local',
      enabled: true,
      tools: []
    })
    expect(config).not.toHaveProperty('defaultTool')
  })
})
