import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const archiveRoot = path.resolve(projectRoot, 'dist')

const archiveTargets = [
  { name: 'web', source: path.resolve(projectRoot, 'apps', 'web', 'dist') },
  { name: 'web-backend', source: path.resolve(projectRoot, 'apps', 'web-backend', 'dist') },
  { name: 'agent-backend', source: path.resolve(projectRoot, 'apps', 'agent-backend', 'dist') },
]

async function assertExists(targetPath) {
  try {
    await stat(targetPath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Missing build output: ${path.relative(projectRoot, targetPath)}`)
    }
    throw error
  }
}

await mkdir(archiveRoot, { recursive: true })

for (const target of archiveTargets) {
  await assertExists(target.source)
  const destPath = path.resolve(archiveRoot, target.name)
  await rm(destPath, { recursive: true, force: true })
  await cp(target.source, destPath, { recursive: true, force: true })
}

const manifest = {
  generatedAt: new Date().toISOString(),
  targets: archiveTargets.map(target => ({
    name: target.name,
    source: path.relative(projectRoot, target.source).replaceAll('\\', '/'),
    archivePath: `dist/${target.name}`
  }))
}

await writeFile(path.resolve(archiveRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log('Archived app dist outputs into root dist/')
