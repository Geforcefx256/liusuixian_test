import { dirname } from 'node:path'
import type {
  GatewayInvokeErrorType,
  GatewayInjectedSkillContextMessage,
  GatewayInvokeResponse,
  GatewayToolManifest,
  GatewayToolsInvokeRequest
} from '../../../gateway/tools/types.js'
import type { ToolProvider, ToolProviderCatalogRequest, ToolProviderRefreshResult } from '../types.js'
import type { SkillCatalog, SkillCatalogEntry } from '../../../skills/catalog.js'
import type { ManagedSkillRegistry } from '../../../skills/managedRegistry.js'
import { buildLogPreview } from '../../../support/logPreview.js'
import { buildSkillLoadResult, serializeSkillToolError } from '../skill/content.js'
import {
  findSkillAssets,
  listSkillAssets,
  readSkillAsset
} from '../skill/assets.js'
import { executeGovernedScript } from '../skill/scriptExecutor.js'
import { buildSkillToolCatalog } from '../skill/manifests.js'
import { SkillScriptValidationError } from '../skill/execValidation.js'
import { createLogger } from '../../../logging/index.js'

const SKILL_TOOL_ID = 'skill'
const READ_ASSET_TOOL_ID = 'read_asset'
const FIND_ASSETS_TOOL_ID = 'find_assets'
const LIST_ASSETS_TOOL_ID = 'list_assets'
const EXEC_TOOL_ID = 'exec'
const skillProviderLogger = createLogger({
  category: 'tool',
  component: 'skill_provider'
})

type SkillToolId =
  | typeof SKILL_TOOL_ID
  | typeof READ_ASSET_TOOL_ID
  | typeof FIND_ASSETS_TOOL_ID
  | typeof LIST_ASSETS_TOOL_ID
  | typeof EXEC_TOOL_ID

interface SkillToolArgs {
  name?: string
}

interface SkillAssetToolArgs {
  skillName?: string
}

interface SkillExecToolArgs {
  skillName?: string
  templateId?: string
  args?: Record<string, unknown>
}

class SkillToolInvocationError extends Error {
  readonly type: GatewayInvokeErrorType

  constructor(type: GatewayInvokeErrorType, message: string) {
    super(message)
    this.name = 'SkillToolInvocationError'
    this.type = type
  }
}

export class SkillToolProvider implements ToolProvider {
  readonly id = 'skill'

  constructor(
    private readonly skillCatalog: SkillCatalog,
    private readonly managedSkillRegistry?: ManagedSkillRegistry,
    private readonly options: {
      logDetail?: boolean
      runtimeRoot?: string
    } = {}
  ) {}

  catalog(request: ToolProviderCatalogRequest = {}): GatewayToolManifest[] {
    const skills = this.getAvailableSkills(request.agentId, request.allowedSkillIds)
    if (skills.length === 0) {
      return []
    }
    return buildSkillToolCatalog(skills)
  }

  async invoke(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    if (request.tool === SKILL_TOOL_ID) {
      return this.invokeSkill(request)
    }
    if (request.tool === READ_ASSET_TOOL_ID) {
      return this.invokeSkillAsset(request, READ_ASSET_TOOL_ID, baseDir => readSkillAsset(baseDir, {
        path: String(request.args?.path || ''),
        offset: asNumber(request.args?.offset),
        limit: asNumber(request.args?.limit)
      }))
    }
    if (request.tool === LIST_ASSETS_TOOL_ID) {
      return this.invokeSkillAsset(request, LIST_ASSETS_TOOL_ID, baseDir => listSkillAssets(baseDir, {
        path: String(request.args?.path || '')
      }))
    }
    if (request.tool === FIND_ASSETS_TOOL_ID) {
      return this.invokeSkillAsset(request, FIND_ASSETS_TOOL_ID, baseDir => findSkillAssets(baseDir, {
        pattern: String(request.args?.pattern || ''),
        basePath: asString(request.args?.basePath),
        limit: asNumber(request.args?.limit)
      }))
    }
    if (request.tool === EXEC_TOOL_ID) {
      return this.invokeExec(request)
    }
    return {
      ok: false,
      requestId: crypto.randomUUID(),
      error: {
        type: 'TOOL_NOT_FOUND',
        message: `Skill tool "${request.tool}" not found`
      }
    }
  }

  refresh(): ToolProviderRefreshResult {
    return { source: 'skill-catalog' }
  }

