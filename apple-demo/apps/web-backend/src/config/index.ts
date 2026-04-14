import fs from 'node:fs'
import path from 'node:path'

import { getServiceRoot } from './runtimePaths.js'

export interface HttpsConfig {
  enabled: boolean
  key: string
  cert: string
}

export interface ServerConfig {
  port: number
  host: string
  https: HttpsConfig
}

export interface DatabaseConfig {
  sqlite: {
    dataDir: string
  }
}

export interface MmlRulesConfig {
  sourceDir: string
  dbPath: string
  importOnStartup: boolean
  failOnStartupImportError: boolean
}

export interface SameOriginProtectionConfig {
  enabled: boolean
  allowedOrigins: string[]
}

export interface OAuthConfig {
  providerCode: string
  authorizeUrl: string
  tokenUrl: string
  refreshUrl: string
  userinfoUrl: string
  logoutUrl: string
  logoutRedirectUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scope: string
  tokenEncryptionKey: string
  enableLogs: boolean
}

export type AuthModeSetting = 'local' | 'oauth'

export interface AuthConfig {
  mode: AuthModeSetting
  oauth: OAuthConfig
  refreshWindowMs: number
  sameOriginProtection: SameOriginProtectionConfig
}

export interface AppConfig {
  server: ServerConfig
  database: DatabaseConfig
  auth: AuthConfig
  mmlRules: MmlRulesConfig
}

const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 3200,
    host: '127.0.0.1',
    https: {
      enabled: false,
      key: './certs/key.pem',
      cert: './certs/cert.pem'
    }
  },
  database: {
    sqlite: {
      dataDir: './SQLite/data'
    }
  },
  mmlRules: {
    sourceDir: './data/mml-rules',
    dbPath: './data/mml-rules.db',
    importOnStartup: true,
    failOnStartupImportError: false
  },
  auth: {
    mode: 'local',
    oauth: {
      providerCode: 'default',
      authorizeUrl: '',
      tokenUrl: '',
      refreshUrl: '',
      userinfoUrl: '',
      logoutUrl: '',
      logoutRedirectUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: 'http://localhost:5175',
      scope: 'openid profile email',
      tokenEncryptionKey: '',
      enableLogs: false
    },
    refreshWindowMs: 5 * 60 * 1000,
    sameOriginProtection: {
      enabled: true,
      allowedOrigins: ['http://localhost:5175']
    }
  }
}

const CONFIG_PATH = path.join(getServiceRoot(), 'config.json')

export interface WebBackendConfigLoadDiagnostics {
  configPath: string
  configSource: 'config.json' | 'defaults'
  serviceRoot: string
  hostSource: 'env:HOST' | 'config.json' | 'defaults'
  portSource: 'env:PORT' | 'config.json' | 'defaults'
}

export interface WebBackendStartupConfigDiagnostics {
  serviceRoot: string
  configPath: string
  configSource: WebBackendConfigLoadDiagnostics['configSource']
  hostSource: WebBackendConfigLoadDiagnostics['hostSource']
  portSource: WebBackendConfigLoadDiagnostics['portSource']
  server: {
    host: string
    port: number
    httpsEnabled: boolean
    httpsKeyPath: string
    httpsCertPath: string
  }
  sqliteDataPath: string
  mmlRules: MmlRulesConfig
  auth: {
    mode: AuthModeSetting
    refreshWindowMs: number
    sameOriginProtectionEnabled: boolean
    allowedOrigins: string[]
    oauthLogsEnabled: boolean
    oauthClientConfigured: boolean
    oauthTokenEncryptionKeyConfigured: boolean
  }
}

function normalizeAuthModeSetting(mode: unknown): AuthModeSetting {
  switch (mode) {
    case 'oauth':
      return 'oauth'
    case 'local':
    default:
      return 'local'
  }
}

function validateOAuthConfig(mode: AuthModeSetting, auth: AuthConfig): void {
  if (mode === 'local') {
    return
  }

  const requiredOAuthFields: Array<[string, string]> = [
    ['auth.oauth.authorizeUrl', auth.oauth.authorizeUrl],
    ['auth.oauth.tokenUrl', auth.oauth.tokenUrl],
    ['auth.oauth.refreshUrl', auth.oauth.refreshUrl],
    ['auth.oauth.userinfoUrl', auth.oauth.userinfoUrl],
    ['auth.oauth.logoutUrl', auth.oauth.logoutUrl],
    ['auth.oauth.logoutRedirectUrl', auth.oauth.logoutRedirectUrl],
    ['auth.oauth.clientId', auth.oauth.clientId],
    ['auth.oauth.clientSecret', auth.oauth.clientSecret],
    ['auth.oauth.redirectUri', auth.oauth.redirectUri],
    ['auth.oauth.tokenEncryptionKey', auth.oauth.tokenEncryptionKey]
  ]

  const missingFields = requiredOAuthFields
    .filter(([, value]) => !String(value ?? '').trim())
    .map(([name]) => name)

  if (missingFields.length > 0) {
    throw new Error(`auth.mode=oauth requires config values: ${missingFields.join(', ')}`)
  }
}

