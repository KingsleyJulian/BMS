<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useLicenseStore } from '@/stores/license'

const license = useLicenseStore()
const code = ref('')
const deviceLabel = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const hardwareId = ref<string>('')

onMounted(async () => {
  hardwareId.value = await window.bms.system.hardwareId()
})

async function submit(): Promise<void> {
  if (!code.value.trim()) return
  submitting.value = true
  error.value = null
  const res = await license.activate(code.value.trim(), deviceLabel.value.trim() || undefined)
  submitting.value = false
  if (!res.ok) error.value = res.reason ?? 'Activation failed'
}
</script>

<template>
  <div class="h-full flex items-center justify-center bg-cream-100 p-10">
    <div class="card w-full max-w-lg p-10">
      <div class="flex items-center gap-3 mb-6">
        <div
          class="w-12 h-12 rounded-full bg-gold-500 text-maroon-900 flex items-center justify-center font-semibold text-lg"
        >
          SI
        </div>
        <div>
          <div class="smallcaps text-[10px]">License Portal</div>
          <h1 class="text-2xl font-semibold">Activate this device</h1>
        </div>
      </div>

      <p class="text-sm text-ink-700 mb-6">
        Each building (barangay) has one activation code that is shared across all of its
        computers. Every device that activates with the same code joins the same building tenant
        and shares the building's roster of households, blotter records, and clearances.
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="smallcaps text-[10px]">Activation code (per building)</span>
          <input
            v-model="code"
            v-uppercase
            type="text"
            class="mt-1 input-search pl-4"
            placeholder="BMS-PILOT-2026-0001"
            autocomplete="off"
            spellcheck="false"
          />
        </label>

        <label class="block">
          <span class="smallcaps text-[10px]">Device label (optional)</span>
          <input
            v-model="deviceLabel"
            v-uppercase
            type="text"
            class="mt-1 input-search pl-4"
            placeholder="E.G. FRONT DESK PC, KAPITAN'S OFFICE"
          />
        </label>

        <div v-if="license.status?.state === 'wrong-machine'" class="text-sm text-maroon-accent">
          The existing license on this folder belongs to a different machine. Re-enter your code
          to bind it here.
        </div>

        <div v-if="error" class="text-sm text-maroon-accent">{{ error }}</div>

        <button class="btn-primary w-full justify-center" :disabled="submitting">
          {{ submitting ? 'Activating…' : 'Activate device' }}
        </button>
      </form>

      <div class="mt-8 pt-6 border-t border-cream-300/70">
        <div class="smallcaps text-[10px] mb-1">This machine's hardware ID</div>
        <code class="text-[11px] text-ink-700 break-all">{{ hardwareId }}</code>
      </div>
    </div>
  </div>
</template>
