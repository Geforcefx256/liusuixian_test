import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { SkillCatalog } from '../skills/catalog.js'
import { ManagedSkillRegistry } from '../skills/managedRegistry.js'
import { AgentCatalogService } from '../agents/service.js'
import { ChatOrchestrator, buildSkillListingReminderMessage } from './chatOrchestrator.js'
import { AgentLoop } from './agentLoop.js'
import { ProviderClient } from './providerClient.js'
import {
  attachRuntimeLogSink,
  resetRuntimeLoggingForTests,
  type RuntimeLogEntry,
  type RuntimeLogSink
} from '../logging/index.js'

class CollectingSink implements RuntimeLogSink {
  readonly entries: RuntimeLogEntry[] = []

  append(entry: RuntimeLogEntry): void {
    this.entries.push(entry)
  }
}

describe('buildSkillListingReminderMessage', () => {
  let tempDir = ''

  afterEach(async () => {
    resetRuntimeLoggingForTests()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  it('lists canonical skill metadata without synthesized fallback text', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'chat-orchestrator-'))
    const skillCatalog = new SkillCatalog()
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 规划入口',
      displayDescription: 'display 描述'
    })
    const service = new AgentCatalogService(undefined, skillCatalog, registry)
    const executionCatalog = service.getExecutionCatalog('workspace-agent')

    expect(executionCatalog).not.toBeNull()
    if (!executionCatalog) return
    const skill = executionCatalog.skills[0]

    const reminder = buildSkillListingReminderMessage({
      runId: 'run-1',
      userId: 1,
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      executionPhase: 'executor',
      input: 'help',
      availableSkills: executionCatalog.skills
    })

    const reminderText = reminder?.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join('\n')

    expect(reminder?.role).toBe('user')
    expect(reminderText).toContain('Available skills for this run:')
    expect(reminderText).toContain(`- name: ${skill.name}`)
    expect(reminderText).toContain(`description: ${skill.description}`)
    expect(reminderText).toContain('The following skills are available for use with the `skill` tool.')
    expect(reminderText).toContain('Load a skill with the `skill` tool when you need its full SKILL.md content.')
    expect(reminderText).not.toContain('discoveryMode: disabled')
    expect(reminderText).not.toContain('description: -')
    expect(reminderText).not.toContain('DPI 规划入口')
    expect(reminderText).not.toContain('display 描述')
    expect(reminderText).not.toContain('location:')
  })

  it('keeps skill listing out of the system prompt and injects it as a reminder message', async () => {
    const sink = new CollectingSink()
    attachRuntimeLogSink(sink)
    const captured = {
      systemPrompt: '',
      messages: [] as Array<{ role: string; text: string }>
    }

    const orchestrator = new ChatOrchestrator(
      {} as ProviderClient,
      {
        run: async params => {
          captured.systemPrompt = params.systemPrompt
          const messages = await params.messageProvider?.({
            userId: 1,
            agentId: 'workspace-agent',
            sessionId: 'session-1',
            systemPrompt: params.systemPrompt,
            model: params.model,
            messages: [{
              role: 'user',
              parts: [{ type: 'text', text: 'help' }],
              createdAt: 1
            }]
          })
          captured.messages = (messages || []).map(message => ({
            role: message.role,
            text: message.parts
              .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
              .map(part => part.text)
              .join('\n')
          }))
          throw new Error('stop after prompt log')
        }
      } as AgentLoop,
      {
        getInteraction: async () => null,
        getSummary: async () => null
      } as never,
      {
        maxSteps: 1,
        tokenizer: {
          countTokens: text => text.length
        },
        defaultContextWindow: 4096,
        contextConfig: {
          auto: true,
          prune: true,
          summaryMaxTokens: 512,
          logDetail: true
        }
      }
    )

    const executePromise = orchestrator.execute({
      request: {
        runId: 'run-1',
        userId: 1,
        agentId: 'workspace-agent',
        sessionId: 'session-1',
        input: 'help',
        executionPhase: 'executor',
        availableSkills: [{
          id: 'pc-config-guide',
          name: 'pc-config-guide',
          description: '电脑配置指导',
          whenToUse: '当用户需要电脑配置方案时使用',
          instructions: 'skill body'
        }],
        agentDefinition: {
          id: 'workspace-agent',
          name: 'Workspace Agent',
          description: 'Agent description',
          version: '1.0.0',
          instructions: 'Follow the rules.'
        },
        model: {
          provider: 'openai',
          modelName: 'gpt-4o-mini'
        }
      },
      signal: AbortSignal.abort(),
      trace: {
        runId: 'run-1',
        turnId: 'turn-1'
      }
    })

    await expect(executePromise).rejects.toThrow('stop after prompt log')

    const systemPromptLog = sink.entries.find(entry => entry.message === 'system prompt prepared')

    expect(systemPromptLog).toBeDefined()
    expect(systemPromptLog?.data).toEqual(expect.objectContaining({
      chars: expect.any(Number),
      executionPhase: 'executor',
      systemPrompt: expect.stringContaining('# Workspace Agent')
    }))
    expect(String(systemPromptLog?.data?.systemPrompt)).toContain('Follow the rules.')
    expect(String(systemPromptLog?.data?.systemPrompt)).not.toContain('discoveryMode: disabled')
    expect(captured.systemPrompt).not.toContain('pc-config-guide')
    expect(captured.messages).toEqual([
      {
        role: 'user',
        text: 'help'
      },
      {
        role: 'user',
        text: expect.stringContaining('Available skills for this run:')
      }
    ])
    expect(captured.messages[1]?.text).toContain('pc-config-guide')
  })
})
