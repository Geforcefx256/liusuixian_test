import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'

import authRoutes from '../auth/routes.js'
import mmlRoutes from './mmlRoutes.js'
import roleRoutes from './roleRoutes.js'
import userRoutes from './userRoutes.js'

const router: ExpressRouter = Router()

router.use('/auth', authRoutes)
router.use('/mml', mmlRoutes)
router.use('/users', userRoutes)
router.use('/roles', roleRoutes)

export default router
