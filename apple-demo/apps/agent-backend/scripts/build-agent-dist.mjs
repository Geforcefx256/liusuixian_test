import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { parseDocument } from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')
const distRoot = path.resolve(backendRoot, 'dist')
const assetsRoot = path.resolve(distRoot, 'assets')
const configsToCopy = ['config.json', 'gateway.config.json', 'mcp.config.json']
const skillScriptsManifestName = 'SCRIPTS.yaml'
const skillRuntimePathReplacements = [
  ['agent-backend/assets/agents/', 'agent-backend/dist/assets/agents/'],
  ['agent-backend/assets/skills/', 'agent-backend/dist/assets/skills/'],
  ['agent-backend/workspace/project/', 'agent-backend/dist/workspace/project/'],
  ['web/public/templates/ne-sampleV1.csv', '/templates/ne-sampleV1.csv'],
]

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

async function rewriteSkillFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.resolve(dirPath, entry.name)
    if (entry.isDirectory()) {
      await rewriteSkillFiles(fullPath)
      continue
    }
    if (entry.name !== 'SKILL.md') {
      continue
    }
    const original = await readFile(fullPath, 'utf8')
    const rewritten = skillRuntimePathReplacements
      .reduce(
        (content, [from, to]) => content.replaceAll(from, to),
        original
      )
      .replaceAll(
        'node --import "$RUNTIME_ROOT/apps/agent-backend/node_modules/tsx/dist/loader.mjs" ',
        'node '
      )
      .replaceAll('npx tsx ', 'node ')
      .replace(/(\/scripts\/[A-Za-z0-9._/-]+)\.ts\b/g, '$1.js')
    await writeFile(fullPath, rewritten, 'utf8')
  }
}

async function ensureDir(relativePath) {
  await mkdir(path.resolve(distRoot, relativePath), { recursive: true })
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
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
      js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
    },
    logLevel: 'info',
  })
}

async function collectAssetScriptEntryPoints() {
  const skillsRoot = path.resolve(backendRoot, 'assets/skills')
  if (!(await pathExists(skillsRoot))) {
    return []
  }

  const entries = await readdir(skillsRoot, { withFileTypes: true })
  const entryPoints = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const manifestPath = path.resolve(skillsRoot, entry.name, skillScriptsManifestName)
    if (!(await pathExists(manifestPath))) {
      continue
    }
    entryPoints.push(...await readScriptEntriesFromManifest(manifestPath))
  }
  return entryPoints
}

async function readScriptEntriesFromManifest(manifestPath) {
  const manifestContent = await readFile(manifestPath, 'utf8')
  const document = parseDocument(manifestContent, {
    prettyErrors: true,
    strict: true
  })
  if (document.errors.length > 0) {
    throw new Error(`Invalid ${skillScriptsManifestName} at ${manifestPath}: ${document.errors[0]?.message ?? 'unknown parse error'}`)
  }

  const manifest = document.toJS()
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Invalid ${skillScriptsManifestName} at ${manifestPath}: root must be an object`)
  }
  if (!Array.isArray(manifest.templates)) {
    throw new Error(`Invalid ${skillScriptsManifestName} at ${manifestPath}: "templates" must be an array`)
  }

  return manifest.templates.map((template, index) => {
    if (!template || typeof template !== 'object' || Array.isArray(template)) {
      throw new Error(`Invalid ${skillScriptsManifestName} at ${manifestPath}: templates[${index}] must be an object`)
    }
    if (typeof template.entry !== 'string' || template.entry.trim().length === 0) {
      throw new Error(`Invalid ${skillScriptsManifestName} at ${manifestPath}: templates[${index}].entry must be a non-empty string`)
    }
    return path.resolve(path.dirname(manifestPath), template.entry)
  })
}

async function bundleAssetScripts() {
  const entryPoints = await collectAssetScriptEntryPoints()
  if (entryPoints.length === 0) {
    return
  }

  await build({
    entryPoints,
    outdir: distRoot,
    outbase: backendRoot,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: false,
    logLevel: 'info',
  })
}

async function rewriteRuntimeConfig() {
  const configPath = path.resolve(distRoot, 'config.json')
  const raw = JSON.parse(await readFile(configPath, 'utf8'))
  raw.runtime = {
    ...raw.runtime,
    workspaceDir: '../..'
  }
  await writeFile(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8')
}

// tsc already outputs to dist, just add runtime files
await mkdir(assetsRoot, { recursive: true })

await rm(path.resolve(distRoot, 'node_modules'), { recursive: true, force: true })
await bundleRuntimeServer()

for (const fileName of configsToCopy) {
  await copyIfExists(fileName)
}

await copyIfExists('resources')
await copyIfExists('extensions')
await ensureDir('workspace')
await ensureDir('workspace/project')
await ensureDir('workspace/upload')
await ensureDir('data')

await copyIfExists(path.join('assets', 'agents'))
await copyIfExists(path.join('assets', 'skills'))
await copyIfExists(path.join('assets', 'vendor'))
await bundleAssetScripts()

if (await pathExists(path.resolve(assetsRoot, 'agents'))) {
  await rewriteSkillFiles(path.resolve(assetsRoot, 'agents'))
}
if (await pathExists(path.resolve(assetsRoot, 'skills'))) {
  await rewriteSkillFiles(path.resolve(assetsRoot, 'skills'))
}

if (await pathExists(path.resolve(distRoot, 'config.json'))) {
  await rewriteRuntimeConfig()
}

await writeRuntimePackageJson()
console.log('✓ Assembled agent-backend/dist')
