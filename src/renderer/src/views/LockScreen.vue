<script setup lang="ts">
import { computed } from 'vue'
import { useLicenseStore } from '@/stores/license'
import { formatDate } from '@/composables/formatDate'

const props = defineProps<{
  status: {
    state: 'expired' | 'tampered' | 'check-in-required'
    expiresAt?: string
    reason?: string
    daysSinceCheckIn?: number
  }
}>()

const license = useLicenseStore()

const message = computed(() => {
  switch (props.status.state) {
    case 'expired':
      return {
        title: 'License expired',
        body: `Your license expired on ${formatDate(props.status.expiresAt)}. Contact your administrator to renew.`
      }
    case 'tampered':
      return {
        title: 'License integrity check failed',
        body: 'The local license file appears to have been modified. Please re-activate.'
      }
    case 'check-in-required':
      return {
        title: 'Connect to the network',
        body: `This installation has not contacted the licensing server in ${props.status.daysSinceCheckIn} days. Connect to the internet and check in to continue.`
      }
  }
  return { title: 'Locked', body: '' }
})

async function tryCheckIn(): Promise<void> {
  await license.checkIn()
}
</script>

<template>
  <div class="h-full flex items-center justify-center bg-cream-100 p-10">
    <div class="card w-full max-w-lg p-10 text-center">
      <div
        class="w-14 h-14 mx-auto rounded-full bg-maroon-accent/10 text-maroon-accent flex items-center justify-center mb-5"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-7 h-7"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.5 10.5V7a4.5 4.5 0 10-9 0v3.5M5.25 10.5h13.5a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z"
          />
        </svg>
      </div>
      <h1 class="text-2xl text-ink-900">{{ message.title }}</h1>
      <p class="mt-3 text-sm text-ink-700">{{ message.body }}</p>

      <div v-if="status.state === 'check-in-required'" class="mt-6">
        <button class="btn-primary mx-auto" @click="tryCheckIn">Try check-in now</button>
      </div>
    </div>
  </div>
</template>
