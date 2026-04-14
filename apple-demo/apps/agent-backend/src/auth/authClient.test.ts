import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchAuthenticatedUser } from './authClient.js'

const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config.json')
const originalConfigContent = readFileSync(configPath, 'utf-8')
const LOCAL_AUTH_BASE_URL = 'http://localhost:3200'

describe('fetchAuthenticatedUser', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    writeFileSync(configPath, originalConfigContent, 'utf-8')
  })

  it('calls the auth me endpoint using auth.baseUrl from config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAuthenticatedUser({ cookieHeader: 'mml_session=session-1' })

    expect(result).toEqual({ userId: 42, roles: [] })
    expect(fetchMock).toHaveBeenCalledWith(`${LOCAL_AUTH_BASE_URL}/web/api/auth/me`, {
      headers: {
        Cookie: 'mml_session=session-1'
      }
    })
  })

  it('normalizes a trailing slash in auth.baseUrl', async () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.auth = { baseUrl: `${LOCAL_AUTH_BASE_URL}/` }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 7
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchAuthenticatedUser({ bearerToken: 'token-2' })

    expect(fetchMock).toHaveBeenCalledWith(`${LOCAL_AUTH_BASE_URL}/web/api/auth/me`, {
      headers: {
        Authorization: 'Bearer token-2'
      }
    })
  })

  it('throws a clear config error when auth.baseUrl is missing', async () => {
    const mutated = JSON.parse(originalConfigContent) as Record<string, unknown>
    mutated.auth = {
      baseUrl: '',
      sameOriginProtection: {
        enabled: true,
        allowedOrigins: []
      }
    }
    writeFileSync(configPath, JSON.stringify(mutated, null, 2), 'utf-8')

    vi.stubGlobal('fetch', vi.fn())

    await expect(fetchAuthenticatedUser({ bearerToken: 'token-3' })).rejects.toThrow(
      'auth.baseUrl is required in apps/agent-backend/config.json for auth integration'
    )
  })

  it('returns normalized role keys from the auth response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 9,
            roles: [
              { roleKey: 'admin' },
              { roleKey: ' editor ' },
              { roleKey: '' },
              {}
            ]
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAuthenticatedUser({ bearerToken: 'token-4' })

    expect(result).toEqual({
      userId: 9,
      roles: ['admin', 'editor']
    })
  })
})
