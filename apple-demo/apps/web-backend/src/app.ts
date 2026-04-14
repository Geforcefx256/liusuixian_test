import { createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { readFileSync } from 'node:fs'
import type { Express, Request, Response } from 'express'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { SERVER_CONFIG } from './config/index.js'
import { initDatabase, initDefaultAdminUser, initDefaultRoles } from './database/init.js'
import { errorHandler } from './middlewares/error.js'
import { requireSameOrigin } from './middlewares/sameOrigin.js'
import { initializeMmlRuleCatalog } from './mmlRules/catalog.js'
import routes from './routes/index.js'
import {
  buildWebBackendStartupSummary,
  logWebBackendStarting,
  logWebBackendStartupSummary
} from './startupDiagnostics.js'

export async function initializeAppData(): Promise<void> {
  await initDatabase()
  await initDefaultRoles()
  await initDefaultAdminUser()
  initializeMmlRuleCatalog()
}

export function createApp(): Express {
  const app = express()
  app.set('trust proxy', true)

  app.use(cors({
    origin(origin, callback) {
      callback(null, origin || true)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  app.use(morgan('dev'))
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(requireSameOrigin)

  app.use('/web/api', routes)

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'apple-demo web-backend',
      version: '0.1.0',
      endpoints: {
        authMode: 'GET /web/api/auth/mode',
        authLogin: 'POST /web/api/auth/login',
        authMe: 'GET /web/api/auth/me',
        authLogout: 'POST /web/api/auth/logout',
        health: 'GET /health'
      }
    })
  })

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Not found' })
  })

  app.use(errorHandler)

  return app
}

export async function startServer(): Promise<void> {
  logWebBackendStarting(console)
  await initializeAppData()

  const app = createApp()
  const { port, host, https } = SERVER_CONFIG
  const listener = app
  const startupSummary = buildWebBackendStartupSummary()

  if (https.enabled) {
    createHttpsServer(
      {
        key: readFileSync(https.key),
        cert: readFileSync(https.cert)
      },
      listener
    ).listen(port, host, () => {
      logWebBackendStartupSummary(console, startupSummary)
    })
    return
  }

  createServer(listener).listen(port, host, () => {
    logWebBackendStartupSummary(console, startupSummary)
  })
}