  private async invokeSkill(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, SKILL_TOOL_ID, () => {
      const args = request.args as SkillToolArgs | undefined
      const rawName = typeof args?.name === 'string' ? args.name.trim() : ''
      if (!rawName) {
        return 'E_SKILL_INVALID: missing skill name'
      }

      const skill = this.resolveSkill(rawName, request)
      if (!skill) {
        return `E_SKILL_NOT_FOUND: ${rawName}`
      }
      const loaded = buildSkillLoadResult(skill)
      return {
        summary: loaded.summary,
        sideEffects: {
          injectedMessages: [{
            role: 'assistant',
            visibility: 'hidden',
            semantic: 'skill-context',
            skillName: skill.name,
            text: loaded.canonicalContent
          }]
        }
      }
    })
  }

  private async invokeSkillAsset(
    request: GatewayToolsInvokeRequest,
    tool: Exclude<SkillToolId, typeof SKILL_TOOL_ID>,
    action: (skillBaseDir: string) => Promise<string>
  ): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, tool, async () => {
      const args = request.args as SkillAssetToolArgs | undefined
      const skillName = this.requireSkillName(args)
      const skill = this.resolveSkill(skillName, request)
      if (!skill) {
        throw new SkillToolInvocationError('TOOL_NOT_FOUND', `E_SKILL_NOT_FOUND: ${skillName}`)
      }
      return action(dirname(skill.sourcePath))
    })
  }

  private async invokeExec(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, EXEC_TOOL_ID, async () => {
      const args = request.args as SkillExecToolArgs | undefined
      const skillName = this.requireSkillName(args)
      const templateId = this.requireTemplateId(args)
      const input = isRecord(args?.args) ? args.args : {}
      const skill = this.resolveSkill(skillName, request)
      if (!skill) {
        throw new SkillToolInvocationError('TOOL_NOT_FOUND', `E_SKILL_NOT_FOUND: ${skillName}`)
      }
      const template = skill.execTemplates.find(item => item.id === templateId)
      if (!template) {
        throw new SkillToolInvocationError('TOOL_NOT_FOUND', `E_TEMPLATE_NOT_FOUND: ${skillName}.${templateId}`)
      }
      if (!request.workspaceScope) {
        throw new SkillToolInvocationError('VALIDATION_ERROR', 'skill:exec requires a workspace scope')
      }
      return executeGovernedScript({
        template,
        args: input,
        workspaceScope: request.workspaceScope,
        runtimeRoot: this.options.runtimeRoot || process.cwd()
      })
    })
  }

  private requireSkillName(args: SkillAssetToolArgs | undefined): string {
    const skillName = typeof args?.skillName === 'string' ? args.skillName.trim() : ''
    if (!skillName) {
      throw new SkillToolInvocationError('VALIDATION_ERROR', 'skillName is required')
    }
    return skillName
  }

  private requireTemplateId(args: SkillExecToolArgs | undefined): string {
    const templateId = typeof args?.templateId === 'string' ? args.templateId.trim() : ''
    if (!templateId) {
      throw new SkillToolInvocationError('VALIDATION_ERROR', 'templateId is required')
    }
    return templateId
  }

  private async invokeWithLogging(
    request: GatewayToolsInvokeRequest,
    tool: SkillToolId,
    action: () => Promise<SkillToolSuccessPayload | string> | SkillToolSuccessPayload | string
  ): Promise<GatewayInvokeResponse> {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    const args = request.args || {}

    skillProviderLogger.info({
      message: 'skill tool invocation started',
      context: toTraceLogContext(request.trace),
      data: {
        tool,
        requestId,
        args
      }
    })

    try {
      const payload = normalizeSuccessPayload(await action())
      return this.logAndReturnSuccess(request, tool, requestId, startedAt, payload)
    } catch (error) {
      return this.logAndReturnFailure(requestId, startedAt, tool, error)
    }
  }

  private successResponse(
    request: GatewayToolsInvokeRequest,
    tool: SkillToolId,
    payload: SkillToolSuccessPayload,
    requestId: string,
    startedAt: number
  ): GatewayInvokeResponse {
    return {
      ok: true,
      requestId,
      result: {
        tool,
        summary: payload.summary,
        operations: [],
        meta: {
          server: 'skill',
          tool,
          latencyMs: Date.now() - startedAt,
          inputChars: JSON.stringify(request.args || {}).length,
          operationsChars: 0,
          summaryChars: payload.summary.length,
          trace: request.trace
        },
        ...(payload.sideEffects ? { sideEffects: payload.sideEffects } : {})
      }
    }
  }

  private logAndReturnSuccess(
    request: GatewayToolsInvokeRequest,
    tool: SkillToolId,
    requestId: string,
    startedAt: number,
    payload: SkillToolSuccessPayload
  ): GatewayInvokeResponse {
    const response = this.successResponse(request, tool, payload, requestId, startedAt)
    const injectedMessages = payload.sideEffects?.injectedMessages ?? []
    skillProviderLogger.info({
      message: 'skill tool invocation completed',
      context: toTraceLogContext(request.trace),
      data: {
        tool,
        requestId,
        ok: true,
        durationMs: Date.now() - startedAt,
        args: request.args || {},
        summaryChars: payload.summary.length,
        summaryPreview: buildLogPreview(payload.summary, {
          disableTruncation: Boolean(this.options.logDetail)
        }),
        injectedMessageCount: injectedMessages.length,
        injectedMessages: injectedMessages.map(message => summarizeInjectedMessage(message))
      }
    })
    return response
  }

  private logAndReturnFailure(
    requestId: string,
    startedAt: number,
    tool: SkillToolId,
    error: unknown
  ): GatewayInvokeResponse {
    skillProviderLogger.error({
      message: 'skill tool invocation failed',
      data: {
        tool,
        requestId,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: serializeSkillToolError(error)
      }
    })
    return {
      ok: false,
      requestId,
      error: {
        type: error instanceof SkillToolInvocationError
          ? error.type
          : error instanceof SkillScriptValidationError
            ? 'VALIDATION_ERROR'
            : 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown skill tool error'
      }
    }
  }

  private getAvailableSkills(agentId?: string, allowedSkillIds?: string[]): SkillCatalogEntry[] {
    const skills = this.managedSkillRegistry
      ? (agentId
          ? this.managedSkillRegistry.getGovernedCanonicalSkillsForAgent(agentId)
          : [])
      : (agentId
          ? this.skillCatalog.getSkillsForAgent(agentId)
          : this.skillCatalog.getAllSkills())
    if (!Array.isArray(allowedSkillIds)) {
      return skills
    }
    const allowed = new Set(allowedSkillIds)
    return skills.filter(skill => allowed.has(skill.id))
  }

  private resolveSkill(
    rawName: string,
    request: Pick<GatewayToolsInvokeRequest, 'agentId' | 'allowedSkillIds'>
  ): SkillCatalogEntry | null {
    const available = this.getAvailableSkills(request.agentId, request.allowedSkillIds)
    const approvedSkill = findSkillByName(available, rawName)
    if (approvedSkill) {
      return approvedSkill
    }
    if ((this.managedSkillRegistry || Array.isArray(request.allowedSkillIds)) && this.hasKnownSkill(rawName, request.agentId)) {
      throw new SkillToolInvocationError('TOOL_DENIED', `E_SKILL_NOT_APPROVED: ${rawName}`)
    }
    if (this.managedSkillRegistry) {
      return null
    }
    return this.skillCatalog.getSkillByName(rawName, request.agentId || undefined)
      || this.skillCatalog.getSkillByName(rawName)
  }

  private hasKnownSkill(rawName: string, agentId?: string): boolean {
    if (findSkillByName(this.getAvailableSkills(agentId), rawName)) {
      return true
    }
    return Boolean(this.skillCatalog.getSkillByName(rawName))
  }
}

interface SkillToolSuccessPayload {
  summary: string
  sideEffects?: {
    injectedMessages: GatewayInjectedSkillContextMessage[]
  }
}

function normalizeSuccessPayload(payload: SkillToolSuccessPayload | string): SkillToolSuccessPayload {
  return typeof payload === 'string'
    ? { summary: payload }
    : payload
}

function summarizeInjectedMessage(message: GatewayInjectedSkillContextMessage): Record<string, unknown> {
  return {
    role: message.role,
    visibility: message.visibility,
    semantic: message.semantic,
    skillName: message.skillName,
    textChars: message.text.length,
    textPreview: buildLogPreview(message.text, { maxChars: 160 })
  }
}

function findSkillByName(skills: SkillCatalogEntry[], rawName: string): SkillCatalogEntry | null {
  return skills.find(skill => skill.name === rawName || skill.id === rawName) || null
}

function toTraceLogContext(
  trace: GatewayToolsInvokeRequest['trace'] | null | undefined
): { runId: string; turnId?: string } | undefined {
  if (!trace?.runId) {
    return undefined
  }
  return {
    runId: trace.runId,
    ...(trace.turnId ? { turnId: trace.turnId } : {})
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
