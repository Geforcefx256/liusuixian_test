import type { RuntimeLogEntry, RuntimeLogSink } from './types.js'

export class RuntimeLogDispatcher {
  private readonly sinks = new Set<RuntimeLogSink>()

  append(entry: RuntimeLogEntry): void {
    for (const sink of this.sinks) {
      sink.append(entry)
    }
  }

  attachSink(sink: RuntimeLogSink): () => void {
    this.sinks.add(sink)
    return () => {
      this.sinks.delete(sink)
    }
  }

  async closeSinks(): Promise<void> {
    const closeTasks = Array.from(this.sinks, sink => sink.close?.())
      .filter((task): task is Promise<void> | void => task !== undefined)
    await Promise.all(closeTasks)
  }

  resetForTests(): void {
    this.sinks.clear()
  }
}
