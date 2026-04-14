import { describe, expect, it } from 'vitest'
import { parseAgentRunRequest } from '../src/routes/agent.js'

describe('parseAgentRunRequest', () => {
  it('preserves invocationContext on parsed request', () => {
    const parsed = parseAgentRunRequest({
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      userId: 1,
      input: '继续生成 5 条',
      invocationContext: {
        selection: {
          rows: [
            { VN: 'ipfarm_01_UPF01' },
            { VN: 'ipfarm_02_UPF01' }
          ],
          columns: ['VN']
        },
        activeSheet: {
          sheetName: 'VLR',
          columnName: 'VN'
        },
        activeFile: {
          path: 'uploads/active.mml',
          fileName: 'active.mml',
          source: 'upload',
          writable: false
        }
      }
    }, 1)

    expect(parsed.error).toBeUndefined()
    expect(parsed.request?.invocationContext).toEqual({
      selection: {
        rows: [
          { VN: 'ipfarm_01_UPF01' },
          { VN: 'ipfarm_02_UPF01' }
        ],
        columns: ['VN']
      },
      activeSheet: {
        sheetName: 'VLR',
        columnName: 'VN'
      },
      activeFile: {
        path: 'uploads/active.mml',
        fileName: 'active.mml',
        source: 'upload',
        writable: false
      }
    })
  })

  it('preserves a client supplied runId when provided', () => {
    const parsed = parseAgentRunRequest({
      runId: 'run-from-client',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: '继续生成 5 条'
    }, 1)

    expect(parsed.error).toBeUndefined()
    expect(parsed.request?.runId).toBe('run-from-client')
  })

  it('rejects invalid invocationContext activeFile', () => {
    const parsed = parseAgentRunRequest({
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: '继续处理',
      invocationContext: {
        activeFile: {
          path: 'uploads/current.csv'
        }
      }
    }, 1)

    expect(parsed.request).toBeUndefined()
    expect(parsed.error).toBe('Invalid invocationContext.activeFile')
  })

  it('parses editContext on run requests', () => {
    const parsed = parseAgentRunRequest({
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: '改一下最后一条消息',
      editContext: {
        messageId: 42
      }
    }, 1)

    expect(parsed.error).toBeUndefined()
    expect(parsed.request?.editContext).toEqual({ messageId: 42 })
  })

  it('rejects editContext when combined with continuation', () => {
    const parsed = parseAgentRunRequest({
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: '改一下',
      continuation: {
        interactionId: 'interaction-1'
      },
      editContext: {
        messageId: 42
      }
    }, 1)

    expect(parsed.request).toBeUndefined()
    expect(parsed.error).toBe('editContext cannot be combined with continuation')
  })
})
