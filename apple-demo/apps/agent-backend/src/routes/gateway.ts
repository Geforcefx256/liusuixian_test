import { Router, type Request, type Response } from 'express'
import type { GatewayToolsInvokeRequest } from '../gateway/tools/types.js'
import { createDefaultToolProviderRegistry, ToolProviderRegistry } from '../runtime/tools/index.js'
import { loadConfig } from '../memory/ConfigLoader.js'
import { SkillCatalog } from '../skills/catalog.js'

function isInvokeRequest(body: unknown): body is GatewayToolsInvokeRequest {
  if (!body || typeof body !== 'object') return false
  const candidate = body as Partial<GatewayToolsInvokeRequest>

  if (typeof candidate.tool !== 'string' || !candidate.tool.trim()) {
    return false
  }

  if (candidate.action !== undefined && typeof candidate.action !== 'string') return false
  if (candidate.sessionKey !== undefined && typeof candidate.sessionKey !== 'string') return false
  if (candidate.dryRun !== undefined && typeof candidate.dryRun !== 'boolean') return false
  if (candidate.provider !== undefined && typeof candidate.provider !== 'string') return false
  if (candidate.agentId !== undefined && typeof candidate.agentId !== 'string') return false
  if (candidate.args !== undefined && (typeof candidate.args !== 'object' || Array.isArray(candidate.args))) {
    return false
  }
  if (candidate.trace !== undefined) {
    if (!candidate.trace || typeof candidate.trace !== 'object' || Array.isArray(candidate.trace)) return false
    const trace = candidate.trace as Record<string, unknown>
    if (trace.runId !== undefined && typeof trace.runId !== 'string') return false
    if (trace.turnId !== undefined && typeof trace.turnId !== 'string') return false
    if (trace.toolCallId !== undefined && typeof trace.toolCallId !== 'string') return false
  }

  return true
}

function mapFailureStatus(errorType: string): number {
  if (errorType === 'VALIDATION_ERROR') return 400
  if (errorType === 'TOOL_NOT_FOUND' || errorType === 'TOOL_DENIED') return 404
  return 500
}

export function createGatewayRouter(
  service: ToolProviderRegistry = createDefaultToolProviderRegistry({
    runtimeRoot: loadConfig().runtime.workspaceDir,
    skillCatalog: new SkillCatalog(),
    filesystemTools: loadConfig().runtime.filesystemTools
  })
): Router {
  const router = Router()
  const activeRegistry = service
  let sourceByProvider: Record<string, string | undefined> = {
    local: 'local',
    gateway: 'runtime',
    mcp: 'runtime',
    skill: 'skill-catalog'
  }

  router.get('/tools/catalog', (req: Request, res: Response) => {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined
    const toolProvider = typeof req.query.toolProvider === 'string' ? req.query.toolProvider : undefined
    const result = activeRegistry.catalog({ provider, agentId, toolProvider })
    const configSource = sourceByProvider[toolProvider || 'gateway'] || sourceByProvider.gateway || 'runtime'
    res.json({
      ...result,
      configSource
    })
  })

  router.post('/tools/invoke', async (req: Request, res: Response) => {
    if (!isInvokeRequest(req.body)) {
      res.status(400).json({
        ok: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body. Required field: tool(string).'
        }
      })
      return
    }

    const result = await activeRegistry.invoke(req.body)
    if (result.ok) {
      res.status(200).json(result)
      return
    }

    res.status(mapFailureStatus(result.error.type)).json(result)
  })

  router.post('/tools/refresh', async (req: Request, res: Response) => {
    const provider = typeof req.body?.provider === 'string' ? req.body.provider : undefined
    const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId : undefined
    const toolProvider = typeof req.body?.toolProvider === 'string' ? req.body.toolProvider : undefined
    const refreshed = await activeRegistry.refresh({ provider, agentId, toolProvider })
    sourceByProvider = {
      ...sourceByProvider,
      ...refreshed.sources
    }
    const preview = activeRegistry.catalog({ provider, agentId, toolProvider })
    const configSource = sourceByProvider[toolProvider || 'gateway'] || sourceByProvider.gateway || 'runtime'
    res.json({
      ok: true,
      configSource,
      toolCount: preview.tools.length,
      providers: refreshed.providers,
      sources: sourceByProvider
    })
  })

  return router
}
