import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function listZipArchiveEntries(archivePath: string): Promise<string[]> {
  const output = await runArchiveCommand(buildListArchiveCommand(archivePath))
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

export async function extractZipArchive(archivePath: string, destinationPath: string): Promise<void> {
  await runArchiveCommand(buildExtractArchiveCommand(archivePath, destinationPath))
}

async function runArchiveCommand(command: { file: string; args: string[] }): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command.file, command.args, {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    })
    return stdout
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Archive command failed'
    throw new Error(`Failed to process skill archive: ${message}`)
  }
}

function buildListArchiveCommand(archivePath: string): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      file: 'powershell',
      args: [
        '-NoProfile',
        '-Command',
        `[System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') > $null; [IO.Compression.ZipFile]::OpenRead('${escapePowerShell(archivePath)}').Entries | ForEach-Object { $_.FullName }`
      ]
    }
  }
  return {
    file: 'unzip',
    args: ['-Z1', archivePath]
  }
}

function buildExtractArchiveCommand(archivePath: string, destinationPath: string): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      file: 'powershell',
      args: [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${escapePowerShell(archivePath)}' -DestinationPath '${escapePowerShell(destinationPath)}' -Force`
      ]
    }
  }
  return {
    file: 'unzip',
    args: ['-qq', archivePath, '-d', destinationPath]
  }
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''")
}
