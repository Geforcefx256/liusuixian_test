import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const removeNodeModules = process.argv.includes('--with-node-modules')

async function removeIfExists(targetPath) {
  await rm(targetPath, { recursive: true, force: true })
}

async function cleanWorkspaceGroup(groupName) {
  const groupRoot = path.resolve(projectRoot, groupName)
  const entries = await readdir(groupRoot, { withFileTypes: true }).catch(error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  })

  await Promise.all(
    entries
      .filter(entry => entry.isDirectory())
      .flatMap(entry => {
        const packageRoot = path.resolve(groupRoot, entry.name)
        const targets = [
          removeIfExists(path.resolve(packageRoot, 'dist')),
          removeIfExists(path.resolve(packageRoot, 'tsconfig.tsbuildinfo'))
        ]

        if (removeNodeModules) {
          targets.push(removeIfExists(path.resolve(packageRoot, 'node_modules')))
        }

        return targets
      })
  )
}

await removeIfExists(path.resolve(projectRoot, 'dist'))
if (removeNodeModules) {
  await removeIfExists(path.resolve(projectRoot, 'node_modules'))
}
await cleanWorkspaceGroup('apps')
await cleanWorkspaceGroup('packages')
