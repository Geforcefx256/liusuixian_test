import { describe, expect, it, vi } from 'vitest'
import { RuntimeLogDispatcher } from './dispatcher.js'
import type { RuntimeLogEntry, RuntimeLogSink } from './types.js'

function createEntry(overrides: Partial<RuntimeLogEntry> = {}): RuntimeLogEntry {
  return {
    id: overrides.id ?? 'entry-1',
    timestamp: overrides.timestamp ?? '2026-03-24T12:00:00.000Z',
    level: overrides.level ?? 'info',
    category: overrides.category ?? 'runtime',
    component: overrides.component ?? 'entrypoint',
    message: overrides.message ?? 'test'
  }
}

describe('RuntimeLogDispatcher', () => {
  it('fans out appended entries to attached sinks', () => {
    const dispatcher = new RuntimeLogDispatcher()
    const sink: RuntimeLogSink = {
      append: vi.fn()
    }

    dispatcher.attachSink(sink)
    dispatcher.append(createEntry())

    expect(sink.append).toHaveBeenCalledWith(createEntry())
  })

  it('closes attached sinks during shutdown', async () => {
    const dispatcher = new RuntimeLogDispatcher()
    const close = vi.fn(async () => {})
    dispatcher.attachSink({
      append: vi.fn(),
      close
    })

    await dispatcher.closeSinks()

    expect(close).toHaveBeenCalledOnce()
  })
})
