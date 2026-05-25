<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useBarangayStore } from '@/stores/barangay'

const route = useRoute()
const barangay = useBarangayStore()

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  'barangay-clearance': 'Barangay Clearance',
  citizens: 'Citizens',
  certificate: 'Barangay Certification',
  blotter: 'Blotter & Mediation',
  'blotter-new': 'New Blotter Entry',
  'blotter-report': 'Blotter Report',
  'blotter-mediation-new': 'Invitation to Mediate',
  'blotter-mediation': 'Invitation to Mediate',
  clearances: 'Clearances',
  health: 'Health & Social Services',
  disaster: 'Disaster Watch',
  sessions: 'Session Minutes',
  budget: 'Budget & SK',
  settings: 'Settings'
}

const heading = computed(() => ({
  eyebrow: barangay.displayLabel,
  title: pageTitles[route.name as string] ?? ''
}))
</script>

<template>
  <header class="px-10 pt-8 pb-4 flex items-start justify-between gap-6">
    <div>
      <div class="smallcaps text-[11px]">{{ heading.eyebrow }}</div>
      <h1 class="mt-1 text-4xl font-semibold text-ink-900">{{ heading.title }}</h1>
    </div>

    <div class="flex items-center gap-4">
      <button
        class="w-10 h-10 grid place-items-center rounded-lg border border-cream-300 bg-cream-50 text-ink-700 hover:bg-cream-200 transition"
        title="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.6"
          stroke="currentColor"
          class="w-5 h-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
      </button>

      <div
        class="flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border border-cream-300 bg-cream-50"
      >
        <div
          class="w-9 h-9 rounded-full bg-maroon-accent text-cream-50 flex items-center justify-center text-sm font-medium"
        >
          JH
        </div>
        <div class="leading-tight">
          <div class="text-sm font-medium">Kap. Hernandez</div>
          <div class="text-[11px] text-ink-600">Punong Barangay</div>
        </div>
      </div>
    </div>
  </header>
</template>
