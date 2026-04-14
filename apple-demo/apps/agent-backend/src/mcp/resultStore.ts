export interface StoredMCPResult {
  id: string
  createdAt: number
  payload: unknown
}

export class MCPResultStore {
  private readonly store = new Map<string, StoredMCPResult>()

  put(payload: unknown): StoredMCPResult {
    const id = crypto.randomUUID()
    const entry: StoredMCPResult = {
      id,
      createdAt: Date.now(),
      payload
    }
    this.store.set(id, entry)
    return entry
  }

  get(id: string): StoredMCPResult | null {
    return this.store.get(id) || null
  }
}
