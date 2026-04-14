import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAgentApiBase, getWebApiBase } from './apiConfig'

function setRuntimeConfig(config: Record<string, string>): void {
  window.__APP_PUBLIC_CONFIG__ = config
}

describe('apiConfig', () => {
  afterEach(() => {
    delete window.__APP_PUBLIC_CONFIG__
    vi.unstubAllEnvs()
  })

  it('defaults to same-origin relative api paths', () => {
    expect(getWebApiBase()).toBe('/web/api')
    expect(getAgentApiBase()).toBe('/agent/api')
  })

  it('supports runtime backend origins for host and port only', () => {
    setRuntimeConfig({
      webBackendOrigin: 'https://10.10.10.12:3200/',
      agentBackendOrigin: 'https://10.10.10.12:3100/'
    })

    expect(getWebApiBase()).toBe('https://10.10.10.12:3200/web/api')
    expect(getAgentApiBase()).toBe('https://10.10.10.12:3100/agent/api')
  })

  it('falls back to vite env values when runtime config is absent', () => {
    vi.stubEnv('VITE_WEB_API_BASE_URL', 'https://env.example.com/web/api/')
    vi.stubEnv('VITE_AGENT_API_BASE_URL', 'https://env.example.com/agent/api/')

    expect(getWebApiBase()).toBe('https://env.example.com/web/api')
    expect(getAgentApiBase()).toBe('https://env.example.com/agent/api')
  })
})
