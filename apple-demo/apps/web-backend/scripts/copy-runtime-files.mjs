import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')
const distRoot = path.resolve(backendRoot, 'dist')
const runtimeEntries = ['config.json', 'data']
const require = createRequire(import.meta.url)

async function copyIfExists(relativePath) {
  const sourcePath = path.resolve(backendRoot, relativePath)
  const targetPath = path.resolve(distRoot, relativePath)
  try {
    await rm(targetPath, { recursive: true, force: true })
    await cp(sourcePath, targetPath, { recursive: true, force: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return
    }
    throw error
  }
}

async function bundleRuntimeServer() {
  await build({
    entryPoints: [path.resolve(backendRoot, 'src/index.ts')],
    outfile: path.resolve(distRoot, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    banner: {
      js: "import * as __path from 'node:path'; import { fileURLToPath as __fileURLToPath } from 'node:url'; import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __path.dirname(__filename);"
    },
    logLevel: 'info',
  })
}

async function copyRuntimeAssets() {
  const sqlWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  await cp(sqlWasmPath, path.resolve(distRoot, 'sql-wasm.wasm'), { force: true })
}

async function writeRuntimePackageJson() {
  const sourcePath = path.resolve(backendRoot, 'package.json')
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  const runtimePackage = {
    name: source.name,
    version: source.version,
    private: true,
    type: 'module',
    main: './index.js',
    scripts: {
      start: 'node index.js'
    }
  }
  await writeFile(path.resolve(distRoot, 'package.json'), JSON.stringify(runtimePackage, null, 2) + '\n', 'utf8')
}

await mkdir(distRoot, { recursive: true })
for (const entry of runtimeEntries) {
  await copyIfExists(entry)
}

await bundleRuntimeServer()
await copyRuntimeAssets()
await writeRuntimePackageJson()

console.log('Copied web-backend runtime files')
