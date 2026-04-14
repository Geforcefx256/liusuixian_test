import type { RuntimeLogSink } from './types.js'
import { runtimeLogDispatcher } from './runtime.js'

export { createLogger, appendRuntimeLog } from './logger.js'
export { recordTimelineEvent } from './timeline.js'
export { runWithLogContext, getLogContext } from './context.js'
export { DailyCategoryJsonlFileSink } from './fileSink.js'
export { runtimeLogDispatcher } from './runtime.js'
export * from './types.js'

export function attachRuntimeLogSink(sink: RuntimeLogSink): () => void {
  return runtimeLogDispatcher.attachSink(sink)
}

export async function closeRuntimeLogSinks(): Promise<void> {
  await runtimeLogDispatcher.closeSinks()
}

export function resetRuntimeLoggingForTests(): void {
  runtimeLogDispatcher.resetForTests()
}
