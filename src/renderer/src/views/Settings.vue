<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useLicenseStore } from '@/stores/license'
import { useBarangayStore } from '@/stores/barangay'
import { formatDate } from '@/composables/formatDate'

const license = useLicenseStore()
const barangay = useBarangayStore()
const hardwareId = ref<string>('')

interface IdentityForm {
  name: string
  address: string
  monogram: string
  established: string
  punong_barangay_name: string
}

const form = reactive<IdentityForm>({
  name: '',
  address: '',
  monogram: '',
  established: '',
  punong_barangay_name: ''
})

const saving = ref(false)
const saveError = ref<string | null>(null)
const savedAt = ref<number | null>(null)

function syncFormFromStore(): void {
  const i = barangay.info
  form.name = barangay.hasInfo ? i.name : ''
  // Prefer the new single-line `address`; fall back to the legacy
  // muni+province pair so older rows pre-fill cleanly on first edit.
  // The form's "address" field is persisted in the `motto` column. Falls
  // back to the legacy muni+province pair on first edit of an old row.
  form.address = i.motto?.trim()
    ? i.motto
    : [i.municipality, i.province].filter((v) => !!v?.trim()).join(', ')
  form.monogram = barangay.hasInfo ? i.monogram ?? '' : ''
  form.established = i.established ?? ''
  form.punong_barangay_name = i.punong_barangay_name ?? ''
}

watch(
  () => [barangay.info.id, barangay.loaded],
  () => syncFormFromStore(),
  { immediate: true }
)

const canSave = computed(() => !!form.name.trim() && !saving.value)

async function saveIdentity(): Promise<void> {
  saveError.value = null
  saving.value = true
  try {
    await barangay.save({
      name: form.name.trim(),
      // Address is stored in the `motto` column.
      motto: form.address.trim(),
      // Clear the legacy split fields once the user saves.
      municipality: '',
      province: '',
      monogram: form.monogram.trim().toUpperCase(),
      established: form.established.trim(),
      punong_barangay_name: form.punong_barangay_name.trim()
    })
    savedAt.value = Date.now()
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  hardwareId.value = await window.bms.system.hardwareId()
})

async function checkInNow(): Promise<void> {
  await license.checkIn()
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <section class="card p-8">
      <h2 class="text-2xl mb-1">Barangay Identity</h2>
      <p class="text-sm text-ink-700 mb-6">
        These values drive the sidebar, header, window title, and certificate
        letterhead. Until a name is saved, the app shows
        <em>"Barangay Management System"</em> as a generic label.
      </p>

      <form class="grid grid-cols-1 md:grid-cols-2 gap-4" @submit.prevent="saveIdentity">
        <label class="block">
          <span class="smallcaps text-[10px]">Barangay name</span>
          <input
            v-model="form.name"
            type="text"
            required
            maxlength="120"
            placeholder="e.g. San Isidro"
            class="mt-1 w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          />
        </label>
        <label class="block">
          <span class="smallcaps text-[10px]">Monogram</span>
          <input
            v-model="form.monogram"
            type="text"
            maxlength="4"
            placeholder="e.g. SI"
            class="mt-1 w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm uppercase focus:outline-none focus:ring-2 focus:ring-maroon-500"
          />
        </label>
        <label class="block md:col-span-2">
          <span class="smallcaps text-[10px]">Address</span>
          <input
            v-model="form.address"
            type="text"
            maxlength="240"
            placeholder="e.g. Bacolor, Pampanga"
            class="mt-1 w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          />
        </label>
        <label class="block md:col-span-2">
          <span class="smallcaps text-[10px]">Established</span>
          <input
            v-model="form.established"
            type="text"
            maxlength="64"
            placeholder="e.g. Villa de Bacolor · Est. 1576"
            class="mt-1 w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          />
        </label>
        <label class="block md:col-span-2">
          <span class="smallcaps text-[10px]">Punong Barangay name</span>
          <input
            v-model="form.punong_barangay_name"
            type="text"
            maxlength="120"
            placeholder="Printed on the certificate signature line"
            class="mt-1 w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          />
        </label>

        <div class="md:col-span-2 flex items-center gap-3 mt-2">
          <button type="submit" class="btn-primary" :disabled="!canSave">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
          <span v-if="savedAt && !saving" class="text-xs text-ink-600">
            Saved.
          </span>
          <span v-if="saveError" class="text-xs text-maroon-accent">
            {{ saveError }}
          </span>
        </div>
      </form>
    </section>

    <section v-if="license.building" class="card p-8">
      <h2 class="text-2xl mb-4">Building</h2>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="smallcaps text-[10px]">Customer</dt>
          <dd class="font-medium">{{ license.building.customerName ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="smallcaps text-[10px]">Activation code</dt>
          <dd class="font-mono text-[12px]">{{ license.building.activationCode }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="smallcaps text-[10px]">Building / tenant ID</dt>
          <dd class="font-mono text-[11px] text-ink-700 truncate">
            {{ license.building.licenseId }}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="smallcaps text-[10px]">This device</dt>
          <dd class="font-medium">{{ license.building.deviceLabel ?? 'Unlabeled seat' }}</dd>
        </div>
      </dl>
    </section>

    <section class="card p-8">
      <h2 class="text-2xl mb-4">License</h2>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between">
          <dt class="smallcaps text-[10px]">Status</dt>
          <dd class="font-medium">{{ license.status?.state ?? '—' }}</dd>
        </div>
        <div v-if="license.isActive" class="flex justify-between">
          <dt class="smallcaps text-[10px]">Expires</dt>
          <dd class="tabular-nums">{{ formatDate((license.status as any).expiresAt) }}</dd>
        </div>
        <div v-if="license.isActive" class="flex justify-between">
          <dt class="smallcaps text-[10px]">Last check-in</dt>
          <dd class="tabular-nums">{{ formatDate((license.status as any).lastCheckInAt) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="smallcaps text-[10px]">Hardware ID</dt>
          <dd class="font-mono text-[11px] text-ink-700 truncate">{{ hardwareId }}</dd>
        </div>
      </dl>

      <button class="btn-primary mt-6" @click="checkInNow">Check in with server</button>
    </section>

    <section class="card p-8">
      <h2 class="text-2xl mb-2">About</h2>
      <p class="text-sm text-ink-700">
        BMS v0.1 · Pilot — local-first Barangay Management System.
      </p>
    </section>
  </div>
</template>
