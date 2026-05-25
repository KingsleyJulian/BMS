import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getPb } from '@/services/pocketbase'

export interface BarangayInfo {
  id: string
  name: string
  // The `motto` column is repurposed as the barangay's full address —
  // single-line free text shown beneath the name in the sidebar and
  // certificate header. Kept under its original column name so no PB
  // migration is needed; the UI labels it "Address".
  motto: string
  // Legacy split fields, no longer written to. Retained on the type so
  // pre-existing rows still parse, and so reads can fall back to
  // "{municipality}, {province}" until the user re-saves Settings.
  municipality?: string
  province?: string
  monogram: string
  established: string
  signature?: string
  punong_barangay_name?: string
  letterhead_sidebar?: string
  left_logo?: string
  right_logo?: string
  collectionId?: string
}

const FALLBACK_LABEL = 'Barangay Management System'

const FALLBACK: BarangayInfo = {
  id: 'fallback',
  name: '',
  motto: '',
  monogram: 'BMS',
  established: '',
  punong_barangay_name: ''
}

export const useBarangayStore = defineStore('barangay', () => {
  const info = ref<BarangayInfo>(FALLBACK)
  const loaded = ref(false)

  // Tracks whether the loaded record actually has a barangay name set,
  // so the UI can fall back to the generic app label when the PB record
  // is missing or blank.
  const hasInfo = computed(() => loaded.value && !!info.value.name?.trim())

  // Single source of truth for the app's brand string. Used by the window
  // title, header eyebrow, and sidebar so they all stay in sync.
  const displayLabel = computed(() =>
    hasInfo.value ? `Barangay ${info.value.name}` : FALLBACK_LABEL
  )

  // Single-line address. Stored in the `motto` column (repurposed); falls
  // back to "{municipality}, {province}" so rows from the older split
  // schema still display something until the user re-saves Settings.
  const addressLine = computed(() => {
    const i = info.value
    if (i.motto?.trim()) return i.motto.trim()
    return [i.municipality, i.province].filter((v) => !!v?.trim()).join(', ')
  })

  async function load(): Promise<void> {
    try {
      const pb = await getPb()
      const list = await pb.collection('barangay_info').getList<BarangayInfo>(1, 1)
      if (list.items.length > 0) info.value = list.items[0]
      loaded.value = true
    } catch {
      // PB not running yet or collection missing — keep the fallback.
    }
  }

  // Persist user-edited identity fields. Updates the existing row when one
  // exists; otherwise creates the first row. After save the local ref is
  // replaced with the server's record so any reactive consumers (header,
  // sidebar, window title) update immediately.
  async function save(patch: Partial<BarangayInfo>): Promise<void> {
    const pb = await getPb()
    const isFallback = info.value.id === 'fallback'
    const payload: Partial<BarangayInfo> = { ...info.value, ...patch }
    delete (payload as Partial<BarangayInfo> & { id?: string }).id
    delete (payload as Partial<BarangayInfo> & { collectionId?: string }).collectionId

    if (isFallback) {
      info.value = await pb
        .collection('barangay_info')
        .create<BarangayInfo>(payload)
    } else {
      info.value = await pb
        .collection('barangay_info')
        .update<BarangayInfo>(info.value.id, payload)
    }
    loaded.value = true
  }

  return { info, loaded, hasInfo, displayLabel, addressLine, load, save }
})
