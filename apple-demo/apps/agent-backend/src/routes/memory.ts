/**
 * Memory API Routes
 *
 * REST API endpoints for memory system.
 */

import { Router, type Request, type Response } from 'express'
import { MemoryManager } from '../memory/index.js'
import type {
  CreateLongTermMemoryRequest,
  UpdateLongTermMemoryRequest,
  CreateDailyLogRequest,
  MemorySearchRequest
} from '../memory/types.js'

/**
 * Create memory API router
 */
export function createMemoryRouter(memoryManager: MemoryManager): Router {
  const router = Router()

  // ===========================================================================
  // Status & Sync
  // ===========================================================================

  /**
   * GET /agent/api/memory/status
   * Get memory system status
   */
  router.get('/status', (_req: Request, res: Response) => {
    try {
      const status = memoryManager.getStatus()
      res.json(status)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * POST /agent/api/memory/sync
   * Trigger index sync
   */
  router.post('/sync', async (_req: Request, res: Response) => {
    try {
      await memoryManager.sync()
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  // ===========================================================================
  // Long-term Memory
  // ===========================================================================

  /**
   * GET /agent/api/memory/longterm
   * List all long-term memories
   */
  router.get('/longterm', async (_req: Request, res: Response) => {
    try {
      const memories = await memoryManager.getLongTermMemories()
      res.json(memories)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * GET /agent/api/memory/longterm/:id
   * Get long-term memory by ID
   */
  router.get('/longterm/:id', async (req: Request, res: Response) => {
    try {
      const memory = await memoryManager.getLongTermMemory(req.params.id)
      if (!memory) {
        res.status(404).json({ error: 'Memory not found' })
        return
      }
      res.json(memory)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * POST /agent/api/memory/longterm
   * Add long-term memory
   */
  router.post('/longterm', async (req: Request, res: Response) => {
    try {
      const request = req.body as CreateLongTermMemoryRequest
      if (!request.content) {
        res.status(400).json({ error: 'Content is required' })
        return
      }
      const memory = await memoryManager.addLongTermMemory(request)
      res.status(201).json(memory)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * PUT /agent/api/memory/longterm/:id
   * Update long-term memory
   */
  router.put('/longterm/:id', async (req: Request, res: Response) => {
    try {
      const request = req.body as UpdateLongTermMemoryRequest
      const memory = await memoryManager.updateLongTermMemory(req.params.id, request)
      if (!memory) {
        res.status(404).json({ error: 'Memory not found' })
        return
      }
      res.json(memory)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * DELETE /agent/api/memory/longterm/:id
   * Delete long-term memory
   */
  router.delete('/longterm/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await memoryManager.deleteLongTermMemory(req.params.id)
      if (!deleted) {
        res.status(404).json({ error: 'Memory not found' })
        return
      }
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  // ===========================================================================
  // Daily Logs
  // ===========================================================================

  /**
   * GET /agent/api/memory/daily
   * List daily log dates
   */
  router.get('/daily', async (_req: Request, res: Response) => {
    try {
      const dates = await memoryManager.getDailyLogDates()
      res.json(dates)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * GET /agent/api/memory/daily/:date
   * Get daily log entries by date
   */
  router.get('/daily/:date', async (req: Request, res: Response) => {
    try {
      const entries = await memoryManager.getDailyLog(req.params.date)
      res.json(entries)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * POST /agent/api/memory/daily
   * Add daily log entry
   */
  router.post('/daily', async (req: Request, res: Response) => {
    try {
      const request = req.body as CreateDailyLogRequest
      if (!request.content) {
        res.status(400).json({ error: 'Content is required' })
        return
      }
      const entry = await memoryManager.addDailyLog(request)
      res.status(201).json(entry)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  /**
   * DELETE /agent/api/memory/daily/:date/:id
   * Delete daily log entry
   */
  router.delete('/daily/:date/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await memoryManager.deleteDailyLog(req.params.id, req.params.date)
      if (!deleted) {
        res.status(404).json({ error: 'Entry not found' })
        return
      }
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * POST /agent/api/memory/search
   * Hybrid search
   */
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const request = req.body as MemorySearchRequest
      if (!request.query) {
        res.status(400).json({ error: 'Query is required' })
        return
      }
      const results = await memoryManager.search(request.query, {
        limit: request.limit,
        minScore: request.minScore,
        sources: request.sources
      })
      res.json(results)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })

  return router
}
