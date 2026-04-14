import { Router, type Request, type Response } from 'express'
import { AgentCatalogService } from '../agents/service.js'

export function createAgentsRouter(service: AgentCatalogService): Router {
  const router = Router()

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      agents: service.listAgents()
    })
  })

  router.get('/:agentId', (req: Request, res: Response) => {
    const agentId = String(req.params.agentId || '').trim()
    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }

    const agent = service.getAgentDetail(agentId)
    if (!agent) {
      res.status(404).json({ error: `Agent not found: ${agentId}` })
      return
    }

    res.json({ ok: true, agent })
  })

  return router
}
