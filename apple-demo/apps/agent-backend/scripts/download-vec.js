/**
 * Download sqlite-vec extension
 *
 * Run: npm run download-vec
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VERSION = 'v0.1.6'
const PLATFORM = process.platform

const URLS = {
  win32: `https://github.com/asg017/sqlite-vec/releases/download/${VERSION}/sqlite-vec-0.1.6-loadable-windows-x86_64.tar.gz`,
  darwin: `https://github.com/asg017/sqlite-vec/releases/download/${VERSION}/sqlite-vec-0.1.6-loadable-macos-x86_64.tar.gz`,
  linux: `https://github.com/asg017/sqlite-vec/releases/download/${VERSION}/sqlite-vec-0.1.6-loadable-linux-x86_64.tar.gz`
}

const EXTENSION_NAMES = {
  win32: 'vec0.dll',
  darwin: 'vec0.dylib',
  linux: 'vec0.so'
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`)
    const file = fs.createWriteStream(dest)

    const doGet = (currentUrl) => {
      https.get(currentUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          doGet(response.headers.location)
        } else if (response.statusCode === 200) {
          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        } else {
          reject(new Error(`HTTP ${response.statusCode}`))
        }
      }).on('error', reject)
    }

    doGet(url)
  })
}

async function main() {
  const url = URLS[PLATFORM]
  if (!url) {
    console.error(`Unsupported platform: ${PLATFORM}`)
    process.exit(1)
  }

  const extensionsDir = path.join(__dirname, '..', 'extensions')
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true })
  }

  const tarPath = path.join(extensionsDir, 'sqlite-vec.tar.gz')

  console.log(`Downloading sqlite-vec for ${PLATFORM}...`)

  try {
    await download(url, tarPath)
    console.log('Download complete')

    // Extract using tar (available on Windows 10+)
    console.log('Extracting...')
    execSync(`tar -xzf "${tarPath}" -C "${extensionsDir}"`, { stdio: 'inherit' })

    // Verify extraction
    const extName = EXTENSION_NAMES[PLATFORM]
    const extPath = path.join(extensionsDir, extName)
    if (fs.existsSync(extPath)) {
      console.log(`Extension installed: ${extPath}`)
    } else {
      console.error(`Extraction failed: ${extName} not found`)
    }

    // Cleanup
    if (fs.existsSync(tarPath)) {
      fs.unlinkSync(tarPath)
    }

    console.log('Done!')
  } catch (error) {
    console.error('Failed:', error.message)
    process.exit(1)
  }
}

main()
