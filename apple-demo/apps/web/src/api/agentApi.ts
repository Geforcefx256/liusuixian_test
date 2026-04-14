import { getAgentApiBase } from '@/config/apiConfig'
import type {
  AdminSkillsListPayload,
  AgentCatalogDetail,
  AgentCatalogSummary,
  AgentRunCancelResponse,
  AgentRunRequest,
  AgentRunResult,
  ClearHistorySessionsResponse,
  AgentSessionInteraction,
  AgentSessionListItem,
  AgentSessionMessageView,
  AgentSessionUsageSummary,
  AgentWorkspacePayload,
  AgentStreamEvent,
  DecidePlanResponse,
  ManagedSkillRecord,
  SkillUploadConflict,
  SkillUploadValidationIssue,
  ManagedSkillUpdateRequest,
  RuntimeBootstrapPayload,
  UploadManagedSkillResult,
  UploadedFile,
  ProjectFolderDescriptor,
  WorkspaceEditorMode,
  WorkspaceFileDescriptor,
  WorkspaceMmlMetadata
} from './types'

const AGENT_API_BASE = getAgentApiBase()

interface ApiErrorPayload {
  error?: string
  code?: string
  path?: string
  conflict?: SkillUploadConflict
  issues?: SkillUploadValidationIssue[]
}

function createApiError(
  message: string,
  extras: {
    code?: string
    path?: string
    status?: number
    conflict?: SkillUploadConflict
    issues?: SkillUploadValidationIssue[]
  } = {}
): Error & {
  code?: string
  path?: string
  status?: number
  conflict?: SkillUploadConflict
  issues?: SkillUploadValidationIssue[]
} {
  return Object.assign(new Error(message), extras)
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
  const text = await response.text()
  if (!text.trim()) {
    return {}
  }
  try {
    return JSON.parse(text) as ApiErrorPayload
  } catch {
    return { error: text }
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...(init || {}),
    credentials: 'include'
  })
  const payload = await response.json() as T | ApiErrorPayload
  if (!response.ok) {
    throw createApiError((payload as ApiErrorPayload).error || `HTTP ${response.status}`, {
      code: (payload as ApiErrorPayload).code,
      path: (payload as ApiErrorPayload).path,
      conflict: (payload as ApiErrorPayload).conflict,
      issues: (payload as ApiErrorPayload).issues,
      status: response.status
    })
  }
  return payload as T
}

async function requestBlob(
  url: string,
  init?: RequestInit
): Promise<{ blob: Blob; headers: Headers }> {
  const response = await fetch(url, {
    ...(init || {}),
    credentials: 'include'
  })
  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw createApiError(payload.error || `HTTP ${response.status}`, {
      code: payload.code,
      path: payload.path,
      conflict: payload.conflict,
      issues: payload.issues,
      status: response.status
    })
  }
  return {
    blob: await response.blob(),
    headers: response.headers
  }
}

function extractDownloadFileName(headers: Headers): string {
  const contentDisposition = headers.get('content-disposition') || ''
  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1].trim())
  }
  const quotedMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim()
  }
  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i)
  if (plainMatch?.[1]) {
    return plainMatch[1].trim()
  }
  throw new Error('Missing download filename')
}

async function* parseNdjson<T>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      yield JSON.parse(trimmed) as T
    }
  }

  const tail = buffer.trim()
  if (tail) {
    yield JSON.parse(tail) as T
  }
}

