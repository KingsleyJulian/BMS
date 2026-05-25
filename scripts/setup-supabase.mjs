#!/usr/bin/env node
// One-time Supabase bootstrap.
//
// What this can do automatically (using the service_role key):
//   - Verify project connectivity.
//   - Insert a starter license code into `licenses`.
//   - Upsert an installation row for testing.
//
// What it CANNOT do (Postgres DDL is not exposed via PostgREST):
//   - CREATE TABLE / CREATE POLICY / CREATE FUNCTION
//   - Edge Function deploys
// For those it prints copy-pasteable instructions.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

loadEnv(join(root, '.env'))
loadEnv(join(root, '.env.local'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const projectRef = new URL(SUPABASE_URL).host.split('.')[0]
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

const STARTER_CODE = 'BMS-PILOT-2026-0001'
const STARTER_BUILDING = 'Barangay San Isidro · Pilot'
const STARTER_SEATS = 5 // up to 5 devices per building license
const ONE_YEAR_FROM_NOW = new Date(Date.now() + 365 * 86_400_000).toISOString()

async function main() {
  console.log(`\n› Supabase project: ${projectRef}`)

  // 1. Check schema presence with a real GET — HEAD requests don't reliably
  // surface "missing table" through PostgREST.
  const probe = await sb.from('licenses').select('id').limit(1)
  if (probe.error) {
    if (isMissingTable(probe.error)) {
      printSchemaInstructions()
      process.exit(0)
    }
    throw probe.error
  }
  console.log(`  ✓ schema present (licenses table reachable)`)

  // 2. Seed starter building license (idempotent — upsert by activation_code)
  const { error: upErr } = await sb.from('licenses').upsert(
    {
      activation_code: STARTER_CODE,
      customer_name: STARTER_BUILDING,
      plan: 'pilot',
      max_seats: STARTER_SEATS,
      expires_at: ONE_YEAR_FROM_NOW
    },
    { onConflict: 'activation_code' }
  )
  if (upErr) {
    if (isMissingTable(upErr)) {
      printSchemaInstructions()
      process.exit(0)
    }
    throw upErr
  }
  console.log(`  ✓ starter building license seeded`)

  // 3. Done
  console.log('\n────────────────────────────────────────────────────────')
  console.log(' READY')
  console.log('────────────────────────────────────────────────────────')
  console.log(` Building:        ${STARTER_BUILDING}`)
  console.log(` Activation code: ${STARTER_CODE}`)
  console.log(` Max seats:       ${STARTER_SEATS} devices share this code`)
  console.log(` Expires at:      ${ONE_YEAR_FROM_NOW.slice(0, 10)}`)
  console.log('')
  console.log(' Remaining manual step (Edge Functions):')
  console.log(' If you want activation/check-in to work end-to-end,')
  console.log(' deploy the three functions in supabase/functions/ via')
  console.log(' the Supabase CLI:')
  console.log('')
  console.log('   supabase login')
  console.log(`   supabase link --project-ref ${projectRef}`)
  console.log('   supabase functions deploy activate_license')
  console.log('   supabase functions deploy check_in')
  console.log('   supabase functions deploy apply_snapshot_patch')
  console.log('')
  console.log(' Then run `npm run dev` and paste the activation code above.')
  console.log('────────────────────────────────────────────────────────\n')
}

function printSchemaInstructions() {
  const sqlPath = join(root, 'supabase', 'schema.sql')
  console.log('')
  console.log('  ✗ schema is missing — `licenses` table not found.')
  console.log('')
  console.log('  Postgres DDL has to be applied via the SQL editor (the')
  console.log('  service_role key cannot run CREATE TABLE through PostgREST).')
  console.log('')
  console.log('  → Open:')
  console.log(`    https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  console.log('')
  console.log(`  → Paste the contents of: ${sqlPath}`)
  console.log('  → Click "Run".')
  console.log('  → Re-run this script: npm run setup:supabase')
  console.log('')
}

function isMissingTable(err) {
  if (!err) return false
  const msg = (err.message ?? '').toLowerCase()
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

function loadEnv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

main().catch((err) => {
  console.error('\n✗ setup failed:', err.message ?? err)
  process.exit(1)
})
