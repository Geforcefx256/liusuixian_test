import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'

import { __resetOAuthProviderConfigForTests, __setOAuthProviderConfigForTests } from '../src/auth/config.js'
import { fetchUserinfo } from '../src/auth/oauthClient.js'

vi.mock('axios')

describe('oauthClient.fetchUserinfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetOAuthProviderConfigForTests()
    __setOAuthProviderConfigForTests({
      clientId: 'client-1',
      scope: 'openid profile email',
      userinfoUrl: 'https://sso.example.com/userinfo'
    })
  })

  it('keeps uuid empty when provider payload omits uuid and posts provider-form params', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        sub: 'sub-123',
        preferred_username: 'alice',
        name: 'Alice',
        email: 'alice@example.com'
      }
    } as never)

    const result = await fetchUserinfo({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: 'Bearer'
    })

    expect(result).toMatchObject({
      uuid: '',
      loginName: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com'
    })
    expect(axios.post).toHaveBeenCalledWith(
      'https://sso.example.com/userinfo',
      'client_id=client-1&access_token=access-token&scope=openid+profile+email',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    )
  })

  it('maps alternate account and profile fields without coercing non-uuid identifiers into uuid', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        user_id: 42,
        account: 'bob',
        nickname: 'Bob',
        picture: 'https://example.com/avatar.png',
        phone_number: '13800138000'
      }
    } as never)

    const result = await fetchUserinfo({
      accessToken: 'access-token',
      refreshToken: null,
      expiresIn: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: 'Bearer'
    })

    expect(result).toMatchObject({
      uuid: '',
      loginName: 'bob',
      displayName: 'Bob',
      avatarUrl: 'https://example.com/avatar.png',
      phone: '13800138000'
    })
  })

  it('keeps uid separate from loginName when sparse internal sso payloads omit login_name fields', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        uuid: 'uuid-1',
        uid: 'x3008892398'
      }
    } as never)

    const result = await fetchUserinfo({
      accessToken: 'access-token',
      refreshToken: null,
      expiresIn: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: 'Bearer'
    })

    expect(result).toMatchObject({
      uuid: 'uuid-1',
      uid: 'x3008892398',
      loginName: null,
      displayName: null,
      email: null
    })
  })
})
