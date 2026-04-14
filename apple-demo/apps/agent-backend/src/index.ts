/**
 * Memory Service Entry Point
 *
 * Standalone memory service for MML Excel Planner.
 */

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { createServer as createHttpsServer } from 'https'
import { readFileSync } from 'node:fs'
import { MemoryManager } from './memory/index.js'
import { loadConfig, toMemoryConfig } from './memory/index.js'
import { createMemoryRouter } from './routes/memory.js'
import { createGatewayRouter } from './routes/gateway.js'
import { createAgentRouter } from './routes/agent.js'
import { loadGatewayConfigWithSource } from './gateway/tools/config.js'
import { AgentModelRegistry } from './agent/modelRegistry.js'
import { AgentCatalogService } from './agents/service.js'
import { createAgentsRouter } from './routes/agents.js'
import { createRuntimeRouter } from './routes/runtime.js'
import { RuntimeBootstrapService } from './runtime/bootstrap.js'
import { SkillCatalog } from './skills/catalog.js'
import { AdminSkillCatalogService } from './skills/adminCatalogService.js'
import { ManagedSkillRegistry } from './skills/managedRegistry.js'
import { createDefaultToolProviderRegistry } from './runtime/tools/index.js'
import { AgentService } from './agent/service.js'
import { getDefaultSessionStore } from './agent/service/defaults.js'
import { createFilesRouter } from './routes/files.js'
import { fileStore } from './files/fileStore.js'
import { resolveAgentAssetsRoot, resolveBackendRoot } from './support/runtimePaths.js'
import { resolve } from 'node:path'
import {
  attachRuntimeLogSink,
  closeRuntimeLogSinks,
  createLogger,
  DailyCategoryJsonlFileSink
} from './logging/index.js'
import { requireSameOrigin } from './http/sameOrigin.js'
import { createDefaultJsonParser, createFileSaveJsonParser } from './http/requestBodyParsers.js'
import { createAdminSkillsRouter } from './routes/adminSkills.js'
import {
  buildAgentBackendStartupSummary,
  logAgentBackendFatalDiagnostic,
  logAgentBackendProcessWarning,
  logAgentBackendReady,
  logAgentBackendStarting,
  logAgentBackendStartupSummary
} from './startupDiagnostics.js'
import { agentBackendCorsOptions } from './http/cors.js'
import {
  assertNoLegacyWorkspaceNaming,
  resolveLegacyWorkspacePaths
} from './support/legacyWorkspaceNaming.js'

// Load configuration
const config = loadConfig()
const backendRoot = resolveBackendRoot(import.meta.url, 2)
const agentAssetsRoot = resolveAgentAssetsRoot(import.meta.url, 2)
const managedSkillsPath = config.runtime.managedSkills.registryPath
const managedSkillPackagesDir = config.runtime.managedSkills.packagesDir
const agentModelRegistry = new AgentModelRegistry(config.agent)
const skillCatalog = new SkillCatalog(agentAssetsRoot, managedSkillPackagesDir)
const sessionStore = getDefaultSessionStore()
const managedSkillRegistry = new ManagedSkillRegistry(
  skillCatalog,
  managedSkillsPath
)
const adminSkillCatalogService = new AdminSkillCatalogService(skillCatalog, managedSkillRegistry, managedSkillPackagesDir)
const agentCatalogService = new AgentCatalogService(agentModelRegistry, skillCatalog, managedSkillRegistry)
const toolRegistry = createDefaultToolProviderRegistry({
  runtimeRoot: config.runtime.workspaceDir,
  sessionStore,
  skillCatalog,
  managedSkillRegistry,
  toolDenyList: config.runtime.tools.deny,
  filesystemTools: config.runtime.filesystemTools
})
const runtimeBootstrapService = new RuntimeBootstrapService(
  agentCatalogService,
  ({ provider, agentId }) => ({
    configSource: 'runtime',
    tools: toolRegistry.catalog({ provider, agentId }).tools
  }),
  ({ userId, agentId, sessionId }) => {
    if (!userId || !sessionId) {
      return {
        occupied: false,
        state: 'idle',
        ownerSessionId: null,
        runId: null
      }
    }
    return agentService.getWorkspaceOccupancy(userId, agentId, sessionId)
  }
)
const agentService = new AgentService(agentCatalogService, {
  sessionStore,
  toolRegistry
})
const entrypointLogger = createLogger({
  category: 'runtime',
  component: 'entrypoint'
})
// Create Express app
const app = express()
app.set('trust proxy', true)

// Middleware
app.use(cors(agentBackendCorsOptions))
app.use(requireSameOrigin)
app.put('/agent/api/files/:fileKey', createFileSaveJsonParser(config.server.requestBodyLimits))
app.use(createDefaultJsonParser(config.server.requestBodyLimits))

// Memory manager instance
let memoryManager: MemoryManager
let closeRuntimeLogSinksPromise: Promise<void> | null = null
let shutdownInitiated = false

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = resolveHttpStatus(err)
  entrypointLogger.error({
    message: 'http request failed',
    data: {
      error: formatErrorMessage(err),
      status
    }
  })
  res.status(status).json({ error: err.message })
})

