import PocketBase from 'pocketbase'

let _pb: PocketBase | null = null

/**
 * Lazy singleton — the PB URL comes from the main process so we don't
 * hardcode the port in the renderer.
 *
 * Auto-cancellation is disabled globally. The PB SDK normally collapses
 * requests by URL+method (cancelling earlier in-flights). That works for
 * typeaheads but breaks our submit flow: we fire multiple parallel
 * `ensureEntry` creates against the same collection endpoint, and only the
 * last would resolve while the others reject with "The request was
 * autocancelled". Our autocomplete suggestions filter client-side, so we
 * don't need server-side request collapsing.
 */
export async function getPb(): Promise<PocketBase> {
  if (_pb) return _pb
  const url = await window.bms.system.pocketbaseUrl()
  _pb = new PocketBase(url)
  _pb.autoCancellation(false)
  return _pb
}
