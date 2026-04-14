import type {
  GatewayInvokeError,
  GatewayInvokeErrorType,
  GatewayInvokeResponse,
  GatewayToolManifest,
  GatewayToolsInvokeRequest
} from '../../../gateway/tools/types.js'
import { findWorkspaceFiles } from '../local/findFiles.js'
import { grepWorkspaceFiles } from '../local/grep.js'
import { editWorkspaceProjectFile } from '../local/editFile.js'
import { writeWorkspaceProjectFile } from '../local/writeFile.js'
import type { ToolProvider, ToolProviderCatalogRequest, ToolProviderRefreshResult } from '../types.js'
import { DefaultCommandRunner, type CommandRunner } from '../local/shared/commandRunner.js'
import type { RipgrepRuntimeInfo } from '../local/shared/ripgrep.js'
import type { RuntimeToolPolicy } from '../../../agent/toolFailurePolicy.js'
import { listWorkspaceDirectory } from '../local/listDirectory.js'
import { readWorkspacePath } from '../local/readFile.js'
import { ReadFileStateMap } from '../local/readFileState.js'
import {
  editFileInputSchema,
  findFilesInputSchema,
  grepInputSchema,
  listDirectoryInputSchema,
  questionInputSchema,
  readFileInputSchema,
  writeFileInputSchema
} from '../local/schemas.js'
import { QuestionToolValidationError, formatQuestionToolValidationError } from '../local/questionContract.js'
import { buildLogPreview } from '../../../support/logPreview.js'
import type { AgentSessionStore } from '../../../agent/sessionStore.js'
import {
  buildAwaitingInteractionToolSummary,
  prepareQuestionInteractionPayload,
  toInteractionView
} from '../../../agent/interactions.js'
import { fileStore } from '../../../files/fileStore.js'
import { createLogger } from '../../../logging/index.js'
import { resolveVendoredRipgrepRoot } from '../../../support/runtimePaths.js'

const localProviderLogger = createLogger({
  category: 'tool',
  component: 'local_provider'
})

class LocalToolInvocationError extends Error {
  readonly type: GatewayInvokeErrorType
  readonly field?: string
  readonly expected?: string
  readonly actual?: string
  readonly fix?: string

  constructor(type: GatewayInvokeErrorType, message: string, metadata: Partial<GatewayInvokeError> = {}) {
    super(message)
    this.name = 'LocalToolInvocationError'
    this.type = type
    this.field = metadata.field
    this.expected = metadata.expected
    this.actual = metadata.actual
    this.fix = metadata.fix
  }
}

const IDEMPOTENT_LOCAL_TOOL_POLICY: RuntimeToolPolicy = Object.freeze({
  idempotent: true,
  supportsRuntimeRetry: true,
  supportsModelRecovery: true
})

const QUESTION_TOOL_POLICY: RuntimeToolPolicy = Object.freeze({
  idempotent: false,
  supportsRuntimeRetry: false,
  supportsModelRecovery: true
})

const MUTATING_LOCAL_TOOL_POLICY: RuntimeToolPolicy = Object.freeze({
  idempotent: false,
  supportsRuntimeRetry: false,
  supportsModelRecovery: true
})

export class LocalToolProvider implements ToolProvider {
  readonly id = 'local'
  private readonly tools: GatewayToolManifest[]
  private readonly commandRunner: CommandRunner
  private readonly readFileState: ReadFileStateMap
  private readonly ripgrepRoot: string