function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Partial<AppConfig>
    const config: AppConfig = {
      server: {
        ...DEFAULT_CONFIG.server,
        ...parsed.server,
        https: {
          ...DEFAULT_CONFIG.server.https,
          ...parsed.server?.https
        }
      },
      database: {
        sqlite: {
          ...DEFAULT_CONFIG.database.sqlite,
          ...parsed.database?.sqlite
        }
      },
      mmlRules: {
        ...DEFAULT_CONFIG.mmlRules,
        ...parsed.mmlRules
      },
      auth: {
        mode: normalizeAuthModeSetting(parsed.auth?.mode),
        oauth: {
          ...DEFAULT_CONFIG.auth.oauth,
          ...parsed.auth?.oauth
        },
        refreshWindowMs:
          typeof parsed.auth?.refreshWindowMs === 'number'
            ? parsed.auth.refreshWindowMs
            : DEFAULT_CONFIG.auth.refreshWindowMs,
        sameOriginProtection: {
          ...DEFAULT_CONFIG.auth.sameOriginProtection,
          ...parsed.auth?.sameOriginProtection
        }
      }
    }
    validateOAuthConfig(config.auth.mode, config.auth)
    return config
  } catch (error) {
    console.error('Failed to load apps/web-backend/config.json', error)
    throw error instanceof Error ? error : new Error(String(error))
  }
}

const CONFIG = loadConfig()
let mmlRulesConfigOverride: MmlRulesConfig | null = null

function resolveAbsolutePath(targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath
  }
  return path.join(getServiceRoot(), targetPath)
}

export function getAppConfig(): AppConfig {
  return CONFIG
}

export function getConfigLoadDiagnostics(): WebBackendConfigLoadDiagnostics {
  const configSource = fs.existsSync(CONFIG_PATH) ? 'config.json' : 'defaults'
  return {
    configPath: CONFIG_PATH,
    configSource,
    serviceRoot: getServiceRoot(),
    hostSource: process.env.HOST ? 'env:HOST' : configSource,
    portSource: process.env.PORT ? 'env:PORT' : configSource
  }
}

export function getMmlRulesConfig(): MmlRulesConfig {
  const config = mmlRulesConfigOverride ?? CONFIG.mmlRules
  return {
    ...config,
    sourceDir: resolveAbsolutePath(config.sourceDir),
    dbPath: resolveAbsolutePath(config.dbPath)
  }
}

export function __setMmlRulesConfigForTests(config: MmlRulesConfig): void {
  mmlRulesConfigOverride = { ...config }
}

export function __resetMmlRulesConfigForTests(): void {
  mmlRulesConfigOverride = null
}

export const SERVER_CONFIG = {
  port: Number(process.env.PORT || CONFIG.server.port),
  host: process.env.HOST || CONFIG.server.host,
  https: {
    enabled: CONFIG.server.https.enabled,
    key: resolveAbsolutePath(CONFIG.server.https.key),
    cert: resolveAbsolutePath(CONFIG.server.https.cert)
  }
}

export const SQLITE_DATA_PATH =
  process.env.WEB_BACKEND_SQLITE_DATA_DIR
    ? resolveAbsolutePath(process.env.WEB_BACKEND_SQLITE_DATA_DIR)
    : resolveAbsolutePath(CONFIG.database.sqlite.dataDir)

export function getWebBackendStartupConfigDiagnostics(): WebBackendStartupConfigDiagnostics {
  const loadDiagnostics = getConfigLoadDiagnostics()
  const mmlRules = getMmlRulesConfig()
  return {
    serviceRoot: loadDiagnostics.serviceRoot,
    configPath: loadDiagnostics.configPath,
    configSource: loadDiagnostics.configSource,
    hostSource: loadDiagnostics.hostSource,
    portSource: loadDiagnostics.portSource,
    server: {
      host: SERVER_CONFIG.host,
      port: SERVER_CONFIG.port,
      httpsEnabled: SERVER_CONFIG.https.enabled,
      httpsKeyPath: SERVER_CONFIG.https.key,
      httpsCertPath: SERVER_CONFIG.https.cert
    },
    sqliteDataPath: SQLITE_DATA_PATH,
    mmlRules,
    auth: {
      mode: CONFIG.auth.mode,
      refreshWindowMs: CONFIG.auth.refreshWindowMs,
      sameOriginProtectionEnabled: CONFIG.auth.sameOriginProtection.enabled,
      allowedOrigins: [...CONFIG.auth.sameOriginProtection.allowedOrigins],
      oauthLogsEnabled: CONFIG.auth.oauth.enableLogs,
      oauthClientConfigured: Boolean(
        CONFIG.auth.oauth.clientId
        && CONFIG.auth.oauth.clientSecret
        && CONFIG.auth.oauth.authorizeUrl
        && CONFIG.auth.oauth.tokenUrl
      ),
      oauthTokenEncryptionKeyConfigured: Boolean(CONFIG.auth.oauth.tokenEncryptionKey)
    }
  }
}
