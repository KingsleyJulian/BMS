import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { paths } from './paths'

const HOST = '127.0.0.1'
const PORT = 8090

let pb: ChildProcess | null = null

export const pocketbaseUrl = `http://${HOST}:${PORT}`

/**
 * Spawn the bundled PocketBase binary as a sidecar. Uses a per-user data dir
 * so each OS account on the machine gets isolated state.
 */
export async function startPocketBase(): Promise<void> {
  if (pb) return
  const binary = paths.pbBinary()
  const dataDir = paths.pbData()

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

  if (!existsSync(binary)) {
    // Don't crash dev — just warn. `npm run fetch:pocketbase` populates this.
    console.warn(`[pocketbase] binary missing at ${binary} — sidecar not started`)
    return
  }

  pb = spawn(
    binary,
    [
      'serve',
      `--http=${HOST}:${PORT}`,
      `--dir=${dataDir}`,
      `--migrationsDir=${paths.pbMigrations()}`
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  )

  pb.stdout?.on('data', (b) => process.stdout.write(`[pb] ${b}`))
  pb.stderr?.on('data', (b) => process.stderr.write(`[pb!] ${b}`))
  pb.on('exit', (code) => {
    console.log(`[pocketbase] exited with code ${code}`)
    pb = null
  })

  // Wait until the HTTP endpoint responds to /api/health.
  await waitForReady()
}

export function stopPocketBase(): void {
  if (!pb) return
  try {
    pb.kill()
  } catch {
    /* swallow */
  }
  pb = null
}

async function waitForReady(timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${pocketbaseUrl}/api/health`)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('PocketBase failed to become ready in time')
}