  constructor(
    private readonly config: {
      runtimeRoot: string
      logDetail?: boolean
      sessionStore?: AgentSessionStore
      filesystemTools?: {
        compatibilityMode?: boolean
      }
      commandRunner?: CommandRunner
      readFileState?: ReadFileStateMap
      ripgrepRoot?: string
      ripgrepRuntime?: RipgrepRuntimeInfo
    }
  ) {
    this.commandRunner = config.commandRunner ?? new DefaultCommandRunner()
    this.readFileState = config.readFileState ?? new ReadFileStateMap()
    this.ripgrepRoot = config.ripgrepRoot ?? resolveVendoredRipgrepRoot(import.meta.url, 2)
    this.tools = [
      {
        id: 'read_file',
        server: 'local',
        name: 'read_file',
        description: 'Read a text file by exact workspace-relative path. Use this when you already know the file path. Use find_files first if you only know a filename or glob pattern, and use grep first if you need to search file contents across many files. This tool reads files, not directories.',
        inputSchema: readFileInputSchema,
        runtimePolicy: IDEMPOTENT_LOCAL_TOOL_POLICY
      },
      {
        id: 'list_directory',
        server: 'local',
        name: 'list_directory',
        description: 'List entries in a directory by exact workspace-relative path. Use this to inspect a known directory before choosing a file to read.',
        inputSchema: listDirectoryInputSchema,
        runtimePolicy: IDEMPOTENT_LOCAL_TOOL_POLICY
      },
      {
        id: 'find_files',
        server: 'local',
        name: 'find_files',
        description: 'Find files by filename or glob pattern when you do not know the exact path yet. Use this to locate candidate paths, then use read_file to inspect file contents. Prefer grep when you know the text you want to search for inside files.',
        inputSchema: findFilesInputSchema,
        runtimePolicy: IDEMPOTENT_LOCAL_TOOL_POLICY
      },
      {
        id: 'grep',
        server: 'local',
        name: 'grep',
        description: 'Search workspace file contents by text or regex pattern. Prefer this for search tasks instead of manually reading many files. Use literal=true for fixed text, leave it false for regex, and use basePath or glob to narrow scope. Use find_files for filename discovery and read_file to inspect matched files.',
        inputSchema: grepInputSchema,
        runtimePolicy: IDEMPOTENT_LOCAL_TOOL_POLICY
      },
      {
        id: 'write',
        server: 'local',
        name: 'write',
        description: 'Create a new text file in the current scoped workspace project directory or fully overwrite an existing one. Provide a project-relative path without the leading project/ prefix. Prefer edit for partial changes. If you are replacing an existing file, use read_file first so you know the current content.',
        inputSchema: writeFileInputSchema,
        runtimePolicy: MUTATING_LOCAL_TOOL_POLICY
      },
      {
        id: 'edit',
        server: 'local',
        name: 'edit',
        description: 'Edit an existing text file in the current scoped workspace project directory by exact string replacement. You must use read_file first and copy old_string from the current file content without any line-number prefix. Use the smallest unique old_string that identifies the target location. file_path may be the project/... path returned by read_file or the same relative form used by write. Use write only for new files or full rewrites.',
        inputSchema: editFileInputSchema,
        runtimePolicy: MUTATING_LOCAL_TOOL_POLICY
      },
      {
        id: 'question',
        server: 'local',
        name: 'question',
        description: 'Use this tool when you need to ask the user questions during execution. Select fields are for closed choices. Use text fields for open-ended values like column indexes, file names, paths, versions, or any answer that should not be constrained to fixed options. Question.required defaults to true, and any field without an explicit required value inherits it. If a field is optional, set field.required=false explicitly and keep optional or required wording out of the label.',
        inputSchema: questionInputSchema,
        runtimePolicy: QUESTION_TOOL_POLICY
      }
    ]
  }

  catalog(_request: ToolProviderCatalogRequest = {}): GatewayToolManifest[] {
    return this.tools
  }

  async invoke(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    if (request.tool === 'read_file') {
      return this.invokeReadFile(request)
    }
    if (request.tool === 'list_directory') {
      return this.invokeListDirectory(request)
    }
    if (request.tool === 'find_files') {
      return this.invokeFindFiles(request)
    }
    if (request.tool === 'grep') {
      return this.invokeGrep(request)
    }
    if (request.tool === 'write') {
      return this.invokeWrite(request)
    }
    if (request.tool === 'edit') {
      return this.invokeEdit(request)
    }
    if (request.tool === 'question') {
      return this.invokeQuestion(request)
    }
    return {
      ok: false,
      requestId: crypto.randomUUID(),
      error: {
        type: 'TOOL_NOT_FOUND',
        message: `Local tool "${request.tool}" not found`
      }
    }
  }

  private async resolveWorkspaceRoot(request: GatewayToolsInvokeRequest): Promise<string> {
    await fileStore.initialize()
    return request.workspaceScope
      ? fileStore.getWorkspaceRoot(request.workspaceScope)
      : this.config.runtimeRoot
  }

