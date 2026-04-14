import { chmod, cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = '15.1.0'
const RELEASE_BASE_URL = `https://github.com/BurntSushi/ripgrep/releases/download/${VERSION}`
const POSIX_BINARY = 'rg'
const WINDOWS_BINARY = 'rg.exe'
// ripgrep 15.1.0 publishes eight relevant upstream archives; we materialize
// the eight runtime target directories required by the backend asset layout.
const TARGETS = Object.freeze([
  {
    target: 'x86_64-unknown-linux-gnu',
    archiveTarget: 'x86_64-unknown-linux-musl',
    archiveExt: 'tar.gz',
    binaryName: POSIX_BINARY
  },
  {
    target: 'x86_64-unknown-linux-musl',
    archiveTarget: 'x86_64-unknown-linux-musl',
    archiveExt: 'tar.gz',
    binaryName: POSIX_BINARY
  },
  {
    target: 'aarch64-unknown-linux-gnu',
    archiveTarget: 'aarch64-unknown-linux-gnu',
    archiveExt: 'tar.gz',
    binaryName: POSIX_BINARY
  },
  {
    target: 'aarch64-unknown-linux-musl',
    archiveTarget: 'aarch64-unknown-linux-gnu',
    archiveExt: 'tar.gz',
    binaryName: POSIX_BINARY
  },
  {
    target: 'x86_64-apple-darwin',
    archiveTarget: 'x86_64-apple-darwin',
    archiveExt: 'tar.gz',
    binaryName: POSIX_BINARY
  },
  {
    target: 'aarch64-apple-darwin',
    archiveTarget: 'aarch64-apple-darwin',
    archiveExt: 'tar.gz',
    binaryName: POSIX_BINARY
  },
  {
    target: 'x86_64-pc-windows-msvc',
    archiveTarget: 'x86_64-pc-windows-msvc',
    archiveExt: 'zip',
    binaryName: WINDOWS_BINARY
  },
  {
    target: 'aarch64-pc-windows-msvc',
    archiveTarget: 'aarch64-pc-windows-msvc',
    archiveExt: 'zip',
    binaryName: WINDOWS_BINARY
  }
])

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(scriptDir, '..')
const vendorRoot = path.resolve(backendRoot, 'assets', 'vendor', 'ripgrep')

await mkdir(vendorRoot, { recursive: true })
const tempRoot = await mkdtemp(path.join(tmpdir(), 'ripgrep-download-'))

try {
  for (const target of TARGETS) {
    await downloadAndExtractTarget(target, tempRoot)
  }
  console.log(`Downloaded ripgrep ${VERSION} into ${vendorRoot}`)
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

async function downloadAndExtractTarget(target, tempRoot) {
  const archiveName = `ripgrep-${VERSION}-${target.archiveTarget}.${target.archiveExt}`
  const archivePath = path.join(tempRoot, archiveName)
  const extractRoot = path.join(tempRoot, target.archiveTarget)

  console.log(`Downloading ${archiveName} for ${target.target}`)
  await downloadFile(`${RELEASE_BASE_URL}/${archiveName}`, archivePath)
  await mkdir(extractRoot, { recursive: true })
  await extractArchive(archivePath, extractRoot, target.archiveExt)

  const extractedRoot = path.join(extractRoot, `ripgrep-${VERSION}-${target.archiveTarget}`)
  const sourceBinary = path.join(extractedRoot, target.binaryName)
  const targetDir = path.join(vendorRoot, target.target)
  const targetBinary = path.join(targetDir, target.binaryName)

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await cp(sourceBinary, targetBinary)
  if (target.binaryName === POSIX_BINARY) {
    await chmod(targetBinary, 0o755)
  }
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(targetPath, buffer)
}

async function extractArchive(archivePath, extractRoot, archiveExt) {
  if (archiveExt === 'tar.gz') {
    await runCommand('tar', ['-xzf', archivePath, '-C', extractRoot])
    return
  }
  await runCommand('unzip', ['-o', archivePath, '-d', extractRoot])
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve(undefined)
        return
      }
      reject(new Error(`${command} exited with code ${code ?? 'null'}`))
    })
  })
}
