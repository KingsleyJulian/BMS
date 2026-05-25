<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getPb } from '@/services/pocketbase'
import { formatDate } from '@/composables/formatDate'

interface BlotterRow {
  id: string
  collectionId: string
  case_no?: string
  date_time_occurred: string
  place_of_occurrence: string
  complainant_name: string
  created: string
}

const items = ref<BlotterRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const pb = await getPb()
    items.value = await pb
      .collection('blotter_entries')
      .getFullList<BlotterRow>({ sort: '-created' })
  } catch (e) {
    error.value = (e as Error).message
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())

const filtered = computed(() => {
  const q = search.value.trim().toUpperCase()
  if (!q) return items.value
  return items.value.filter((r) => {
    return (
      r.complainant_name.toUpperCase().includes(q) ||
      r.place_of_occurrence.toUpperCase().includes(q) ||
      (r.case_no ?? '').toUpperCase().includes(q) ||
      r.id.toUpperCase().includes(q)
    )
  })
})

// Case reference for the list row. Prefers the persisted YYYYMMDD-NNNNN
// case_no; falls back to the last 6 of the PB id for any legacy rows
// that pre-date the case_no field.
function caseRef(row: BlotterRow): string {
  return row.case_no ?? row.id.slice(-6).toUpperCase()
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[280px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.6"
          stroke="currentColor"
          class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        <input
          v-model="search"
          v-uppercase
          class="input-search"
          placeholder="SEARCH COMPLAINANT, PLACE OR CASE #..."
        />
      </div>
      <RouterLink :to="{ name: 'blotter-new' }" class="btn-primary">
        + New entry
      </RouterLink>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="text-left">
            <th class="smallcaps py-4 px-6">Case #</th>
            <th class="smallcaps py-4 px-6">Filed</th>
            <th class="smallcaps py-4 px-6">Date / Time of occurrence</th>
            <th class="smallcaps py-4 px-6">Place of occurrence</th>
            <th class="smallcaps py-4 px-6">Person reporting</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="py-12 text-center text-ink-600 text-sm">Loading…</td>
          </tr>
          <tr v-else-if="error">
            <td colspan="6" class="py-12 text-center text-maroon-accent text-sm">
              {{ error }}
            </td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td colspan="6" class="py-12 text-center text-ink-600 text-sm">
              No blotter entries on record yet. Use <em>+ New entry</em> to file one.
            </td>
          </tr>
          <tr
            v-for="row in filtered"
            v-else
            :key="row.id"
            class="border-t border-cream-200/70 hover:bg-cream-100/60 transition-colors"
          >
            <td class="py-3 px-6 font-mono text-sm tabular-nums">{{ caseRef(row) }}</td>
            <td class="py-3 px-6 text-sm tabular-nums">{{ formatDate(row.created) }}</td>
            <td class="py-3 px-6 text-sm tabular-nums">
              {{ formatDate(row.date_time_occurred) }}
            </td>
            <td class="py-3 px-6 text-sm uppercase">{{ row.place_of_occurrence }}</td>
            <td class="py-3 px-6 text-sm font-medium uppercase">{{ row.complainant_name }}</td>
            <td class="py-3 px-6 text-right">
              <RouterLink
                :to="{ name: 'blotter-report', params: { id: row.id } }"
                class="btn-primary inline-flex"
              >
                Report
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
