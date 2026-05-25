import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getPb } from '@/services/pocketbase'
import {
  DICTIONARY_CATEGORIES,
  type DictionaryCategory
} from '@/data/dictionaryCategories'

export interface DictionaryEntry {
  id: string
  category: DictionaryCategory
  value: string
}

export const useDictionaryStore = defineStore('dictionary', () => {
  const entries = ref<DictionaryEntry[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  /** Index keyed by category — used by AutocompleteInput for filtering. */
  const byCategory = computed(() => {
    const out: Record<DictionaryCategory, DictionaryEntry[]> = {
      RELIGION: [],
      BLOCK: [],
      STREET: [],
      ZIP_CODE: [],
      NATURE_OF_WORK: [],
      OCCUPATION: [],
      PURPOSE_OF_CLEARANCE: []
    }
    for (const e of entries.value) {
      if (DICTIONARY_CATEGORIES.includes(e.category)) out[e.category].push(e)
    }
    for (const cat of DICTIONARY_CATEGORIES) {
      out[cat].sort((a, b) => a.value.localeCompare(b.value))
    }
    return out
  })

  async function load(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const pb = await getPb()
      const list = await pb
        .collection('dictionaries')
        .getFullList<DictionaryEntry>({ sort: 'category,value' })
      entries.value = list
      loaded.value = true
    } catch {
      // PB not running yet or collection missing — leave empty.
    } finally {
      loading.value = false
    }
  }

  function findExisting(category: DictionaryCategory, value: string): DictionaryEntry | null {
    const v = value.trim().toUpperCase()
    if (!v) return null
    return entries.value.find((e) => e.category === category && e.value === v) ?? null
  }

  /**
   * Ensure a value exists for the category. Idempotent — does nothing when
   * the value is blank or already present. Returns the entry on success.
   */
  async function ensureEntry(
    category: DictionaryCategory,
    rawValue: string
  ): Promise<DictionaryEntry | null> {
    const value = rawValue.trim().toUpperCase()
    if (!value) return null
    const existing = findExisting(category, value)
    if (existing) return existing
    const pb = await getPb()
    const created = await pb
      .collection('dictionaries')
      .create<DictionaryEntry>({ category, value })
    entries.value.push(created)
    return created
  }

  async function updateEntry(id: string, rawValue: string): Promise<void> {
    const value = rawValue.trim().toUpperCase()
    if (!value) return
    const pb = await getPb()
    const updated = await pb
      .collection('dictionaries')
      .update<DictionaryEntry>(id, { value })
    const idx = entries.value.findIndex((e) => e.id === id)
    if (idx >= 0) entries.value[idx] = updated
  }

  async function deleteEntry(id: string): Promise<void> {
    const pb = await getPb()
    await pb.collection('dictionaries').delete(id)
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  return {
    entries,
    loaded,
    loading,
    byCategory,
    load,
    ensureEntry,
    updateEntry,
    deleteEntry
  }
})
