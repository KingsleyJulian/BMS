// Supabase Edge Function: activate_license
//
// One activation_code = one building. Multiple devices share the code; each
// gets its own row in `installations`. Optional max_seats caps how many
// devices a single building license may run.
//
// Flow:
//   1. Look up license by activation_code.
//   2. Verify not revoked / not expired.
//   3. If license.max_seats is set, count current installations and reject
//      when the cap is hit (unless the requesting device is already one of
//      the seated ones — re-activation on the same machine is fine).
//   4. Upsert the installation row keyed by hardware_id.
//   5. Return licenseId + customer + expiresAt so the local app can store
//      the building tenant identifier.
//
// Deploy: supabase functions deploy activate_license

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ActivateBody {
  activationCode: string
  hardwareId: string
  deviceLabel?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { activationCode, hardwareId, deviceLabel } = (await req.json()) as ActivateBody
  if (!activationCode || !hardwareId) {
    return json({ ok: false, reason: 'missing fields' }, 400)
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: license, error } = await sb
    .from('licenses')
    .select('*')
    .eq('activation_code', activationCode)
    .maybeSingle()

  if (error || !license) return json({ ok: false, reason: 'unknown code' })
  if (license.revoked_at) return json({ ok: false, reason: 'revoked' })
  if (new Date(license.expires_at) < new Date()) return json({ ok: false, reason: 'expired' })

  // Seat-cap check (only when max_seats is set).
  if (license.max_seats != null) {
    const { count, error: countErr } = await sb
      .from('installations')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', license.id)
    if (countErr) return json({ ok: false, reason: countErr.message }, 500)

    const { data: existingSelf } = await sb
      .from('installations')
      .select('hardware_id')
      .eq('hardware_id', hardwareId)
      .maybeSingle()

    const isAlreadySeated = existingSelf?.hardware_id === hardwareId
    if (!isAlreadySeated && (count ?? 0) >= license.max_seats) {
      return json({
        ok: false,
        reason: `seat limit reached (${license.max_seats}) — contact admin to revoke an unused device`
      })
    }
  }

  const now = new Date().toISOString()
  const upsertPayload = {
    hardware_id: hardwareId,
    license_id: license.id,
    last_check_in: now,
    ...(deviceLabel ? { device_label: deviceLabel } : {})
  }
  const { error: upsertErr } = await sb
    .from('installations')
    .upsert(upsertPayload, { onConflict: 'hardware_id' })
  if (upsertErr) return json({ ok: false, reason: upsertErr.message }, 500)

  return json({
    ok: true,
    expiresAt: license.expires_at,
    licenseId: license.id,
    licenseCode: license.activation_code,
    customerName: license.customer_name,
    plan: license.plan
  })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' }
  })
}
