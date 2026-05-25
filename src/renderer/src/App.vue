<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useLicenseStore } from './stores/license'
import { useBarangayStore } from './stores/barangay'
import { useDictionaryStore } from './stores/dictionary'
import LockScreen from './views/LockScreen.vue'
import LicensePortal from './views/LicensePortal.vue'
import AppShell from './components/layout/AppShell.vue'

const license = useLicenseStore()
const barangay = useBarangayStore()
const dictionary = useDictionaryStore()

onMounted(async () => {
  await Promise.all([license.refresh(), barangay.load(), dictionary.load()])
})

watchEffect(() => {
  document.title = barangay.hasInfo
    ? `${barangay.info.name} · BMS`
    : barangay.displayLabel
})
</script>

<template>
  <div class="h-full">
    <template v-if="license.loading">
      <div class="h-full flex items-center justify-center bg-cream-100 text-ink-700">
        <span class="smallcaps text-sm">Loading…</span>
      </div>
    </template>

    <!-- TEMP: activation/lock gate disabled so the app opens without a license.
         Restore by uncommenting the two branches below (and remove the unconditional AppShell). -->
    <!-- <LicensePortal v-else-if="license.needsActivation" /> -->

    <!-- <LockScreen v-else-if="license.isLocked" :status="license.status!" /> -->

    <AppShell v-else />
  </div>
</template>
