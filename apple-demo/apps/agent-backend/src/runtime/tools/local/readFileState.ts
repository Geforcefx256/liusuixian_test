export interface ReadFileStateEntry {
  readonly absolutePath: string
  readonly relativePath: string
  readonly mtimeMs: number
}

export class ReadFileStateMap {
  private readonly entriesBySession = new Map<string, Map<string, ReadFileStateEntry>>()

  record(sessionKey: string, entry: Readonly<ReadFileStateEntry>): void {
    const normalizedSessionKey = normalizeSessionKey(sessionKey)
    if (!normalizedSessionKey) {
      return
    }

    const sessionEntries = this.entriesBySession.get(normalizedSessionKey) ?? new Map<string, ReadFileStateEntry>()
    sessionEntries.set(entry.absolutePath, { ...entry })
    this.entriesBySession.set(normalizedSessionKey, sessionEntries)
  }

  get(sessionKey: string, absolutePath: string): ReadFileStateEntry | undefined {
    const normalizedSessionKey = normalizeSessionKey(sessionKey)
    if (!normalizedSessionKey) {
      return undefined
    }

    const entry = this.entriesBySession.get(normalizedSessionKey)?.get(absolutePath)
    return entry ? { ...entry } : undefined
  }

  clearSession(sessionKey: string): void {
    const normalizedSessionKey = normalizeSessionKey(sessionKey)
    if (!normalizedSessionKey) {
      return
    }
    this.entriesBySession.delete(normalizedSessionKey)
  }
}

function normalizeSessionKey(sessionKey: string): string {
  return typeof sessionKey === 'string' ? sessionKey.trim() : ''
}
