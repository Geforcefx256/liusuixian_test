import { copyFile, cp, lstat, mkdir, readdir, readlink, rm, symlink } from 'node:fs/promises'
import path from 'node:path'

const SKIPPED_ENTRIES = new Set(['.bin', '.vite', '.ignored'])
const isWindows = process.platform === 'win32'

async function pathType(targetPath) {
  try {
    return await lstat(targetPath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function ensureSymlink(linkTarget, destPath, type) {
  const existing = await pathType(destPath)
  if (existing?.isSymbolicLink()) {
    const currentTarget = await readlink(destPath)
    if (currentTarget === linkTarget) {
      return
    }
  }
  if (existing) {
    await rm(destPath, { recursive: true, force: true })
  }
  await symlink(linkTarget, destPath, type)
}

// Custom copy function that handles symlinks properly on Windows
async function copyDirectory(sourcePath, targetPath) {
  await mkdir(targetPath, { recursive: true })
  const entries = await readdir(sourcePath, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(sourcePath, entry.name)
    const destPath = path.join(targetPath, entry.name)

    if (entry.isSymbolicLink()) {
      if (isWindows) {
        // On Windows, resolve the symlink and copy the actual content
        const linkTarget = await readlink(srcPath)
        const resolvedPath = path.resolve(path.dirname(srcPath), linkTarget)
        const linkStat = await pathType(resolvedPath)
        if (linkStat?.isDirectory()) {
          await copyDirectory(resolvedPath, destPath)
        } else if (linkStat?.isFile()) {
          await copyFile(resolvedPath, destPath)
        }
      } else {
        const linkTarget = await readlink(srcPath)
        await ensureSymlink(linkTarget, destPath, entry.isDirectory() ? 'junction' : 'file')
      }
    } else if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath)
    }
  }
}

function readStorePackageName(rootStorePath, resolvedPath) {
  const relativePath = path.relative(rootStorePath, resolvedPath)
  if (relativePath.startsWith('..')) {
    return null
  }
  return relativePath.split(path.sep)[0] ?? null
}

async function readDirEntriesSafe(targetPath) {
  return readdir(targetPath, { withFileTypes: true }).catch(error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  })
}

export async function assembleRuntimeNodeModules({
  projectRoot,
  sourceNodeModules,
  targetNodeModules,
  }) {
  const rootStorePath = path.resolve(projectRoot, 'node_modules', '.pnpm')
  const sourceStorePath = path.resolve(sourceNodeModules, '.pnpm')
  const copiedStorePackages = new Set()

  if (!(await pathType(sourceStorePath))) {
    await copyDirectory(sourceNodeModules, targetNodeModules)
    return
  }

  async function copyLinkedStorePackages(currentDir) {
    const entries = await readDirEntriesSafe(currentDir)
    for (const entry of entries) {
      if (SKIPPED_ENTRIES.has(entry.name)) {
        continue
      }

      const sourcePath = path.resolve(currentDir, entry.name)
      if (entry.isSymbolicLink()) {
        const resolvedTarget = path.resolve(currentDir, await readlink(sourcePath))
        const storePackageName = readStorePackageName(rootStorePath, resolvedTarget)
        if (storePackageName) {
          await copyStorePackageClosure(storePackageName)
        }
        continue
      }

      if (entry.isDirectory()) {
        await copyLinkedStorePackages(sourcePath)
      }
    }
  }

  async function copyStorePackageClosure(storePackageName) {
    if (copiedStorePackages.has(storePackageName)) {
      return
    }
    copiedStorePackages.add(storePackageName)

    const sourceStoreDir = path.resolve(rootStorePath, storePackageName)
    const targetStoreDir = path.resolve(targetNodeModules, '.pnpm', storePackageName)
    await copyDirectory(sourceStoreDir, targetStoreDir)
    await copyLinkedStorePackages(path.resolve(sourceStoreDir, 'node_modules'))
  }

  async function rebuildEntryLink(packageSegments, sourcePath, targetPath) {
    const linkTarget = await readlink(sourcePath)
    const resolvedTarget = path.resolve(path.dirname(sourcePath), linkTarget)
    const storePackageName = readStorePackageName(rootStorePath, resolvedTarget)
    if (!storePackageName) {
      await copyDirectory(resolvedTarget, targetPath)
      return
    }

    await copyStorePackageClosure(storePackageName)
    const storePackagePath = path.resolve(
      targetNodeModules,
      '.pnpm',
      storePackageName,
      'node_modules',
      ...packageSegments
    )

    if (isWindows) {
      // On Windows, copy directory instead of creating symlink to avoid permission issues
      await copyDirectory(storePackagePath, targetPath)
    } else {
      const localLinkTarget = path.relative(path.dirname(targetPath), storePackagePath)
      await ensureSymlink(localLinkTarget, targetPath, 'dir')
    }
  }

  async function mirrorNodeModulesDir(currentSourceDir, currentTargetDir, packageSegments = []) {
    await mkdir(currentTargetDir, { recursive: true })
    const entries = await readDirEntriesSafe(currentSourceDir)

    for (const entry of entries) {
      if (SKIPPED_ENTRIES.has(entry.name)) {
        continue
      }

      const sourcePath = path.resolve(currentSourceDir, entry.name)
      const targetPath = path.resolve(currentTargetDir, entry.name)

      if (entry.isSymbolicLink()) {
        await rebuildEntryLink([...packageSegments, entry.name], sourcePath, targetPath)
        continue
      }

      if (!entry.isDirectory()) {
        await cp(sourcePath, targetPath, { force: true })
        continue
      }

      const markerPath = path.resolve(sourcePath, 'package.json')
      if (await pathType(markerPath)) {
        await copyDirectory(sourcePath, targetPath)
        continue
      }

      await mirrorNodeModulesDir(sourcePath, targetPath, [...packageSegments, entry.name])
    }
  }

  await mkdir(path.resolve(targetNodeModules, '.pnpm'), { recursive: true })
  await mirrorNodeModulesDir(sourceNodeModules, targetNodeModules)
}
