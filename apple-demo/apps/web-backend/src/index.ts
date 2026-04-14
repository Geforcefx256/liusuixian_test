import { closeAllConnections } from './database/connection.js'
import { closeMmlRuleCatalog } from './mmlRules/catalog.js'
import { startServer } from './app.js'
import {
  logWebBackendFatalDiagnostic,
  logWebBackendProcessWarning
} from './startupDiagnostics.js'

void startServer().catch(error => {
  logWebBackendFatalDiagnostic('startup_failed', error)
  shutdown(1)
})

process.on('warning', warning => {
  logWebBackendProcessWarning(warning)
})

process.on('unhandledRejection', reason => {
  logWebBackendFatalDiagnostic('unhandledRejection', reason)
  shutdown(1)
})

process.on('uncaughtException', error => {
  logWebBackendFatalDiagnostic('uncaughtException', error)
  shutdown(1)
})

process.on('SIGINT', () => {
  shutdown(0)
})

process.on('SIGTERM', () => {
  shutdown(0)
})

function shutdown(exitCode: number): void {
  closeMmlRuleCatalog()
  closeAllConnections()
  process.exit(exitCode)
}
