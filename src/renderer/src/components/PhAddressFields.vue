<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchProvinces, fetchCities, fetchBarangays, type PsgcEntry } from '@/services/psgc'

// A trio of cascading searchable selects backed by the public PSGC API.
// Emits the chosen NAMES (not codes) via `update:city` and `update:barangay`
// so the existing `clearance_applications` schema doesn't need to change.
//
// If the API is unreachable, each select degrades to a plain text input so
// the user can still type the address freely — local-first first principle.
const props = withDefaults(
  defineProps<{
    city: string
    barangay: string
    disabled?: boolean
  }>(),
  { disabled: false }
)
const emit = defineEmits<{
  'update:city': [string]
  'update:barangay': [string]
}>()

const provinces = ref<PsgcEntry[]>([])
const cities = ref<PsgcEntry[]>([])
const barangays = ref<PsgcEntry[]>([])

const provinceCode = ref<string>('')
const cityCode = ref<string>('')

const provinceQuery = ref('')
const cityQuery = ref(props.city)
const barangayQuery = ref(props.barangay)

const offline = ref(false)
const loading = ref<'provinces' | 'cities' | 'barangays' | null>(null)

const provinceOpen = ref(false)
const cityOpen = ref(false)
const barangayOpen = ref(false)

// Match props back into the local query refs when the parent resets the form.
watch(
  () => props.city,
  (v) => {
    if (v !== cityQuery.value) cityQuery.value = v
  }
)
watch(
  () => props.barangay,
  (v) => {
    if (v !== barangayQuery.value) barangayQuery.value = v
  }
)

async function loadProvinces(): Promise<void> {
  if (provinces.value.length || offline.value) return
  loading.value = 'provinces'
  try {
    provinces.value = await fetchProvinces()
  } catch {
    offline.value = true
  } finally {
    loading.value = null
  }
}

async function loadCities(code: string): Promise<void> {
  loading.value = 'cities'
  try {
    cities.value = await fetchCities(code)
  } catch {
    cities.value = []
    offline.value = true
  } finally {
    loading.value = null
  }
}

async function loadBarangays(code: string): Promise<void> {
  loading.value = 'barangays'
  try {
    barangays.value = await fetchBarangays(code)
  } catch {
    barangays.value = []
    offline.value = true
  } finally {
    loading.value = null
  }
}

void loadProvinces()

const filteredProvinces = computed(() => filterByName(provinces.value, provinceQuery.value))
const filteredCities = computed(() => filterByName(cities.value, cityQuery.value))
const filteredBarangays = computed(() => filterByName(barangays.value, barangayQuery.value))

function filterByName(list: PsgcEntry[], q: string): PsgcEntry[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return list.slice(0, 50)
  return list.filter((e) => e.name.toLowerCase().includes(needle)).slice(0, 50)
}

function pickProvince(p: PsgcEntry): void {
  provinceCode.value = p.code
  provinceQuery.value = p.name
  provinceOpen.value = false
  cityCode.value = ''
  cities.value = []
  barangays.value = []
  cityQuery.value = ''
  barangayQuery.value = ''
  emit('update:city', '')
  emit('update:barangay', '')
  void loadCities(p.code)
}

function pickCity(c: PsgcEntry): void {
  cityCode.value = c.code
  cityQuery.value = c.name
  cityOpen.value = false
  barangays.value = []
  barangayQuery.value = ''
  emit('update:city', c.name)
  emit('update:barangay', '')
  void loadBarangays(c.code)
}

function pickBarangay(b: PsgcEntry): void {
  barangayQuery.value = b.name
  barangayOpen.value = false
  emit('update:barangay', b.name)
}

// In offline / free-text mode the inputs just emit whatever the user types.
function onCityInput(): void {
  emit('update:city', cityQuery.value)
}
function onBarangayInput(): void {
  emit('update:barangay', barangayQuery.value)
}
</script>

<template>
  <div class="grid grid-cols-12 gap-4">
    <!-- Province -->
    <label class="block col-span-4 relative">
      <span class="smallcaps">Province</span>
      <input
        v-model="provinceQuery"
        :disabled="props.disabled || offline"
        :placeholder="offline ? 'Offline — enter manually' : 'Search province…'"
        class="mt-1 input-search pl-4 disabled:cursor-not-allowed"
        autocomplete="off"
        @focus="provinceOpen = true"
        @input="provinceOpen = true"
      />
      <div
        v-if="provinceOpen && !offline && filteredProvinces.length"
        class="absolute top-full left-0 right-0 mt-1 card p-1 z-30 max-h-60 overflow-auto shadow-lg"
      >
        <button
          v-for="p in filteredProvinces"
          :key="p.code"
          type="button"
          class="block w-full text-left px-3 py-1.5 hover:bg-cream-200 rounded text-sm"
          @click="pickProvince(p)"
        >
          {{ p.name }}
        </button>
      </div>
      <div v-if="loading === 'provinces'" class="text-[10px] text-ink-600 mt-1">
        Loading provinces…
      </div>
    </label>

    <!-- City / Municipality -->
    <label class="block col-span-4 relative">
      <span class="smallcaps">City / Municipality *</span>
      <input
        v-model="cityQuery"
        v-uppercase
        :disabled="props.disabled"
        class="mt-1 input-search pl-4 disabled:cursor-not-allowed"
        autocomplete="off"
        @focus="cityOpen = true"
        @input="cityOpen = true; onCityInput()"
      />
      <div
        v-if="cityOpen && !offline && provinceCode && filteredCities.length"
        class="absolute top-full left-0 right-0 mt-1 card p-1 z-30 max-h-60 overflow-auto shadow-lg"
      >
        <button
          v-for="c in filteredCities"
          :key="c.code"
          type="button"
          class="block w-full text-left px-3 py-1.5 hover:bg-cream-200 rounded text-sm"
          @click="pickCity(c)"
        >
          {{ c.name }}
        </button>
      </div>
      <div v-if="loading === 'cities'" class="text-[10px] text-ink-600 mt-1">
        Loading cities…
      </div>
    </label>

    <!-- Barangay -->
    <label class="block col-span-4 relative">
      <span class="smallcaps">Barangay</span>
      <input
        v-model="barangayQuery"
        v-uppercase
        :disabled="props.disabled"
        class="mt-1 input-search pl-4 disabled:cursor-not-allowed"
        autocomplete="off"
        @focus="barangayOpen = true"
        @input="barangayOpen = true; onBarangayInput()"
      />
      <div
        v-if="barangayOpen && !offline && cityCode && filteredBarangays.length"
        class="absolute top-full left-0 right-0 mt-1 card p-1 z-30 max-h-60 overflow-auto shadow-lg"
      >
        <button
          v-for="b in filteredBarangays"
          :key="b.code"
          type="button"
          class="block w-full text-left px-3 py-1.5 hover:bg-cream-200 rounded text-sm"
          @click="pickBarangay(b)"
        >
          {{ b.name }}
        </button>
      </div>
      <div v-if="loading === 'barangays'" class="text-[10px] text-ink-600 mt-1">
        Loading barangays…
      </div>
    </label>
  </div>
</template>
