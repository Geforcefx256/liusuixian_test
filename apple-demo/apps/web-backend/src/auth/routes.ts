import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'

import * as authController from './controller.js'
import { requireAuth } from './middleware.js'

const router: ExpressRouter = Router()

router.get('/mode', authController.getAuthMode)
router.get('/login-url', authController.getLoginUrl)
router.post('/login', authController.localLogin)
router.get('/callback', authController.handleCallback)
router.get('/me', requireAuth, authController.getMe)
router.post('/change-password', requireAuth, authController.changePassword)
router.post('/logout', requireAuth, authController.logout)

export default router
