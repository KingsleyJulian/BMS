// Supabase Edge Function: check_in
//
// Periodic phone-home from a device. Looks up its installation row, joins to
// the license, validates not-revoked / not-expired, stamps last_check_in, and
// returns the building info so the local app can refresh its cached tenant
// identifier.
//
// Deploy: supabase functions deploy check_in

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { hardwareId } = (await req.json()) as { hardwareId: string }
  if (!hardwareId) return json({ ok: false, reason: 'missing hardwareId' }, 400)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: install } = await sb
    .from('installations')
    .select('*, licenses(*)')
    .eq('hardware_id', hardwareId)
    .maybeSingle()

  if (!install) return json({ ok: false, reason: 'unknown installation' })
  const lic = (install as any).licenses
  if (!lic || lic.revoked_at) return json({ ok: false, reason: 'revoked' })
  if (new Date(lic.expires_at) < new Date()) return json({ ok: false, reason: 'expired' })

  await sb
    .from('installations')
    .update({ last_check_in: new Date().toISOString() })
    .eq('hardware_id', hardwareId)

  return json({
    ok: true,
    expiresAt: lic.expires_at,
    licenseId: lic.id,
    licenseCode: lic.activation_code,
    customerName: lic.customer_name,
    plan: lic.plan
  })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' }
  })
}
