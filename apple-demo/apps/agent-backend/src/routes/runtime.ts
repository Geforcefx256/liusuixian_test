import { Router, type Request, type Response } from 'express'
import { RuntimeBootstrapService } from '../runtime/bootstrap.js'
import { requireUser, type AuthenticatedRequest } from '../auth/requireUser.js'

export function createRuntimeRouter(service: RuntimeBootstrapService): Router {
  const router = Router()
  router.use(requireUser)

  router.get('/bootstrap', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    const provider = String(req.query.provider || '').trim()
    const sessionId = String(req.query.sessionId || '').trim()
    const userId = req.auth?.userId

    if (!agentId) {
      res.status(400).json({ error: 'Missing required query: agentId' })
      return
    }
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const bootstrap = await service.load({
      agentId,
      provider: provider || undefined,
      userId,
      sessionId: sessionId || undefined
    })

    if (!bootstrap) {
      res.status(404).json({ error: `Agent not found: ${agentId}` })
      return
    }

    res.json({
      ok: true,
      bootstrap
    })
  })

  router.post('/tools/refresh', (req: Request, res: Response) => {
    const provider = typeof req.body?.provider === 'string' ? req.body.provider : undefined
    const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId : undefined
    const result = service.refreshTools({ provider, agentId })
    res.json({
      ok: true,
      ...result
    })
  })

  return router
}
