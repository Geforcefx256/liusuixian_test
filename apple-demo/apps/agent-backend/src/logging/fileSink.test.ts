import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { DailyCategoryJsonlFileSink } from './fileSink.js'
import type { RuntimeLogEntry } from './types.js'

const TEMP_DIR_PREFIX = 'agent-backend-logging-'
const BASE_TIMESTAMP = '2026-03-24T12:00:00.000Z'
const NEXT_DAY_TIMESTAMP = '2026-03-25T12:00:00.000Z'

function createEntry(params: Partial<RuntimeLogEntry> = {}): RuntimeLogEntry {
  return {
    id: params.id ?? 'entry-1',
    timestamp: params.timestamp ?? BASE_TIMESTAMP,
    level: params.level ?? 'info',
    category: params.category ?? 'runtime',
    component: params.component ?? 'entrypoint',
    message: params.message ?? 'test',
    agentId: params.agentId ?? 'workspace-agent',
    sessionId: params.sessionId ?? 'session-1',
    runId: params.runId ?? 'run-1',
    turnId: params.turnId ?? 'turn-1',
    data: params.data
  }
}

describe('DailyCategoryJsonlFileSink', () => {
  it('writes redacted JSONL entries into date/category files', async () => {
    const directory = createTempDirectory()
    const sink = new DailyCategoryJsonlFileSink({ directory })

    sink.append(createEntry({
      message: '{"authorization":"Bearer abc","safe":"ok"}\nAuthorization: Bearer xyz',
      data: {
        token: 'secret-token',
        nested: {
          authorization: 'Bearer abc',
          safe: 'ok'
        }
      }
    }))
    await sink.close()

    const logEntry = readSingleLog(directory, '2026-03-24', 'runtime')
    const data = getRecord(logEntry.data)
    const nested = getRecord(data.nested)
    expect(logEntry.runId).toBe('run-1')
    expect(logEntry.turnId).toBe('turn-1')
    expect(logEntry.message).toContain('[REDACTED]')
    expect(data.token).toBe('[REDACTED]')
    expect(nested.authorization).toBe('[REDACTED]')
  })

  it('switches files when date or category changes', async () => {
    const directory = createTempDirectory()
    const sink = new DailyCategoryJsonlFileSink({ directory })

    sink.append(createEntry({ id: 'runtime-day-1', timestamp: BASE_TIMESTAMP, category: 'runtime' }))
    sink.append(createEntry({ id: 'model-day-2', timestamp: NEXT_DAY_TIMESTAMP, category: 'model' }))
    await sink.close()

    expect(readSingleLog(directory, '2026-03-24', 'runtime').id).toBe('runtime-day-1')
    expect(readSingleLog(directory, '2026-03-25', 'model').id).toBe('model-day-2')
  })

  it('throws when the configured directory points to a file path', () => {
    const directory = createTempDirectory()
    const invalidDirectory = join(directory, 'blocked-path')
    writeFileSync(invalidDirectory, 'not-a-directory', 'utf8')
    const sink = new DailyCategoryJsonlFileSink({ directory: invalidDirectory })

    expect(() => sink.append(createEntry())).toThrow()
  })

  it('does not create files when no entry is written', () => {
    const directory = createTempDirectory()

    expect(existsSync(join(directory, '2026-03-24', 'runtime.jsonl'))).toBe(false)
  })
})

function createTempDirectory(): string {
  return mkdtempSync(join(tmpdir(), TEMP_DIR_PREFIX))
}

function readSingleLog(directory: string, date: string, category: string): Record<string, unknown> {
  const filePath = join(directory, date, `${category}.jsonl`)
  const content = readFileSync(filePath, 'utf8').trim()
  return JSON.parse(content) as Record<string, unknown>
}

function getRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>
}
