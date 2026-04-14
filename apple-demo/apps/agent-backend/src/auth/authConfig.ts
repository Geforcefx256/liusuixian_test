import { loadConfig } from '../memory/ConfigLoader.js'

const AUTH_CONFIG_PATH = 'apps/agent-backend/config.json'

export function resolveWebBackendBaseUrl(): string {
  const webBackendBaseUrl = loadConfig().auth.baseUrl.trim()
  if (!webBackendBaseUrl) {
    throw new Error(`auth.baseUrl is required in ${AUTH_CONFIG_PATH} for auth integration`)
  }
  return webBackendBaseUrl.replace(/\/$/, '')
}

export const authEndpoints = {
  currentUser(): string {
    return `${resolveWebBackendBaseUrl()}/web/api/auth/me`
  },
} as const

export const webBackendEndpoints = {
  mmlSchema(networkType: string, networkVersion: string): string {
    const params = new URLSearchParams({
      networkType,
      networkVersion
    })
    return `${resolveWebBackendBaseUrl()}/web/api/mml/schema?${params.toString()}`
  }
} as const
