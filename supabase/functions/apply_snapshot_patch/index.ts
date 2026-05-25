// Supabase Edge Function: apply_snapshot_patch
//
// Receives a partial snapshot { residents: [...], blotter: [...], ... } and
// merges it into the *building's* snapshot — keyed by license_id, not
// hardware_id. Every device in the same building shares the same snapshot
// row, so changes from any seat are visible to the others.
//
// We resolve license_id from the requesting hardware_id rather than trusting
// the client to send it, so a misbehaving device cannot write into another
// building's snapshot.
//
// Deploy: supabase functions deploy apply_snapshot_patch

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PatchBody {
  hardwareId: string
  version: string
  snapshot: Record<string, unknown>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = (await req.json()) as PatchBody
  if (!body.hardwareId || !body.snapshot) {
    return json({ ok: false, reason: 'missing fields' }, 400)
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Resolve license_id from the requesting hardware. This is the only
  // trusted way to get the tenant scope.
  const { data: install } = await sb
    .from('installations')
    .select('license_id, licenses(revoked_at, expires_at)')
    .eq('hardware_id', body.hardwareId)
    .maybeSingle()

  if (!install) return json({ ok: false, reason: 'unknown installation' })
  const lic = (install as any).licenses
  if (!lic || lic.revoked_at) return json({ ok: false, reason: 'revoked' })
  if (new Date(lic.expires_at) < new Date()) return json({ ok: false, reason: 'expired' })

  // Schema-version migration hook. When the version_tag bumps (v0.1 → v0.2)
  // we may need to rewrite older snapshot fields before merging. Add steps
  // here as the local schema evolves.
  // if (body.version === 'v0.2') { ... }

  const { data, error } = await sb.rpc('merge_building_snapshot', {
    p_license_id: install.license_id,
    p_patch: body.snapshot,
    p_version: body.version,
    p_hardware_id: body.hardwareId
  })

  if (error) return json({ ok: false, reason: error.message }, 500)
  return json({ ok: true, snapshot: data })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' }
  })
}
