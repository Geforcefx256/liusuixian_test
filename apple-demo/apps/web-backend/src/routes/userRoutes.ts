import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'

import * as userController from '../controllers/userController.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

const router: ExpressRouter = Router()

router.use(requireAuth)
router.use(requireRole(['super_admin', 'admin']))
router.get('/', userController.listUsers)
router.get('/:userId', userController.getUser)
router.put('/:userId', userController.updateUser)
router.patch('/:userId/status', userController.updateUserStatus)
router.put('/:userId/roles', userController.replaceUserRoles)

export default router
