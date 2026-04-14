import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { redactRuntimeLogEntry } from './redaction.js'
import type { RuntimeLogEntry, RuntimeLogSink } from './types.js'

const FILE_EXTENSION = 'jsonl'

export interface DailyCategoryJsonlFileSinkOptions {
  directory: string
  redactSensitive?: boolean
}

export class DailyCategoryJsonlFileSink implements RuntimeLogSink {
  private readonly directory: string
  private readonly redactSensitive: boolean
  private closed = false

  constructor(options: DailyCategoryJsonlFileSinkOptions) {
    this.directory = options.directory
    this.redactSensitive = options.redactSensitive ?? true
  }

  append(entry: RuntimeLogEntry): void {
    if (this.closed) {
      throw new Error('DailyCategoryJsonlFileSink is closed.')
    }
    const payload = this.redactSensitive ? redactRuntimeLogEntry(entry) : entry
    const targetDate = formatLocalDate(entry.timestamp)
    const targetDirectory = join(this.directory, targetDate)
    const filePath = join(targetDirectory, `${entry.category}.${FILE_EXTENSION}`)
    mkdirSync(targetDirectory, { recursive: true })
    appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8')
  }

  close(): void {
    this.closed = true
  }
}

function formatLocalDate(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}
