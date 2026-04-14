import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'

import * as roleController from '../controllers/roleController.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

const router: ExpressRouter = Router()

router.use(requireAuth)
router.use(requireRole(['super_admin', 'admin']))
router.get('/', roleController.listRoles)
router.put('/:roleId', roleController.updateRole)

export default router
