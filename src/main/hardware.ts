// node-machine-id ships as CommonJS — must default-import then destructure
// when consumed from an ESM bundle (our main process is "type": "module").
import machineId from 'node-machine-id'
import { createHash } from 'node:crypto'
import os from 'node:os'

const { machineIdSync } = machineId as unknown as {
  machineIdSync: (original?: boolean) => string
}

let cached: string | null = null

/**
 * Stable per-machine identifier. We hash node-machine-id together with the
 * platform + CPU model so that copying the userData folder to a different
 * machine produces a different fingerprint and the license fails to validate.
 */
export function getHardwareId(): string {
  if (cached) return cached
  const raw = machineIdSync(true)
  const cpu = os.cpus()[0]?.model ?? 'unknown'
  const fingerprint = createHash('sha256')
    .update(raw)
    .update('|')
    .update(process.platform)
    .update('|')
    .update(os.arch())
    .update('|')
    .update(cpu)
    .digest('hex')
  cached = fingerprint
  return fingerprint
}
