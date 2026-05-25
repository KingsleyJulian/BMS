import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { getHardwareId } from './hardware'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const SALT = Buffer.from('bms-license-v1', 'utf8')

/**
 * Derive the AES key from a build-time secret PLUS the hardware ID. This means
 * a license file copied to a different machine cannot be decrypted there — the
 * key material is different — without also forging the hardware fingerprint.
 */
function deriveKey(): Buffer {
  const secret = process.env.LICENSE_ENCRYPTION_SECRET ?? 'bms-default-secret-change-me'
  const material = `${secret}:${getHardwareId()}`
  return scryptSync(material, SALT, 32)
}

export function encryptToken(plain: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptToken(packed: string): string {
  const buf = Buffer.from(packed, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + 16)
  const ct = buf.subarray(IV_LEN + 16)
  const decipher = createDecipheriv(ALGO, deriveKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