// Start server
async function start() {
  try {
    logAgentBackendStarting(entrypointLogger)
    attachRuntimeFileLogging()
    await assertNoLegacyWorkspaceNaming(resolveLegacyWorkspacePaths(import.meta.url, 2))
    const gatewayConfig = loadGatewayConfigWithSource()
    const startupSummary = buildAgentBackendStartupSummary(config, {
      gatewayToolsConfigSource: gatewayConfig.source,
      managedSkillsPath,
      managedSkillPackagesDir,
      moduleUrl: import.meta.url
    })
    logAgentBackendStartupSummary(entrypointLogger, startupSummary)

    // Initialize memory system
    memoryManager = await MemoryManager.create(toMemoryConfig(config))

    await memoryManager.initialize()
    entrypointLogger.info({ message: 'memory system initialized' })
    await fileStore.initialize()
    entrypointLogger.info({ message: 'file store initialized' })
    await managedSkillRegistry.initialize()
    entrypointLogger.info({ message: 'managed skill registry initialized' })

    // Add routes after initialization
    app.use('/agent/api/memory', createMemoryRouter(memoryManager))
    app.use('/agent/api/gateway', createGatewayRouter(toolRegistry))
    app.use('/agent/api/agents', createAgentsRouter(agentCatalogService))
    app.use('/agent/api/runtime', createRuntimeRouter(runtimeBootstrapService))
    app.use('/agent/api/agent', createAgentRouter(agentService, agentModelRegistry))
    app.use('/agent/api/files', createFilesRouter())
    app.use('/agent/api/admin', createAdminSkillsRouter(managedSkillRegistry, agentCatalogService, adminSkillCatalogService))

    // Start listening
    const { port, host, https } = config.server
    const protocol = https?.enabled ? 'https' : 'http'

    if (https?.enabled) {
      // HTTPS mode
      const options = {
        key: readFileSync(resolve(backendRoot, https.key)),
        cert: readFileSync(resolve(backendRoot, https.cert)),
      }
      createHttpsServer(options, app).listen(port, host, () => {
        const status = memoryManager.getStatus()
        logAgentBackendReady(entrypointLogger, startupSummary, {
          vectorSearchAvailable: status.vector.available,
          ftsSearchAvailable: status.fts.available
        })
      })
    } else {
      // HTTP mode
      createServer(app).listen(port, host, () => {
        const status = memoryManager.getStatus()
        logAgentBackendReady(entrypointLogger, startupSummary, {
          vectorSearchAvailable: status.vector.available,
          ftsSearchAvailable: status.fts.available
        })
      })
    }
  } catch (error) {
    logAgentBackendFatalDiagnostic(entrypointLogger, 'startup_failed', error)
    await closeRuntimeFileLogging()
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  entrypointLogger.info({
    message: 'received shutdown signal',
    data: { signal: 'SIGINT' }
  })
  await shutdownRuntime(0)
})

process.on('SIGTERM', async () => {
  entrypointLogger.info({
    message: 'received shutdown signal',
    data: { signal: 'SIGTERM' }
  })
  await shutdownRuntime(0)
})

process.on('warning', warning => {
  logAgentBackendProcessWarning(entrypointLogger, warning)
})

process.on('unhandledRejection', async reason => {
  logAgentBackendFatalDiagnostic(entrypointLogger, 'unhandledRejection', reason)
  await shutdownRuntime(1)
})

process.on('uncaughtException', async error => {
  logAgentBackendFatalDiagnostic(entrypointLogger, 'uncaughtException', error)
  await shutdownRuntime(1)
})

start()

function attachRuntimeFileLogging(): void {
  const fileLogging = config.runtime.fileLogging
  if (!fileLogging.enabled || fileLogging.format !== 'jsonl' || fileLogging.split !== 'daily') {
    return
  }
  attachRuntimeLogSink(new DailyCategoryJsonlFileSink({
    directory: fileLogging.directory,
    redactSensitive: fileLogging.redactSensitive
  }))
}

async function closeRuntimeFileLogging(): Promise<void> {
  if (!closeRuntimeLogSinksPromise) {
    closeRuntimeLogSinksPromise = closeRuntimeLogSinks()
      .catch((error: unknown) => {
        process.stderr.write(`[RuntimeLogging] Failed to close sinks: ${formatErrorMessage(error)}\n`)
      })
  }
  await closeRuntimeLogSinksPromise
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}

function resolveHttpStatus(error: unknown): number {
  const status = (error as { status?: unknown; statusCode?: unknown } | null)?.status
  if (typeof status === 'number' && status >= 400 && status <= 599) {
    return status
  }
  const statusCode = (error as { status?: unknown; statusCode?: unknown } | null)?.statusCode
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599) {
    return statusCode
  }
  return 500
}

async function shutdownRuntime(exitCode: number): Promise<void> {
  if (shutdownInitiated) {
    process.exit(exitCode)
  }
  shutdownInitiated = true
  if (memoryManager) {
    memoryManager.close()
  }
  await closeRuntimeFileLogging()
  process.exit(exitCode)
}
