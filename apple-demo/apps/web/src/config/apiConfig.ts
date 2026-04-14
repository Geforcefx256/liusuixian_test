function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

interface AppPublicConfig {
  webBackendOrigin?: string
  agentBackendOrigin?: string
}

declare global {
  interface Window {
    __APP_PUBLIC_CONFIG__?: AppPublicConfig
  }
}

function readRuntimeConfig(): AppPublicConfig {
  if (typeof window === 'undefined') {
    return {}
  }
  return window.__APP_PUBLIC_CONFIG__ || {}
}

function joinApiBase(origin: string, path: string): string {
  return `${trimTrailingSlash(origin)}${path}`
}

export function getWebApiBase(): string {
  const runtimeConfig = readRuntimeConfig()
  if (runtimeConfig.webBackendOrigin) {
    return joinApiBase(runtimeConfig.webBackendOrigin, '/web/api')
  }
  const configured = import.meta.env.VITE_WEB_API_BASE_URL
  if (configured) return trimTrailingSlash(configured)
  return '/web/api'
}

export function getAgentApiBase(): string {
  const runtimeConfig = readRuntimeConfig()
  if (runtimeConfig.agentBackendOrigin) {
    return joinApiBase(runtimeConfig.agentBackendOrigin, '/agent/api')
  }
  const configured = import.meta.env.VITE_AGENT_API_BASE_URL
  if (configured) return trimTrailingSlash(configured)
  return '/agent/api'
}
