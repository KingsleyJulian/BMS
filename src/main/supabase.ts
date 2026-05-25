import { createClient, type SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'
import { getHardwareId } from './hardware'
import { persistActivation, recordCheckIn } from './license'

/**
 * supabase-js reports a generic "Edge Function returned a non-2xx status
 * code" message and stashes the actual Response on `error.context`. Pull
 * the real reason out so the UI can surface it.
 */
async function readFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.reason) return String(body.reason)
      if (body?.error) return String(body.error)
      return JSON.stringify(body)
    } catch {
      try {
        const text = await error.context.text()
        if (text) return text
      } catch {
        /* ignore */
      }
    }
  }
  return (error as Error)?.message ?? 'unknown error'
}

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.VITE_SUPABASE_URL
  // Accept either the modern publishable key name or the legacy anon name.
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars are not configured')
  client = createClient(url, key, {
    auth: { persistSession: false }
  })
  return client
}

/**
 * Activation flow — called from the License Portal.
 *
 * Backed by `activate_license`:
 *   1) Look up the row in `licenses` by activation_code.
 *   2) Verify not revoked / not expired.
 *   3) Enforce max_seats per building (one license can have many devices).
 *   4) Upsert an installation row keyed by hardwareId.
 *   5) Return licenseId + customer_name so the local app records its
 *      tenant identity.
 */
export async function activateLicense(
  activationCode: string,
  deviceLabel?: string
): Promise<
  | { ok: true; expiresAt: string; licenseId: string; customerName: string | null }
  | { ok: false; reason: string }
> {
  const sb = getClient()
  const hardwareId = getHardwareId()
  const { data, error } = await sb.functions.invoke('activate_license', {
    body: { activationCode, hardwareId, deviceLabel }
  })
  if (error) return { ok: false, reason: await readFunctionError(error) }
  if (!data?.ok) return { ok: false, reason: data?.reason ?? 'activation rejected' }
  persistActivation({
    activationCode,
    expiresAt: data.expiresAt,
    licenseId: data.licenseId,
    customerName: data.customerName ?? null,
    deviceLabel: deviceLabel ?? null
  })
  return {
    ok: true,
    expiresAt: data.expiresAt,
    licenseId: data.licenseId,
    customerName: data.customerName ?? null
  }
}

/**
 * Periodic phone-home. Confirms the license is still valid server-side and
 * bumps lastCheckInAt locally. Failure to reach Supabase is *not* fatal — the
 * offline grace period in license.ts handles that.
 */
export async function checkIn(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const sb = getClient()
    const hardwareId = getHardwareId()
    const { data, error } = await sb.functions.invoke('check_in', {
      body: { hardwareId }
    })
    if (error) return { ok: false, reason: await readFunctionError(error) }
    if (!data?.ok) return { ok: false, reason: data?.reason ?? 'check-in rejected' }
    recordCheckIn()
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: (err as Error).message }
  }
}

/** Used by the sync layer (Phase 3) to subscribe to a Realtime trigger. */
export function getSupabase(): SupabaseClient {
  return getClient()
}
