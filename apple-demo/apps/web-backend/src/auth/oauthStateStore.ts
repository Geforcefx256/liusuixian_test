import { randomUUID } from 'node:crypto'

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000
const oauthStates = new Map<string, number>()

function cleanExpiredStates(now: number): void {
  for (const [state, expiresAt] of oauthStates) {
    if (expiresAt <= now) {
      oauthStates.delete(state)
    }
  }
}

export function issueOAuthState(): string {
  const state = randomUUID()
  oauthStates.set(state, Date.now() + DEFAULT_STATE_TTL_MS)
  cleanExpiredStates(Date.now())
  return state
}

export function consumeOAuthState(state: string): boolean {
  cleanExpiredStates(Date.now())
  if (!oauthStates.has(state)) {
    return false
  }
  oauthStates.delete(state)
  return true
}

export function resetOAuthStateStore(): void {
  oauthStates.clear()
}