  private async invokeReadFile(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'read_file', async () => {
      const result = await readWorkspacePath(await this.resolveWorkspaceRoot(request), {
        path: String(request.args?.path || ''),
        offset: asNumber(request.args?.offset),
        limit: asNumber(request.args?.limit)
      })
      if (request.sessionKey?.trim()) {
        this.readFileState.record(request.sessionKey, result.fileMeta)
      }
      return wrapSummary(result.summary)
    })
  }

  private async invokeListDirectory(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'list_directory', async () => {
      return wrapSummary(await listWorkspaceDirectory(await this.resolveWorkspaceRoot(request), {
        path: String(request.args?.path || '')
      }))
    })
  }

  private async invokeFindFiles(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'find_files', async () => {
      return wrapSummary(await findWorkspaceFiles(await this.resolveWorkspaceRoot(request), {
        pattern: String(request.args?.pattern || ''),
        basePath: asString(request.args?.basePath),
        limit: asNumber(request.args?.limit)
      }, {
        compatibilityMode: this.config.filesystemTools?.compatibilityMode ?? true,
        commandRunner: this.commandRunner
      }))
    })
  }

  private async invokeGrep(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'grep', async () => {
      return wrapSummary(await grepWorkspaceFiles(await this.resolveWorkspaceRoot(request), {
        pattern: String(request.args?.pattern || ''),
        basePath: asString(request.args?.basePath),
        glob: asString(request.args?.glob),
        ignoreCase: asBoolean(request.args?.ignoreCase),
        literal: asBoolean(request.args?.literal),
        context: asNumber(request.args?.context),
        limit: asNumber(request.args?.limit)
      }, {
        ripgrepRoot: this.ripgrepRoot,
        commandRunner: this.commandRunner,
        runtime: this.config.ripgrepRuntime,
        trace: request.trace
      }))
    })
  }

  private async invokeWrite(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'write', async () => {
      const result = await writeWorkspaceProjectFile({
        path: String(request.args?.path || ''),
        content: String(request.args?.content || ''),
        workspaceScope: request.workspaceScope
      })
      if (request.sessionKey?.trim()) {
        this.readFileState.record(request.sessionKey, result.fileMeta)
      }
      return result
    })
  }

  private async invokeEdit(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'edit', async () => {
      return editWorkspaceProjectFile({
        file_path: String(request.args?.file_path || ''),
        old_string: String(request.args?.old_string || ''),
        new_string: String(request.args?.new_string || ''),
        replace_all: asBoolean(request.args?.replace_all),
        sessionKey: request.sessionKey,
        workspaceScope: request.workspaceScope,
        readFileState: this.readFileState
      })
    })
  }

  private async invokeQuestion(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    return this.invokeWithLogging(request, 'question', async () => {
      try {
        const sessionStore = this.config.sessionStore
        const sessionId = request.sessionKey?.trim()
        const runId = request.trace?.runId?.trim()
        if (!sessionStore || !request.workspaceScope || !sessionId || !runId) {
          throw new Error('Question tool requires session context.')
        }
        const preparedPayload = prepareQuestionInteractionPayload(request.args as any)
        const interaction = await sessionStore.createInteraction({
          userId: request.workspaceScope.userId,
          agentId: request.workspaceScope.agentId,
          sessionId,
          runId,
          kind: 'question',
          payload: preparedPayload.payload
        })
        if (preparedPayload.warnings.length > 0) {
          localProviderLogger.warn({
            message: 'question tool normalized select options',
            context: {
              runId: request.trace?.runId,
              turnId: request.trace?.turnId
            },
            data: {
              warnings: preparedPayload.warnings
            }
          })
        }
        return wrapSummary(buildAwaitingInteractionToolSummary(
          toInteractionView(interaction),
          { warnings: preparedPayload.warnings }
        ))
      } catch (error) {
        const validationMessage = formatQuestionToolValidationError(error)
        const isValidationError = validationMessage !== 'Question validation failed.'
        const message = isValidationError
          ? validationMessage
          : (error instanceof Error ? error.message : validationMessage)
        const metadata = error instanceof QuestionToolValidationError
          ? {
              field: error.field,
              expected: error.expected,
              actual: error.actual,
              fix: error.fix
            }
          : undefined
        localProviderLogger.error({
          message: 'question tool failed',
          context: {
            runId: request.trace?.runId,
            turnId: request.trace?.turnId
          },
          data: {
            error: serializeError(error),
            metadata
          }
        })
        throw new LocalToolInvocationError(isValidationError ? 'VALIDATION_ERROR' : 'EXECUTION_FAILED', message, metadata)
      }
    })
  }

  refresh(): ToolProviderRefreshResult {
    return {
      source: 'local'
    }
  }

  private async invokeWithLogging(
    request: GatewayToolsInvokeRequest,
    tool: string,
    action: () => Promise<LocalToolActionResult>
  ): Promise<GatewayInvokeResponse> {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    const args = request.args || {}
    const logArgs = sanitizeLogArgs(tool, args)

    localProviderLogger.info({
      message: 'local tool invocation started',
      context: toTraceLogContext(request.trace),
      data: {
        tool,
        requestId,
        args: logArgs
      }
    })

    try {
      const result = await action()
      const response = this.toSuccessResponse(request, tool, result.summary, requestId, startedAt)
      const durationMs = Date.now() - startedAt
      localProviderLogger.info({
        message: 'local tool invocation completed',
        context: toTraceLogContext(request.trace),
        data: buildSuccessLogPayload({
          tool,
          requestId,
          durationMs,
          args: logArgs,
          summary: result.summary,
          logMeta: result.logMeta,
          trace: request.trace ?? null,
          logDetail: Boolean(this.config.logDetail)
        })
      })
      return response
    } catch (error) {
      const response = this.toFailureResponse(error, requestId)
      const durationMs = Date.now() - startedAt
      localProviderLogger.error({
        message: 'local tool invocation failed',
        context: toTraceLogContext(request.trace),
        data: {
          tool,
          requestId,
          ok: false,
          durationMs,
          args: logArgs,
          error: serializeError(error)
        }
      })
      return response
    }
  }

  private toSuccessResponse(
    request: GatewayToolsInvokeRequest,
    tool: string,
    summary: string,
    requestId: string,
    startedAt: number
  ): GatewayInvokeResponse {
    return {
      ok: true,
      requestId,
      result: {
        tool,
        summary,
        operations: [],
        meta: {
          server: 'local',
          tool,
          latencyMs: Date.now() - startedAt,
          inputChars: JSON.stringify(request.args || {}).length,
          operationsChars: 0,
          summaryChars: summary.length,
          trace: request.trace
        }
      }
    }
  }

  private toFailureResponse(error: unknown, requestId: string): GatewayInvokeResponse {
    return {
      ok: false,
      requestId,
      error: {
        type: error instanceof LocalToolInvocationError ? error.type : 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown local tool error',
        ...(error instanceof LocalToolInvocationError && error.field ? { field: error.field } : {}),
        ...(error instanceof LocalToolInvocationError && error.expected ? { expected: error.expected } : {}),
        ...(error instanceof LocalToolInvocationError && error.actual ? { actual: error.actual } : {}),
        ...(error instanceof LocalToolInvocationError && error.fix ? { fix: error.fix } : {})
      }
    }
  }
}

