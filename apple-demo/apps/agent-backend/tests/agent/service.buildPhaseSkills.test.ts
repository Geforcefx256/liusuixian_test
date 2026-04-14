import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AgentService } from '../../src/agent/service.js'
import { SQLiteAgentSessionStore } from '../../src/agent/sessionStore.js'
import type { AgentRunRequest } from '../../src/agent/types.js'
import {
  attachRuntimeLogSink,
  resetRuntimeLoggingForTests,
  type RuntimeLogEntry,
  type RuntimeLogSink
} from '../../src/logging/index.js'

const TEST_USER_ID = 1
const WORKSPACE_AGENT_ID = 'workspace-agent'
const APPROVED_SKILL_ID = 'dpi-new-bwm-pcc'
const BLOCKED_SKILL_ID = 'ne-csv-processor'
const LONG_TEXT = 'This is a long skill summary used to force deterministic trimming in executor listing logs. '.repeat(10)

class CollectingSink implements RuntimeLogSink {
  readonly entries: RuntimeLogEntry[] = []

  append(entry: RuntimeLogEntry): void {
    this.entries.push(entry)
  }
}

function captureRuntimeLogs(): RuntimeLogEntry[] {
  const sink = new CollectingSink()
  attachRuntimeLogSink(sink)
  return sink.entries
}

function makeRequest(sessionId: string, input: string): AgentRunRequest {
  return {
    runId: `${sessionId}-${input}`,
    userId: TEST_USER_ID,
    agentId: WORKSPACE_AGENT_ID,
    sessionId,
    input,
    model: {
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'test-key'
    }
  }
}

describe('AgentService build phase approved skill boundary', () => {
  let tempDir = ''
  let sessionStore: SQLiteAgentSessionStore | null = null

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-build-phase-skills-'))
    sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session.db') })
    resetRuntimeLoggingForTests()
  })

  afterEach(async () => {
    resetRuntimeLoggingForTests()
    sessionStore?.close()
    sessionStore = null
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('injects only approved skills into the executor listing and keeps the skill tool description static', async () => {
    if (!sessionStore) {
      throw new Error('Session store not initialized')
    }
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'build-phase-skills')
    await approveTestPlan(sessionStore, session.sessionId, [APPROVED_SKILL_ID])

    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          const skillTool = request.tools.find(tool => tool.id === 'skill:skill')
          const reminderText = request.messages
            .flatMap(message => message.parts)
            .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
            .map(part => part.text)
            .join('\n')
          expect(skillTool).toBeDefined()
          expect(request.systemPrompt).not.toContain('discoveryMode: disabled')
          expect(reminderText).not.toContain('discoveryMode: disabled')
          expect(reminderText).toContain('Available skills for this run:')
          expect(reminderText).toContain('- name:')
          expect(reminderText).not.toContain(BLOCKED_SKILL_ID)
          expect(skillTool?.description).toContain('Load the canonical SKILL.md instructions for an approved skill by name or id.')
          expect(skillTool?.description).not.toContain(APPROVED_SKILL_ID)
          expect(skillTool?.description).not.toContain(BLOCKED_SKILL_ID)
          return {
            text: '只保留已批准的 executor listing',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const result = await service.executeRun(
      makeRequest(session.sessionId, '尝试读取未批准 skill'),
      () => {}
    )

    expect(result.error).toBeUndefined()
    expect(result.text).toBe('只保留已批准的 executor listing')
  })

  it('injects executor listing logs with discovery disabled and deterministic trim events', async () => {
    if (!sessionStore) {
      throw new Error('Session store not initialized')
    }
    const logs = captureRuntimeLogs()
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'build-phase-listing-logs')
    await approveTestPlan(sessionStore, session.sessionId, [APPROVED_SKILL_ID])

    let capturedPrompt = ''
    let capturedReminder = ''
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          capturedPrompt = request.systemPrompt
          capturedReminder = request.messages
            .flatMap(message => message.parts)
            .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
            .map(part => part.text)
            .join('\n')
          return {
            text: 'ok',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const result = await service.executeRun({
      ...makeRequest(session.sessionId, '记录 listing 日志'),
      availableSkills: [{
        id: APPROVED_SKILL_ID,
        name: APPROVED_SKILL_ID,
        description: LONG_TEXT,
        whenToUse: LONG_TEXT,
        instructions: 'Use the governed skill package.',
        sourcePath: join(tempDir, 'skills', `${APPROVED_SKILL_ID}.md`)
      }]
    }, () => {})

    expect(result.error).toBeUndefined()
    expect(capturedPrompt).not.toContain('discoveryMode: disabled')
    expect(capturedReminder).not.toContain('discoveryMode: disabled')
    expect(capturedReminder).toContain(APPROVED_SKILL_ID)
    expect(capturedReminder).toContain('[trimmed]')
    expect(capturedReminder).not.toContain('sourcePath')

    const builtLog = logs.find(entry => entry.message === 'skill_listing_built')
    const trimmedLog = logs.find(entry => entry.message === 'skill_listing_entry_trimmed')
    const injectedLog = logs.find(entry => entry.message === 'skill_listing_injected')

    expect(builtLog?.data).toEqual(expect.objectContaining({
      discoveryMode: 'disabled',
      sourceSkillCount: 1,
      includedSkillCount: 1,
      trimmedSkillCount: 1
    }))
    expect(trimmedLog?.data).toEqual(expect.objectContaining({
      discoveryMode: 'disabled',
      skillId: APPROVED_SKILL_ID
    }))
    expect(injectedLog?.data).toEqual(expect.objectContaining({
      discoveryMode: 'disabled',
      includedSkillCount: 1,
      trimmedSkillCount: 1,
      injectionSurface: 'conversation_message'
    }))
  })
})

async function approveTestPlan(
  sessionStore: SQLiteAgentSessionStore,
  sessionId: string,
  approvedSkillIds: string[]
): Promise<void> {
  const saved = await sessionStore.savePlan({
    userId: TEST_USER_ID,
    agentId: WORKSPACE_AGENT_ID,
    sessionId,
    draft: {
      title: 'Approved test plan',
      summary: 'Use approved skills for execution.',
      goal: 'Run build phase directly in tests.',
      steps: ['Execute the requested action.'],
      approvedSkillIds,
      skillsReasoning: approvedSkillIds.map(skillId => `Approved by test: ${skillId}`),
      risks: [],
      openQuestions: [],
      markdown: '# Approved test plan\n',
      filePath: `plans/agent/${sessionId}/v1-approved-test-plan.md`
    }
  })
  await sessionStore.decidePlan({
    userId: TEST_USER_ID,
    agentId: WORKSPACE_AGENT_ID,
    sessionId,
    decision: 'approve',
    planId: saved.planId
  })
}
