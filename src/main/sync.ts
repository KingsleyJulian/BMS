import { getSupabase } from './supabase'
import { getHardwareId } from './hardware'
import { pocketbaseUrl } from './pocketbase'

/**
 * Sync orchestrator — Phase 3 will flesh this out.
 *
 * Plan (recorded here so the seam exists in code):
 *
 *   1. Subscribe to a Realtime channel filtered to this installation's row in
 *      `installations` (filter: hardware_id=eq.<id>). When the row's
 *      `sync_trigger` boolean flips true, run `pushSnapshot()`.
 *
 *   2. `pushSnapshot()` reads every PocketBase collection, builds a JSON
 *      document keyed by collection name, and *patches* it into Supabase
 *      using JSONB `||` operators in an Edge Function. We never overwrite the
 *      whole `snapshot` cell — the function does shallow-merge per collection
 *      to keep payload size bounded.
 *
 *   3. The payload always includes a `version_tag` so when the local schema
 *      bumps (e.g. v1.1 → v1.2) the server-side function knows to run a
 *      migration step before merging.
 */
export function startSyncListener(): void {
  let sb
  try {
    sb = getSupabase()
  } catch {
    console.warn('[sync] Supabase not configured; sync disabled')
    return
  }
  const hardwareId = getHardwareId()
  sb.channel(`installation:${hardwareId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'installations',
        filter: `hardware_id=eq.${hardwareId}`
      },
      (payload) => {
        const newRow = payload.new as { sync_trigger?: boolean }
        if (newRow?.sync_trigger) void pushSnapshot()
      }
    )
    .subscribe()
}

const SCHEMA_VERSION = 'v0.1'

async function pushSnapshot(): Promise<void> {
  console.log('[sync] snapshot push triggered (Phase 3 wiring pending)')
  // TODO Phase 3:
  //   - read each collection from `${pocketbaseUrl}/api/collections/.../records`
  //   - build { residents: [...], households: [...], blotter: [...], ... }
  //   - sb.functions.invoke('apply_snapshot_patch', { hardwareId, version: SCHEMA_VERSION, snapshot })
  void pocketbaseUrl
  void SCHEMA_VERSION
}
