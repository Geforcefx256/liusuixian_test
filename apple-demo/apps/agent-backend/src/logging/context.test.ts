import { describe, expect, it } from 'vitest'
import { getLogContext, runWithLogContext } from './context.js'

describe('log context', () => {
  it('exposes scoped runtime log context inside async work', async () => {
    const observed = await runWithLogContext({
      userId: 1,
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      runId: 'run-1',
      turnId: 'turn-1'
    }, async () => {
      await Promise.resolve()
      return getLogContext()
    })

    expect(observed).toEqual({
      userId: 1,
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      runId: 'run-1',
      turnId: 'turn-1'
    })
  })
})