interface LocalToolActionResult {
  summary: string
  logMeta?: Record<string, unknown>
}

function wrapSummary(summary: string): LocalToolActionResult {
  return { summary }
}

function sanitizeLogArgs(tool: string, args: Record<string, unknown>): Record<string, unknown> {
  if (tool === 'write') {
    return sanitizeWriteArgs(args)
  }
  if (tool === 'edit') {
    return sanitizeEditArgs(args)
  }
  return args
}

function buildSuccessLogPayload(params: {
  tool: string
  requestId: string
  durationMs: number
  args: Record<string, unknown>
  summary: string
  logMeta?: Record<string, unknown>
  trace: GatewayToolsInvokeRequest['trace'] | null
  logDetail: boolean
}): Record<string, unknown> {
  if (params.tool === 'write' || params.tool === 'edit') {
    return {
      tool: params.tool,
      requestId: params.requestId,
      ok: true,
      durationMs: params.durationMs,
      args: params.args,
      result: params.logMeta || null,
      summaryChars: params.summary.length,
      trace: params.trace
    }
  }
  return {
    tool: params.tool,
    requestId: params.requestId,
    ok: true,
    durationMs: params.durationMs,
    args: params.args,
    summaryChars: params.summary.length,
    summaryPreview: buildLogPreview(params.summary, {
      disableTruncation: params.logDetail
    }),
    trace: params.trace
  }
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

function serializeError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return { message: error.message, name: error.name }
  }
  return { message: 'Unknown local tool error' }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function sanitizeWriteArgs(args: Record<string, unknown>): Record<string, unknown> {
  const content = typeof args.content === 'string' ? args.content : ''
  return {
    path: typeof args.path === 'string' ? args.path : '',
    contentChars: content.length,
    contentBytes: Buffer.byteLength(content, 'utf8')
  }
}

function sanitizeEditArgs(args: Record<string, unknown>): Record<string, unknown> {
  const oldString = typeof args.old_string === 'string' ? args.old_string : ''
  const newString = typeof args.new_string === 'string' ? args.new_string : ''
  return {
    file_path: typeof args.file_path === 'string' ? args.file_path : '',
    replace_all: typeof args.replace_all === 'boolean' ? args.replace_all : false,
    old_string_chars: oldString.length,
    old_string_bytes: Buffer.byteLength(oldString, 'utf8'),
    new_string_chars: newString.length,
    new_string_bytes: Buffer.byteLength(newString, 'utf8')
  }
}
