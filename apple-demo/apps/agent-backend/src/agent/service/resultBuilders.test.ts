import { describe, expect, it } from 'vitest'
import { buildSuccessResult } from './resultBuilders.js'
import type { AgentRunRequest } from '../types.js'

function createRequest(): AgentRunRequest {
  return {
    runId: 'run-1',
    userId: 1,
    agentId: 'agent-1',
    sessionId: 'session-1',
    input: 'hello'
  }
}

function createExecution(params: {
  text: string
  protocol?: Record<string, unknown>
  structuredOutput?: {
    kind: 'protocol'
    protocol: Record<string, unknown>
  } | {
    kind: 'domain-result'
    domainResult: {
      kind: 'notice' | 'rows_result' | 'sheet_snapshot' | 'artifact_ref'
      data: Record<string, unknown>
    }
  }
  finalOutputMeta?: {
    source: 'assistant' | 'tool'
    toolName?: string
    toolCallId?: string
    structuredHint: 'none' | 'protocol' | 'domain-result'
  }
  skillTriggered?: string
}) {
  return {
    mode: 'llm' as const,
    text: params.text,
    protocol: params.protocol,
    structuredOutput: params.structuredOutput,
    assistantMessageId: 1,
    finalOutputMeta: params.finalOutputMeta,
    skillTriggered: params.skillTriggered
  }
}

describe('buildSuccessResult domain result classification', () => {
  it('keeps invalid JSON-like output as text without throwing', () => {
    const request = createRequest()
    const execution = createExecution({ text: '[{"key":"value"}' })

    expect(() => buildSuccessResult({
      request,
      execution,
      startedAt: Date.now()
    })).not.toThrow()

    const { result } = buildSuccessResult({
      request,
      execution,
      startedAt: Date.now()
    })

    expect(result.output.kind).toBe('text')
    expect(result.output.text).toBe('[{"key":"value"}')
  })

  it('keeps valid but unsupported JSON shape as text', () => {
    const { result } = buildSuccessResult({
      request: createRequest(),
      execution: createExecution({ text: '{"foo":"bar"}' }),
      startedAt: Date.now()
    })

    expect(result.output.kind).toBe('text')
    expect(result.output.text).toBe('{"foo":"bar"}')
  })

  it('upgrades object arrays to rows_result domain output', () => {
    const { result } = buildSuccessResult({
      request: createRequest(),
      execution: createExecution({ text: '[{"col":"a"},{"col":"b"}]' }),
      startedAt: Date.now()
    })

    expect(result.output.kind).toBe('domain-result')
    expect(result.output.domainResult).toEqual({
      kind: 'rows_result',
      data: {
        columns: ['col'],
        rows: [{ col: 'a' }, { col: 'b' }]
      }
    })
  })

  it('strictly parses structured tool outputs marked as domain-result', () => {
    const { result } = buildSuccessResult({
      request: createRequest(),
      execution: createExecution({
        text: '{"kind":"artifact_ref","data":{"fileId":"file-1"}}',
        finalOutputMeta: {
          source: 'tool',
          toolName: 'skill:exec',
          toolCallId: 'tool-1',
          structuredHint: 'domain-result'
        }
      }),
      startedAt: Date.now()
    })

    expect(result.output.kind).toBe('domain-result')
    expect(result.output.domainResult).toEqual({
      kind: 'artifact_ref',
      data: { fileId: 'file-1' }
    })
  })

  it('uses explicit structured domain output without reparsing summary text', () => {
    const { result } = buildSuccessResult({
      request: createRequest(),
      execution: createExecution({
        text: '已生成产物：file-structured。',
        structuredOutput: {
          kind: 'domain-result',
          domainResult: {
            kind: 'artifact_ref',
            data: { fileId: 'file-structured' }
          }
        },
        finalOutputMeta: {
          source: 'tool',
          toolName: 'skill:exec',
          toolCallId: 'tool-structured',
          structuredHint: 'domain-result'
        }
      }),
      startedAt: Date.now()
    })

    expect(result.output.kind).toBe('domain-result')
    expect(result.output.text).toBe('已生成产物：file-structured。')
    expect(result.output.domainResult).toEqual({
      kind: 'artifact_ref',
      data: { fileId: 'file-structured' }
    })
  })

  it('keeps non-structured tool output as text when no domain-result hint exists', () => {
    const { result } = buildSuccessResult({
      request: createRequest(),
      execution: createExecution({
        text: '{"kind":"notice","data":{"message":"tool output should stay text"}}',
        finalOutputMeta: {
          source: 'tool',
          toolName: 'local:read_file',
          toolCallId: 'tool-2',
          structuredHint: 'none'
        }
      }),
      startedAt: Date.now()
    })

    expect(result.output.kind).toBe('text')
  })

  it('preserves the triggered skill name on successful results', () => {
    const { result } = buildSuccessResult({
      request: createRequest(),
      execution: createExecution({
        text: 'done',
        skillTriggered: 'openspec-apply-change'
      }),
      startedAt: Date.now()
    })

    expect(result.skillTriggered).toBe('openspec-apply-change')
    expect(result.skillMode).toBe('implicit')
  })
})
