import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'

import { getMmlSchemaService } from '../mmlRules/catalog.js'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import { error, success } from '../utils/response.js'

const router: ExpressRouter = Router()

router.use(requireAuth)

router.get('/options', (_req: AuthenticatedRequest, res) => {
  const options = getMmlSchemaService().getOptions()
  res.json(success(options))
})

router.get('/schema', (req: AuthenticatedRequest, res) => {
  const networkType = typeof req.query.networkType === 'string' ? req.query.networkType.trim() : ''
  const networkVersion = typeof req.query.networkVersion === 'string' ? req.query.networkVersion.trim() : ''
  if (!networkType || !networkVersion) {
    res.status(400).json(error('Missing networkType or networkVersion', { code: 'VALIDATION_ERROR' }))
    return
  }

  const schema = getMmlSchemaService().getSchema(networkType, networkVersion)
  res.json(success({ schema }))
})

export default router
