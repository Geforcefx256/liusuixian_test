import { afterEach, describe, expect, it } from 'vitest'

import { recordTimelineEvent } from './timeline.js'
import { attachRuntimeLogSink, resetRuntimeLoggingForTests, type RuntimeLogEntry, type RuntimeLogSink } from './index.js'

class CollectingSink implements RuntimeLogSink {
  readonly entries: RuntimeLogEntry[] = []

  append(entry: RuntimeLogEntry): void {
    this.entries.push(entry)
  }
}

describe('recordTimelineEvent', () => {
  afterEach(() => {
    resetRuntimeLoggingForTests()
  })

  it('logs awaiting-interaction completion as a warning with pause wording', () => {
    const sink = new CollectingSink()
    attachRuntimeLogSink(sink)

    recordTimelineEvent({
      type: 'run.completed',
      runId: 'run-1',
      status: 'awaiting-interaction',
      result: {
        runId: 'run-1',
        sessionId: 'session-1',
        agentId: 'workspace-agent',
        output: {
          kind: 'awaiting-interaction',
          text: '需要你的输入后才能继续。'
        },
        text: '需要你的输入后才能继续。',
        completedAt: Date.now()
      },
      endedAt: Date.now()
    })

    expect(sink.entries).toHaveLength(1)
    expect(sink.entries[0]).toEqual(expect.objectContaining({
      level: 'warn',
      component: 'run.result',
      message: '执行暂停，等待用户输入。'
    }))
  })
})
