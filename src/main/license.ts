import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { paths } from './paths'
import { encryptToken, decryptToken } from './crypto'
import { getHardwareId } from './hardware'

/**
 * Local license record persisted under userData/. Identifies both *which
 * device this is* (hardwareId) and *which building this device belongs to*
 * (licenseId / activationCode). The activation code is shared across all
 * devices in the same building — many installations, one license.
 *
 * The token is encrypted with a key derived from the hardware ID — so a
 * copied folder won't decrypt on a different machine, and tampering with
 * `expiresAt` invalidates the AES-GCM auth tag and forces re-activation.
 */
export interface LicenseRecord {
  hardwareId: string
  encryptedToken: string
  expiresAt: string // ISO
  lastCheckInAt: string // ISO — updated every successful Supabase phone-home
  activationCode: string
  licenseId: string // building tenant UUID — stable across activation-code rotations
  customerName: string | null // e.g. "Barangay San Isidro"
  deviceLabel: string | null // human label for this seat, e.g. "Front desk PC"
}

export type LicenseStatus =
  | { state: 'unactivated' }
  | {
      state: 'active'
      expiresAt: string
      lastCheckInAt: string
      daysSinceCheckIn: number
      licenseId: string
      activationCode: string
      customerName: string | null
      deviceLabel: string | null
    }
  | { state: 'expired'; expiresAt: string }
  | { state: 'tampered'; reason: string }
  | { state: 'wrong-machine' }
  | { state: 'check-in-required'; daysSinceCheckIn: number }

/** Hard-coded grace window — must phone home at least once in this period. */
export const OFFLINE_GRACE_DAYS = 30

export function loadLicense(): LicenseRecord | null {
  const path = paths.licenseStore()
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf8').trim()
    if (!raw) return null
    return JSON.parse(raw) as LicenseRecord
  } catch {
    return null
  }
}

export function saveLicense(rec: LicenseRecord): void {
  writeFileSync(paths.licenseStore(), JSON.stringify(rec, null, 2), 'utf8')
}

export function clearLicense(): void {
  try {
    writeFileSync(paths.licenseStore(), '', 'utf8')
  } catch {
    /* swallow */
  }
}

/**
 * Inspect the local license. This is the kill-switch — call it on every app
 * start and again periodically while running.
 */
export function evaluateLicense(now: Date = new Date()): LicenseStatus {
  const rec = loadLicense()
  if (!rec) return { state: 'unactivated' }

  if (rec.hardwareId !== getHardwareId()) {
    return { state: 'wrong-machine' }
  }

  // Decrypt to verify integrity. Tampering flips the GCM auth tag → throw.
  let decoded: { code: string; expiresAt: string; licenseId: string } | null = null
  try {
    decoded = JSON.parse(decryptToken(rec.encryptedToken))
  } catch (err) {
    return { state: 'tampered', reason: (err as Error).message }
  }

  // Re-check expiry against the *decrypted* value so a hand-edited
  // `expiresAt` field in license.json doesn't extend the license.
  const expiresAt = new Date(decoded.expiresAt)
  if (now > expiresAt) {
    return { state: 'expired', expiresAt: decoded.expiresAt }
  }

  const lastCheckIn = new Date(rec.lastCheckInAt)
  const daysSinceCheckIn = Math.floor((now.getTime() - lastCheckIn.getTime()) / 86_400_000)
  if (daysSinceCheckIn > OFFLINE_GRACE_DAYS) {
    return { state: 'check-in-required', daysSinceCheckIn }
  }

  return {
    state: 'active',
    expiresAt: decoded.expiresAt,
    lastCheckInAt: rec.lastCheckInAt,
    daysSinceCheckIn,
    licenseId: rec.licenseId,
    activationCode: rec.activationCode,
    customerName: rec.customerName,
    deviceLabel: rec.deviceLabel
  }
}

/**
 * Persist a fresh activation. Called after Supabase confirms the activation
 * code is valid for this building and registers this hardware as a seat.
 */
export function persistActivation(input: {
  activationCode: string
  expiresAt: string
  licenseId: string
  customerName: string | null
  deviceLabel: string | null
}): LicenseRecord {
  const rec: LicenseRecord = {
    hardwareId: getHardwareId(),
    activationCode: input.activationCode,
    licenseId: input.licenseId,
    customerName: input.customerName,
    deviceLabel: input.deviceLabel,
    encryptedToken: encryptToken(
      JSON.stringify({
        code: input.activationCode,
        expiresAt: input.expiresAt,
        licenseId: input.licenseId
      })
    ),
    expiresAt: input.expiresAt,
    lastCheckInAt: new Date().toISOString()
  }
  saveLicense(rec)
  return rec
}

/** Bump `lastCheckInAt` after a successful Supabase round-trip. */
export function recordCheckIn(): void {
  const rec = loadLicense()
  if (!rec) return
  rec.lastCheckInAt = new Date().toISOString()
  saveLicense(rec)
}
