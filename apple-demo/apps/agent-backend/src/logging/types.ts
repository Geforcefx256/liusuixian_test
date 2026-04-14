export type RuntimeLogLevel = 'info' | 'warn' | 'error'

export type RuntimeLogCategory = 'runtime' | 'model' | 'tool'

export interface RuntimeLogContext {
  userId?: number
  agentId?: string
  sessionId?: string
  runId?: string
  turnId?: string
}

export interface RuntimeLogEntry extends RuntimeLogContext {
  id: string
  timestamp: string
  level: RuntimeLogLevel
  category: RuntimeLogCategory
  component: string
  message: string
  data?: Record<string, unknown>
}

export interface RuntimeLogWrite {
  message: string
  data?: Record<string, unknown>
  context?: RuntimeLogContext
}

export interface RuntimeLogRecord extends RuntimeLogWrite {
  level: RuntimeLogLevel
  category: RuntimeLogCategory
  component: string
}

export interface RuntimeLogSink {
  append(entry: RuntimeLogEntry): void
  close?(): Promise<void> | void
}

export interface RuntimeLogger {
  info(entry: RuntimeLogWrite): void
  warn(entry: RuntimeLogWrite): void
  error(entry: RuntimeLogWrite): void
}
