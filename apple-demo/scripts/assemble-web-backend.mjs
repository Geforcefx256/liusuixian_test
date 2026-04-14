import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(__dirname, '..', 'apps', 'web-backend', 'scripts', 'copy-runtime-files.mjs')

const result = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' })
if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status)
}
if (result.error) {
  throw result.error
}
