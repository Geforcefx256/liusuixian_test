import type { AuthModeSetting, OAuthConfig } from '../config/index.js'
import { getAppConfig } from '../config/index.js'

let oauthProviderConfigOverride: Partial<OAuthConfig> | null = null
let authModeOverride: AuthModeSetting | null = null

function normalizeConfig(config: OAuthConfig): OAuthConfig {
  return {
    providerCode: config.providerCode.trim() || 'default',
    authorizeUrl: config.authorizeUrl.trim(),
    tokenUrl: config.tokenUrl.trim(),
    refreshUrl: config.refreshUrl.trim(),
    userinfoUrl: config.userinfoUrl.trim(),
    logoutUrl: config.logoutUrl.trim(),
    logoutRedirectUrl: config.logoutRedirectUrl.trim(),
    clientId: config.clientId.trim(),
    clientSecret: config.clientSecret.trim(),
    redirectUri: config.redirectUri.trim(),
    scope: config.scope.trim() || 'openid profile email',
    tokenEncryptionKey: config.tokenEncryptionKey.trim(),
    enableLogs: Boolean(config.enableLogs)
  }
}

export function getOAuthProviderConfig(): OAuthConfig {
  const merged = {
    ...getAppConfig().auth.oauth,
    ...oauthProviderConfigOverride
  }
  return normalizeConfig(merged)
}

export function getConfiguredAuthMode(): AuthModeSetting {
  return authModeOverride ?? getAppConfig().auth.mode
}

export function isOAuthConfigured(config: OAuthConfig = getOAuthProviderConfig()): boolean {
  return Boolean(
    config.authorizeUrl &&
    config.clientId &&
    config.clientSecret &&
    config.redirectUri &&
    config.tokenUrl &&
    config.refreshUrl &&
    config.userinfoUrl &&
    config.logoutUrl &&
    config.logoutRedirectUrl &&
    config.tokenEncryptionKey
  )
}

export function getOAuthRefreshWindowMs(): number {
  return getAppConfig().auth.refreshWindowMs
}

export function isOAuthLoggingEnabled(): boolean {
  return getOAuthProviderConfig().enableLogs
}

export function isLocalLoginEnabled(mode: AuthModeSetting = getConfiguredAuthMode()): boolean {
  return mode === 'local'
}

export function isOAuthLoginEnabled(
  mode: AuthModeSetting = getConfiguredAuthMode(),
  config: OAuthConfig = getOAuthProviderConfig()
): boolean {
  if (mode !== 'oauth') {
    return false
  }
  return isOAuthConfigured(config)
}

export function __setOAuthProviderConfigForTests(config: Partial<OAuthConfig> | null): void {
  oauthProviderConfigOverride = config
}

export function __resetOAuthProviderConfigForTests(): void {
  oauthProviderConfigOverride = null
}

export function __setAuthModeForTests(mode: AuthModeSetting | null): void {
  authModeOverride = mode
}

export function __resetAuthModeForTests(): void {
  authModeOverride = null
}
