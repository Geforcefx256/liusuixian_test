import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import type { AgentCatalogService } from '../agents/service.js'
import { requireUser, type AuthenticatedRequest } from '../auth/requireUser.js'
import { requireAdmin } from '../auth/requireAdmin.js'
import { parseManagedSkillIntentGroup, type ManagedSkillIntentGroup } from '../skills/managedIntentGroup.js'
import {
  ManagedSkillRegistry,
  type ManagedSkillAgentBinding,
  type ManagedSkillLifecycle
} from '../skills/managedRegistry.js'
import {
  AdminSkillCatalogService,
  getSkillUploadValidationIssues,
  isSkillUploadValidationError,
  SkillUploadConflictError
} from '../skills/adminCatalogService.js'

type SkillUploadRequestErrorCode = 'SKILL_UPLOAD_INVALID_FILE' | 'SKILL_UPLOAD_MULTIPART_ERROR'

const ZIP_UPLOAD_OPTIONS: multer.Options & { defParamCharset: 'utf8' } = {
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      cb(createSkillUploadRequestError('Only ZIP skill packages are allowed', 'SKILL_UPLOAD_INVALID_FILE'))
      return
    }
    cb(null, true)
  }
}

export function createAdminSkillsRouter(
  registry: ManagedSkillRegistry,
  agentCatalogService: Pick<AgentCatalogService, 'listAgents'>,
  adminSkillCatalogService?: AdminSkillCatalogService
): Router {
  const router = Router()
  router.use(requireUser)
  router.use(requireAdmin)
  const upload = multer(ZIP_UPLOAD_OPTIONS)

  router.get('/skills', (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      ok: true,
      skills: registry.listManagedSkills(),
      agents: agentCatalogService.listAgents()
    })
  })

  router.post('/skills/import', async (req: AuthenticatedRequest, res: Response) => {
    const skillIds = Array.isArray(req.body?.skillIds)
      ? req.body.skillIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : undefined
    const skills = await registry.syncFromCatalog(skillIds)
    res.json({
      ok: true,
      importedCount: skills.length,
      skills
    })
  })

  const parseUpload = createSingleFileUploadHandler(upload)
  router.post('/skills/upload', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await parseUpload(req, res)
      if (!adminSkillCatalogService) {
        res.status(501).json({ error: 'Skill upload service unavailable' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Missing skill zip upload' })
        return
      }
      const result = await adminSkillCatalogService.uploadSkill(
        req.file.buffer,
        req.file.originalname,
        String(req.query.overwrite || '').trim() === 'true'
      )
      res.json({ ok: true, replaced: result.replaced, skill: result.skill })
    } catch (error) {
      respondToSkillUploadError(res, error)
    }
  })

  router.patch('/skills/:skillId', async (req: AuthenticatedRequest, res: Response) => {
    const skillId = String(req.params.skillId || '').trim()
    if (!skillId) {
      res.status(400).json({ error: 'Missing skillId' })
      return
    }

    const lifecycle = parseLifecycle(req.body?.lifecycle)
    if (req.body?.lifecycle !== undefined && !lifecycle) {
      res.status(400).json({ error: 'Invalid lifecycle' })
      return
    }

    const intentGroup = parseIntentGroup(req.body?.intentGroup)
    if (req.body?.intentGroup !== undefined && req.body?.intentGroup !== null && !intentGroup) {
      res.status(400).json({ error: 'Invalid intentGroup' })
      return
    }

    const agentBindings = req.body?.agentBindings
    if (agentBindings !== undefined && !Array.isArray(agentBindings)) {
      res.status(400).json({ error: 'Invalid agentBindings' })
      return
    }

    try {
      const skill = await registry.updateManagedSkill(skillId, {
        displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
        displayDescription: typeof req.body?.displayDescription === 'string' ? req.body.displayDescription : undefined,
        starterSummary: typeof req.body?.starterSummary === 'string' ? req.body.starterSummary : undefined,
        lifecycle: lifecycle || undefined,
        intentGroup: req.body?.intentGroup === null ? null : (intentGroup || undefined),
        starterEnabled: typeof req.body?.starterEnabled === 'boolean' ? req.body.starterEnabled : undefined,
        starterPriority: typeof req.body?.starterPriority === 'number' ? req.body.starterPriority : undefined,
        agentBindings: Array.isArray(agentBindings) ? parseAgentBindings(agentBindings) : undefined
      })
      res.json({ ok: true, skill })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update managed skill'
      const status = message.includes('not found') ? 404 : 500
      res.status(status).json({ error: message })
    }
  })

  router.delete('/skills/:skillId', async (req: AuthenticatedRequest, res: Response) => {
    if (!adminSkillCatalogService) {
      res.status(501).json({ error: 'Skill delete service unavailable' })
      return
    }
    const skillId = String(req.params.skillId || '').trim()
    if (!skillId) {
      res.status(400).json({ error: 'Missing skillId' })
      return
    }
    if (req.query.confirm !== 'true') {
      res.status(400).json({
        error: 'Delete confirmation required',
        code: 'SKILL_DELETE_CONFIRMATION_REQUIRED'
      })
      return
    }

    try {
      await adminSkillCatalogService.deleteSkill(skillId)
      res.json({ ok: true, skillId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete skill'
      const status = message.includes('not found') ? 404 : 400
      res.status(status).json({ error: message })
    }
  })

  return router
}

function createSingleFileUploadHandler(upload: ReturnType<typeof multer>) {
  const middleware = upload.single('file')
  return (req: Request, res: Response): Promise<void> => {
    return new Promise((resolve, reject) => {
      middleware(req, res, error => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}

function createSkillUploadRequestError(message: string, code: SkillUploadRequestErrorCode): Error & {
  code: SkillUploadRequestErrorCode
} {
  return Object.assign(new Error(message), { code })
}

function isSkillUploadRequestError(error: unknown): error is Error & { code: SkillUploadRequestErrorCode } {
  if (!(error instanceof Error)) {
    return false
  }
  const code = (error as Error & { code?: unknown }).code
  return code === 'SKILL_UPLOAD_INVALID_FILE' || code === 'SKILL_UPLOAD_MULTIPART_ERROR'
}

function respondToSkillUploadError(res: Response, error: unknown): void {
  if (error instanceof SkillUploadConflictError) {
    res.status(409).json({
      error: 'Canonical skill already exists',
      code: 'SKILL_UPLOAD_CONFLICT',
      conflict: error.conflict
    })
    return
  }
  if (isSkillUploadValidationError(error)) {
    res.status(400).json({
      error: 'Invalid skill package',
      code: 'SKILL_UPLOAD_INVALID',
      issues: getSkillUploadValidationIssues(error)
    })
    return
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: 'Invalid multipart skill upload request',
      code: 'SKILL_UPLOAD_MULTIPART_ERROR'
    })
    return
  }
  if (isSkillUploadRequestError(error)) {
    res.status(400).json({
      error: error.message,
      code: error.code
    })
    return
  }
  const message = error instanceof Error ? error.message : 'Failed to upload skill package'
  res.status(400).json({ error: message })
}

function parseLifecycle(value: unknown): ManagedSkillLifecycle | null {
  if (value === 'draft' || value === 'published') return value
  return null
}

function parseIntentGroup(value: unknown): ManagedSkillIntentGroup | null {
  return parseManagedSkillIntentGroup(value)
}

function parseAgentBindings(values: unknown[]): ManagedSkillAgentBinding[] {
  return values
    .map(value => {
      if (!value || typeof value !== 'object') return null
      const candidate = value as { agentId?: unknown }
      const agentId = typeof candidate.agentId === 'string' ? candidate.agentId.trim() : ''
      if (!agentId) return null
      return { agentId }
    })
    .filter((binding): binding is ManagedSkillAgentBinding => Boolean(binding))
}
