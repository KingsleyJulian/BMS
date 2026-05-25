#!/usr/bin/env node
// Downloads the PocketBase binary into resources/pocketbase/ for the host
// platform. Called manually (`npm run fetch:pocketbase`) before first dev
// run, and again whenever you want to bump the version.

import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { execSync } from 'node:child_process'

const VERSION = '0.22.21'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'resources', 'pocketbase')

const platform = process.platform
const arch = process.arch
const map = {
  'win32-x64': { suffix: 'windows_amd64', binary: 'pocketbase.exe' },
  'darwin-x64': { suffix: 'darwin_amd64', binary: 'pocketbase' },
  'darwin-arm64': { suffix: 'darwin_arm64', binary: 'pocketbase' },
  'linux-x64': { suffix: 'linux_amd64', binary: 'pocketbase' },
  'linux-arm64': { suffix: 'linux_arm64', binary: 'pocketbase' }
}
const target = map[`${platform}-${arch}`]
if (!target) {
  console.error(`Unsupported platform: ${platform}-${arch}`)
  process.exit(1)
}

const url = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${target.suffix}.zip`
mkdirSync(outDir, { recursive: true })
const zipPath = join(outDir, 'pocketbase.zip')
const binaryPath = join(outDir, target.binary)

if (existsSync(binaryPath)) {
  console.log(`PocketBase already present at ${binaryPath}`)
  process.exit(0)
}

console.log(`Fetching ${url}`)
await download(url, zipPath)

console.log('Extracting…')
if (platform === 'win32') {
  execSync(`powershell -Command "Expand-Archive -Force '${zipPath}' '${outDir}'"`, {
    stdio: 'inherit'
  })
} else {
  execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: 'inherit' })
  chmodSync(binaryPath, 0o755)
}

console.log(`PocketBase ready at ${binaryPath}`)

function download(srcUrl, destPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'))
    https
      .get(srcUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(download(res.headers.location, destPath, redirects + 1))
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          writeFileSync(destPath, Buffer.concat(chunks))
          resolve()
        })
        res.on('error', reject)
      })
      .on('error', reject)
  })
}
