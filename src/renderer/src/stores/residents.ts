import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPb } from '@/services/pocketbase'

export type HouseholdFlag = '4PS' | 'SENIOR' | 'PWD' | 'PENDING'

export interface Household {
  id: string
  household_id: string
  head_of_family: string
  purok: string
  members: number
  flags: HouseholdFlag[]
  contact: string
  created?: string
  updated?: string
}

export type HouseholdInput = Omit<Household, 'id' | 'created' | 'updated'>

export const useResidentsStore = defineStore('residents', () => {
  const items = ref<Household[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const pb = await getPb()
      const records = await pb
        .collection('households')
        .getFullList<Household>({ sort: 'household_id' })
      // PB returns `flags` as `string | string[]` depending on cardinality;
      // normalize to array for the UI.
      items.value = records.map((r) => ({
        ...r,
        flags: Array.isArray(r.flags) ? r.flags : r.flags ? [r.flags as unknown as HouseholdFlag] : []
      }))
    } catch (e) {
      error.value = (e as Error).message
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function create(input: HouseholdInput): Promise<Household> {
    const pb = await getPb()
    const created = await pb.collection('households').create<Household>(input)
    items.value.push({
      ...created,
      flags: Array.isArray(created.flags) ? created.flags : []
    })
    items.value.sort((a, b) => a.household_id.localeCompare(b.household_id))
    return created
  }

  /** Suggest the next sequential household_id like "SI-0012". */
  function nextHouseholdId(): string {
    const max = items.value
      .map((h) => Number.parseInt(h.household_id.replace(/^SI-/, ''), 10))
      .filter((n) => !Number.isNaN(n))
      .reduce((a, b) => Math.max(a, b), 0)
    return `SI-${String(max + 1).padStart(4, '0')}`
  }

  return { items, loading, error, fetchAll, create, nextHouseholdId }
})