export const agentApi = {
  async listAgents(): Promise<AgentCatalogSummary[]> {
    const response = await requestJson<{ ok: boolean; agents: AgentCatalogSummary[] }>(`${AGENT_API_BASE}/agents`)
    return response.agents
  },

  async getAgent(agentId: string): Promise<AgentCatalogDetail> {
    const response = await requestJson<{ ok: boolean; agent: AgentCatalogDetail }>(
      `${AGENT_API_BASE}/agents/${encodeURIComponent(agentId)}`
    )
    return response.agent
  },

  async bootstrap(agentId: string, sessionId?: string | null): Promise<RuntimeBootstrapPayload> {
    const query = new URLSearchParams({ agentId })
    if (sessionId) {
      query.set('sessionId', sessionId)
    }
    const response = await requestJson<{ ok: boolean; bootstrap: RuntimeBootstrapPayload }>(
      `${AGENT_API_BASE}/runtime/bootstrap?${query.toString()}`
    )
    return response.bootstrap
  },

  async listSessions(agentId: string): Promise<AgentSessionListItem[]> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; sessions: AgentSessionListItem[] }>(
      `${AGENT_API_BASE}/agent/sessions?${query.toString()}`
    )
    return response.sessions
  },

  async createSession(agentId: string, title?: string): Promise<AgentSessionListItem> {
    const response = await requestJson<{ ok: boolean; session: AgentSessionListItem }>(
      `${AGENT_API_BASE}/agent/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, title })
      }
    )
    return response.session
  },

  async deleteSession(agentId: string, sessionId: string): Promise<string> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; sessionId: string }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}?${query.toString()}`,
      {
        method: 'DELETE'
      }
    )
    return response.sessionId
  },

  async clearHistorySessions(
    agentId: string,
    excludedSessionId?: string | null
  ): Promise<ClearHistorySessionsResponse> {
    const response = await requestJson<{ ok: boolean } & ClearHistorySessionsResponse>(
      `${AGENT_API_BASE}/agent/sessions/history/clear`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, excludedSessionId: excludedSessionId || null })
      }
    )
    return {
      deletedCount: response.deletedCount,
      excludedSessionId: response.excludedSessionId,
      skippedActiveSessionIds: response.skippedActiveSessionIds
    }
  },

  async getSessionMessages(agentId: string, sessionId: string): Promise<AgentSessionMessageView[]> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; messages: AgentSessionMessageView[] }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/messages?${query.toString()}`
    )
    return response.messages
  },

  async getSessionUsageSummary(agentId: string, sessionId: string): Promise<AgentSessionUsageSummary> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; usage: AgentSessionUsageSummary }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/usage?${query.toString()}`
    )
    return response.usage
  },

  async listSessionInteractions(
    agentId: string,
    sessionId: string,
    statuses: Array<'pending' | 'answered' | 'rejected'> = ['pending']
  ): Promise<AgentSessionInteraction[]> {
    const query = new URLSearchParams({
      agentId,
      statuses: statuses.join(',')
    })
    const response = await requestJson<{ ok: boolean; interactions: AgentSessionInteraction[] }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/interactions?${query.toString()}`
    )
    return response.interactions
  },

  async replySessionInteraction(
    agentId: string,
    sessionId: string,
    interactionId: string,
    answer: Record<string, unknown>
  ): Promise<AgentSessionInteraction> {
    const response = await requestJson<{ ok: boolean; interaction: AgentSessionInteraction }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/interactions/${encodeURIComponent(interactionId)}/reply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, answer })
      }
    )
    return response.interaction
  },

  async rejectSessionInteraction(
    agentId: string,
    sessionId: string,
    interactionId: string
  ): Promise<AgentSessionInteraction> {
    const response = await requestJson<{ ok: boolean; interaction: AgentSessionInteraction }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/interactions/${encodeURIComponent(interactionId)}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      }
    )
    return response.interaction
  },

  async updateProtocolState(
    agentId: string,
    sessionId: string,
    messageId: number,
    protocolState: Record<string, unknown> | null
  ): Promise<void> {
    await requestJson<{ ok: boolean; messageId: number }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/messages/${messageId}/protocol-state`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, protocolState })
      }
    )
  },

  async decidePlan(
    agentId: string,
    sessionId: string,
    decision: 'approve' | 'revise',
    planId?: string
  ): Promise<DecidePlanResponse> {
    const response = await requestJson<{ ok: boolean; session: AgentSessionListItem; plan: DecidePlanResponse['plan'] }>(
      `${AGENT_API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/plan/decision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, decision, planId })
      }
    )
    return {
      session: response.session,
      plan: response.plan
    }
  },

  async getWorkspace(agentId: string): Promise<AgentWorkspacePayload> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; workspace: AgentWorkspacePayload }>(
      `${AGENT_API_BASE}/agent/workspace?${query.toString()}`
    )
    return response.workspace
  },

  async getSessionWorkspace(agentId: string, sessionId: string): Promise<AgentWorkspacePayload> {
    void sessionId
    return this.getWorkspace(agentId)
  },

  async replaceSessionWorkspace(agentId: string): Promise<AgentWorkspacePayload> {
    return this.getWorkspace(agentId)
  },

  async runStream(
    request: AgentRunRequest,
    onEvent: (event: AgentStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<AgentRunResult> {
    const response = await fetch(`${AGENT_API_BASE}/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      credentials: 'include',
      signal
    })

    if (!response.ok) {
      const payload = await readErrorPayload(response)
      throw createApiError(payload.error || `HTTP ${response.status}`, {
        code: payload.code,
        path: payload.path,
        status: response.status
      })
    }
    if (!response.body) {
      throw new Error('No response stream from agent backend')
    }

    let result: AgentRunResult | null = null
    for await (const event of parseNdjson<AgentStreamEvent>(response.body)) {
      onEvent(event)
      if (event.type === 'run.completed') {
        result = event.result
      }
    }

    if (!result) {
      throw new Error('Agent stream ended without terminal result')
    }

    return result
  },

  async cancelRun(runId: string): Promise<AgentRunCancelResponse> {
    return requestJson<AgentRunCancelResponse>(
      `${AGENT_API_BASE}/agent/runs/${encodeURIComponent(runId)}/cancel`,
      {
        method: 'POST'
      }
    )
  },

  async uploadFile(
    agentId: string,
    file: File,
    overwrite = false,
    relativePath?: string
  ): Promise<UploadedFile> {
    const body = new FormData()
    body.append('file', file)
    if (relativePath?.trim()) {
      body.append('relativePath', relativePath.trim())
    }
    const query = new URLSearchParams({
      agentId,
      ...(overwrite ? { overwrite: 'true' } : {})
    })
    const response = await fetch(`${AGENT_API_BASE}/files/upload?${query.toString()}`, {
      method: 'POST',
      body,
      credentials: 'include'
    })
    const payload = await response.json() as UploadedFile & {
      error?: string
      code?: string
      path?: string
    }
    if (!response.ok) {
      throw createApiError(payload.error || `HTTP ${response.status}`, {
        code: payload.code,
        path: payload.path,
        status: response.status
      })
    }
    return payload
  },

  async openWorkspaceFile(fileKey: string): Promise<WorkspaceFileDescriptor> {
    const response = await requestJson<{ ok: boolean; file: WorkspaceFileDescriptor }>(
      `${AGENT_API_BASE}/files/${encodeURIComponent(fileKey)}`
    )
    return response.file
  },

  async saveWorkspaceFile(
    fileKey: string,
    payload: {
      content: string
      mode: WorkspaceEditorMode
      mmlMetadata?: WorkspaceMmlMetadata | null
    }
  ): Promise<WorkspaceFileDescriptor> {
    const response = await requestJson<{ ok: boolean; file: WorkspaceFileDescriptor }>(
      `${AGENT_API_BASE}/files/${encodeURIComponent(fileKey)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    return response.file
  },

  async renameWorkspaceFile(agentId: string, fileKey: string, fileName: string): Promise<WorkspaceFileDescriptor> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; file: WorkspaceFileDescriptor }>(
      `${AGENT_API_BASE}/files/${encodeURIComponent(fileKey)}/rename?${query.toString()}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      }
    )
    return response.file
  },

  async createProjectEntry(
    agentId: string,
    payload: {
      kind: 'folder' | 'txt' | 'md'
      fileName: string
      parentPath?: string
    }
  ): Promise<WorkspaceFileDescriptor | ProjectFolderDescriptor> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{
      ok: boolean
      file?: WorkspaceFileDescriptor
      entry?: ProjectFolderDescriptor
    }>(`${AGENT_API_BASE}/files/project?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (response.file) return response.file
    if (response.entry) return response.entry
    throw new Error('Missing created project entry')
  },

  async renameProjectFolder(agentId: string, folderKey: string, fileName: string): Promise<ProjectFolderDescriptor> {
    const query = new URLSearchParams({ agentId })
    const response = await requestJson<{ ok: boolean; entry: ProjectFolderDescriptor }>(
      `${AGENT_API_BASE}/files/project/folders/${encodeURIComponent(folderKey)}/rename?${query.toString()}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      }
    )
    return response.entry
  },

  async deleteWorkspaceFile(agentId: string, fileKey: string): Promise<void> {
    const query = new URLSearchParams({ agentId })
    await requestJson<{ ok: boolean; fileKey: string }>(
      `${AGENT_API_BASE}/files/${encodeURIComponent(fileKey)}?${query.toString()}`,
      {
        method: 'DELETE'
      }
    )
  },

  async downloadWorkspaceFile(agentId: string, fileKey: string): Promise<{ blob: Blob; fileName: string }> {
    const query = new URLSearchParams({ agentId })
    const response = await requestBlob(
      `${AGENT_API_BASE}/files/${encodeURIComponent(fileKey)}/download?${query.toString()}`
    )
    return {
      blob: response.blob,
      fileName: extractDownloadFileName(response.headers)
    }
  },

  async listManagedSkills(): Promise<AdminSkillsListPayload> {
    const response = await requestJson<{ ok: boolean; skills: ManagedSkillRecord[]; agents: AgentCatalogSummary[] }>(
      `${AGENT_API_BASE}/admin/skills`
    )
    return {
      skills: response.skills,
      agents: response.agents
    }
  },

  async importManagedSkills(skillIds?: string[]): Promise<ManagedSkillRecord[]> {
    const response = await requestJson<{ ok: boolean; skills: ManagedSkillRecord[] }>(
      `${AGENT_API_BASE}/admin/skills/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds
        })
      }
    )
    return response.skills
  },

  async updateManagedSkill(skillId: string, payload: ManagedSkillUpdateRequest): Promise<ManagedSkillRecord> {
    const response = await requestJson<{ ok: boolean; skill: ManagedSkillRecord }>(
      `${AGENT_API_BASE}/admin/skills/${encodeURIComponent(skillId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    return response.skill
  },

  async uploadManagedSkill(file: File, overwrite = false): Promise<UploadManagedSkillResult> {
    const formData = new FormData()
    formData.append('file', file)
    const query = new URLSearchParams(overwrite ? { overwrite: 'true' } : {})
    const suffix = query.toString() ? `?${query.toString()}` : ''
    const response = await fetch(`${AGENT_API_BASE}/admin/skills/upload${suffix}`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    if (!response.ok) {
      const payload = await readErrorPayload(response)
      throw createApiError(payload.error || `HTTP ${response.status}`, {
        code: payload.code,
        path: payload.path,
        conflict: payload.conflict,
        issues: payload.issues,
        status: response.status
      })
    }
    return await response.json() as UploadManagedSkillResult
  },

  async deleteManagedSkill(skillId: string): Promise<void> {
    await requestJson<{ ok: boolean; skillId: string }>(
      `${AGENT_API_BASE}/admin/skills/${encodeURIComponent(skillId)}?confirm=true`,
      {
        method: 'DELETE'
      }
    )
  }
}
