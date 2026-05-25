<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useResidentsStore } from '@/stores/residents'
import RegisterHouseholdModal from '@/components/RegisterHouseholdModal.vue'

const residents = useResidentsStore()

const search = ref('')
const filter = ref<'All' | 'SENIOR' | '4PS' | 'PWD' | 'PENDING'>('All')
const modalOpen = ref(false)

onMounted(() => {
  void residents.fetchAll()
})

const filtered = computed(() =>
  residents.items.filter((h) => {
    const matchSearch =
      !search.value ||
      h.head_of_family.toLowerCase().includes(search.value.toLowerCase()) ||
      h.household_id.toLowerCase().includes(search.value.toLowerCase())
    const matchFilter = filter.value === 'All' || h.flags.includes(filter.value)
    return matchSearch && matchFilter
  })
)

function pillClass(flag: string): string {
  return (
    {
      SENIOR: 'pill pill-senior',
      '4PS': 'pill pill-4ps',
      PWD: 'pill pill-pwd',
      PENDING: 'pill pill-pending'
    }[flag] ?? 'pill'
  )
}
</script>

<template>
  <div class="space-y-6 max-w-[1400px]">
    <div class="flex items-center gap-4">
      <div class="relative flex-1">
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
          placeholder="SEARCH HEAD OF FAMILY OR HOUSEHOLD ID..."
        />
      </div>

      <select v-model="filter" class="select-base">
        <option value="All">All</option>
        <option value="SENIOR">Senior</option>
        <option value="4PS">4Ps</option>
        <option value="PWD">PWD</option>
        <option value="PENDING">Pending</option>
      </select>

      <button class="btn-primary" @click="modalOpen = true">
        <span class="text-base leading-none">+</span>
        <span>Register household</span>
      </button>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="text-left">
            <th class="smallcaps text-[10px] py-4 px-6">Household</th>
            <th class="smallcaps text-[10px] py-4 px-6">Head of Family</th>
            <th class="smallcaps text-[10px] py-4 px-6">Purok</th>
            <th class="smallcaps text-[10px] py-4 px-6">Members</th>
            <th class="smallcaps text-[10px] py-4 px-6">Flags</th>
            <th class="smallcaps text-[10px] py-4 px-6">Contact</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="residents.loading">
            <td colspan="7" class="py-12 text-center text-ink-600 text-sm">
              <span class="smallcaps">Loading…</span>
            </td>
          </tr>
          <tr v-else-if="residents.error">
            <td colspan="7" class="py-12 text-center text-maroon-accent text-sm">
              Could not reach PocketBase: {{ residents.error }}
            </td>
          </tr>
          <tr
            v-else
            v-for="h in filtered"
            :key="h.id"
            class="border-t border-cream-200/70 hover:bg-cream-100/60 transition-colors"
          >
            <td class="py-4 px-6 smallcaps text-[11px] text-ink-700">{{ h.household_id }}</td>
            <td class="py-4 px-6 font-medium text-ink-900">{{ h.head_of_family }}</td>
            <td class="py-4 px-6 text-ink-800">{{ h.purok }}</td>
            <td class="py-4 px-6 italic text-ink-800">{{ h.members }}</td>
            <td class="py-4 px-6">
              <div class="flex gap-1.5 flex-wrap">
                <span v-for="flag in h.flags" :key="flag" :class="pillClass(flag)">
                  {{ flag }}
                </span>
              </div>
            </td>
            <td class="py-4 px-6 text-ink-800 tabular-nums">{{ h.contact }}</td>
            <td class="py-4 px-6 text-right">
              <button class="text-maroon-accent hover:text-maroon-700 text-sm font-medium">
                View ›
              </button>
            </td>
          </tr>
          <tr v-if="!residents.loading && !residents.error && filtered.length === 0">
            <td colspan="7" class="py-12 text-center text-ink-600 text-sm">
              No households match the current filter.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <RegisterHouseholdModal :open="modalOpen" @close="modalOpen = false" />
  </div>
</template>
