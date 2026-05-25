<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getPb } from '@/services/pocketbase'
import FilterDropdown from '@/components/FilterDropdown.vue'
import { formatDate } from '@/composables/formatDate'

interface CitizenRow {
  id: string
  collectionId: string
  // Personal
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string
  gender?: string
  civil_status: string
  religion?: string
  spouse_maiden_name?: string
  spouse_phone?: string
  // Address
  house_no: string
  block: string
  street: string
  address_barangay: string
  city: string
  zip_code?: string
  // Mailing
  mailing_same_as_address?: boolean
  mailing_house_no?: string
  mailing_block?: string
  mailing_street?: string
  mailing_address_barangay?: string
  mailing_city?: string
  mailing_zip_code?: string
  // Contact
  contact_number: string
  email?: string
  messenger?: string
  viber?: string
  whatsapp?: string
  // Employment
  nature_of_work?: string
  occupation?: string
  // Residency
  months_of_residency?: number
  // Purpose
  purpose_of_clearance?: string
  // Photo
  profile_photo?: string
  created: string
}

interface IdDocument {
  id: string
  collectionId: string
  type: string
  name: string
  group?: string
  number: string
  expiry?: string
  photo?: string
}

const route = useRoute()
const router = useRouter()

const items = ref<CitizenRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const viewMode = ref<'table' | 'gallery'>('table')
const sortBy = ref<'name' | 'recent'>('recent')

// Address filter state — each field is a substring match (case-insensitive),
// applied with AND logic so all non-empty fields must hit.
const filtersOpen = ref(false)
const addressFilters = reactive({
  house_no: '',
  block: '',
  street: '',
  address_barangay: '',
  city: ''
})

const ADDRESS_FILTER_KEYS = [
  'house_no',
  'block',
  'street',
  'address_barangay',
  'city'
] as const

/**
 * Distinct address-field values discovered across the loaded citizens.
 * Drives the FilterDropdown options so the user can only pick a value
 * that actually exists somewhere in the data.
 */
const distinctValues = computed(() => {
  const sets: Record<(typeof ADDRESS_FILTER_KEYS)[number], Set<string>> = {
    house_no: new Set(),
    block: new Set(),
    street: new Set(),
    address_barangay: new Set(),
    city: new Set()
  }
  for (const c of items.value) {
    for (const k of ADDRESS_FILTER_KEYS) {
      const raw = (c as Record<string, unknown>)[k]
      if (typeof raw === 'string' && raw.trim()) sets[k].add(raw.trim().toUpperCase())
    }
  }
  const out: Record<(typeof ADDRESS_FILTER_KEYS)[number], string[]> = {
    house_no: [],
    block: [],
    street: [],
    address_barangay: [],
    city: []
  }
  for (const k of ADDRESS_FILTER_KEYS) {
    out[k] = [...sets[k]].sort((a, b) => a.localeCompare(b))
  }
  return out
})

/**
 * Smart token-based match used for street / barangay / city.
 *
 * Common street suffixes are dropped before matching so that a filter of
 * "ANGELES ST" still hits records stored as just "ANGELES" — they share
 * the only significant token. If every filter token is a stopword we
 * fall back to a plain substring search.
 */
const STREET_STOPWORDS = new Set([
  'ST', 'STR', 'STREET',
  'AVE', 'AVENUE',
  'RD', 'ROAD',
  'BLVD', 'BOULEVARD',
  'DR', 'DRIVE',
  'LN', 'LANE',
  'HWY', 'HIGHWAY',
  'CT', 'COURT',
  'PHASE', 'PH',
  'BLOCK', 'BLK',
  'LOT'
])

function tokenize(s: string): string[] {
  return s
    .toUpperCase()
    .replace(/\./g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
}

function smartTokenMatch(fieldValue: string, filterValue: string): boolean {
  if (!filterValue) return true
  if (!fieldValue) return false
  const fieldTokens = new Set(tokenize(fieldValue))
  const filterTokens = tokenize(filterValue)
  const significant = filterTokens.filter((t) => !STREET_STOPWORDS.has(t))
  if (significant.length === 0) {
    return fieldValue.toUpperCase().includes(filterValue.toUpperCase())
  }
  return significant.every((t) => fieldTokens.has(t))
}

const SMART_FIELDS: ReadonlySet<string> = new Set(['street', 'address_barangay', 'city'])

// Age range — strings so the inputs can be cleared cleanly. Empty = unbounded.
const ageMin = ref('')
const ageMax = ref('')

// Gender filter — empty string = any gender.
const genderFilter = ref<'' | 'MALE' | 'FEMALE'>('')

function computeAge(dob: string): number {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return Number.NaN
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const monthDelta = now.getMonth() - d.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d.getDate())) age--
  return age
}

const activeFilterCount = computed(() => {
  let n = 0
  for (const k of ADDRESS_FILTER_KEYS) if (addressFilters[k].trim()) n++
  if (ageMin.value.trim()) n++
  if (ageMax.value.trim()) n++
  if (genderFilter.value) n++
  return n
})

function clearAddressFilters(): void {
  for (const k of ADDRESS_FILTER_KEYS) addressFilters[k] = ''
  ageMin.value = ''
  ageMax.value = ''
  genderFilter.value = ''
}

// Contact action modal state
const contactMenuRow = ref<CitizenRow | null>(null)
const copyState = ref<'idle' | 'copied' | 'error'>('idle')

// Applicant detail modal state
const detailRow = ref<CitizenRow | null>(null)
const detailIds = ref<IdDocument[]>([])
const detailIdsLoading = ref(false)

function openDetail(row: CitizenRow): void {
  detailRow.value = row
  detailIds.value = []
  void loadIdDocuments(row.id)
}

function closeDetail(): void {
  detailRow.value = null
  detailIds.value = []
}

async function loadIdDocuments(applicationId: string): Promise<void> {
  detailIdsLoading.value = true
  try {
    const pb = await getPb()
    const filter = pb.filter('clearance = {:id}', { id: applicationId })
    detailIds.value = await pb
      .collection('id_documents')
      .getFullList<IdDocument>({ filter, sort: 'created' })
  } catch {
    detailIds.value = []
  } finally {
    detailIdsLoading.value = false
  }
}

function profilePhotoFull(row: CitizenRow): string | null {
  if (!row.profile_photo) return null
  return `${pbBaseUrl}/api/files/${row.collectionId}/${row.id}/${row.profile_photo}`
}

function idPhotoUrl(doc: IdDocument): string | null {
  if (!doc.photo) return null
  return `${pbBaseUrl}/api/files/${doc.collectionId}/${doc.id}/${doc.photo}?thumb=600x600`
}

function mailingAddress(row: CitizenRow): string {
  if (row.mailing_same_as_address) return 'Same as full address'
  return [
    [row.mailing_house_no, row.mailing_block].filter(Boolean).join(' '),
    row.mailing_street,
    row.mailing_address_barangay,
    row.mailing_city,
    row.mailing_zip_code
  ]
    .filter(Boolean)
    .join(', ') || '—'
}

function fullAddressLong(row: CitizenRow): string {
  return [
    [row.house_no, row.block].filter(Boolean).join(' '),
    row.street,
    row.address_barangay,
    row.city,
    row.zip_code
  ]
    .filter(Boolean)
    .join(', ')
}

function residencyText(row: CitizenRow): string {
  const m = row.months_of_residency
  if (!m) return '—'
  const years = Math.floor(m / 12)
  const months = m - years * 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`)
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' and ') : '<1 month'
}

function openContactMenu(row: CitizenRow): void {
  if (!row.contact_number) return
  copyState.value = 'idle'
  contactMenuRow.value = row
}

function closeContactMenu(): void {
  contactMenuRow.value = null
  copyState.value = 'idle'
}

async function copyContactNumber(): Promise<void> {
  const phone = contactMenuRow.value?.contact_number
  if (!phone) return

  // Try the modern Clipboard API first.
  try {
    await navigator.clipboard.writeText(phone)
    copyState.value = 'copied'
    setTimeout(closeContactMenu, 800)
    return
  } catch {
    /* fall through to legacy fallback */
  }

  // Fallback for environments where navigator.clipboard is blocked
  // (CSP, missing permissions, non-focused doc): hidden textarea + the
  // legacy execCommand path. Still works in Electron's renderer today.
  try {
    const ta = document.createElement('textarea')
    ta.value = phone
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    copyState.value = ok ? 'copied' : 'error'
    if (ok) setTimeout(closeContactMenu, 800)
  } catch {
    copyState.value = 'error'
  }
}

function fullNameOf(row: CitizenRow): string {
  return [row.first_name, row.middle_name, row.last_name, row.suffix]
    .filter(Boolean)
    .join(' ')
}

let pbBaseUrl = ''

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const pb = await getPb()
    pbBaseUrl = pb.baseUrl
    items.value = await pb
      .collection('clearance_applications')
      .getFullList<CitizenRow>({ sort: '-created' })
  } catch (e) {
    error.value = (e as Error).message
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Pre-fill the search from query params (e.g. arriving from the duplicate
  // warning in BarangayClearance).
  const parts = [
    String(route.query.first ?? ''),
    String(route.query.middle ?? ''),
    String(route.query.last ?? '')
  ].filter(Boolean)
  if (parts.length) search.value = parts.join(' ')
  void load()
})

watch(() => route.query, (q) => {
  const parts = [String(q.first ?? ''), String(q.middle ?? ''), String(q.last ?? '')].filter(
    Boolean
  )
  if (parts.length) search.value = parts.join(' ')
})

const filtered = computed(() => {
  const q = search.value.trim().toUpperCase()
  let matched = !q
    ? items.value
    : items.value.filter((c) => {
        const fullName = `${c.first_name} ${c.middle_name ?? ''} ${c.last_name} ${c.suffix ?? ''}`
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase()
        return fullName.includes(q) || c.id.toUpperCase().includes(q)
      })

  // Address-component filters — smart token match for free-form fields
  // (street/barangay/city), plain substring for short identifiers
  // (house_no, block).
  for (const key of ADDRESS_FILTER_KEYS) {
    const needle = addressFilters[key].trim()
    if (!needle) continue
    matched = matched.filter((c) => {
      const haystack = String((c as Record<string, unknown>)[key] ?? '')
      if (SMART_FIELDS.has(key)) return smartTokenMatch(haystack, needle)
      return haystack.toUpperCase().includes(needle.toUpperCase())
    })
  }

  // Age range — bounds inclusive; either side can be left blank.
  const min = parseInt(ageMin.value.trim(), 10)
  const max = parseInt(ageMax.value.trim(), 10)
  const hasMin = Number.isFinite(min)
  const hasMax = Number.isFinite(max)
  if (hasMin || hasMax) {
    matched = matched.filter((c) => {
      if (!c.date_of_birth) return false
      const age = computeAge(c.date_of_birth)
      if (Number.isNaN(age)) return false
      if (hasMin && age < min) return false
      if (hasMax && age > max) return false
      return true
    })
  }

  // Gender — exact match. Records without a stored gender drop out when a
  // filter is active.
  if (genderFilter.value) {
    matched = matched.filter((c) => c.gender === genderFilter.value)
  }

  const arr = matched.slice()
  if (sortBy.value === 'name') {
    arr.sort((a, b) => {
      const aKey = `${a.last_name} ${a.first_name}`.toLowerCase()
      const bKey = `${b.last_name} ${b.first_name}`.toLowerCase()
      return aKey.localeCompare(bKey)
    })
  } else {
    arr.sort((a, b) => (b.created || '').localeCompare(a.created || ''))
  }
  return arr
})

function photoUrl(row: CitizenRow): string | null {
  if (!row.profile_photo) return null
  return `${pbBaseUrl}/api/files/${row.collectionId}/${row.id}/${row.profile_photo}?thumb=100x100`
}

function newApplication(): void {
  void router.push('/barangay-clearance')
}

function fullAddress(row: CitizenRow): string {
  return [
    [row.house_no, row.block].filter(Boolean).join(' '),
    row.street,
    row.address_barangay,
    row.city
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * Normalize a Philippine phone number to international format (digits
 * only). Handles common local conventions: starts with `0` → swap with
 * `63`; bare 10-digit local number → prepend `63`; already-international
 * → leave alone. Anything non-digit (spaces, dashes, +) is stripped.
 */
function toIntlPhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('63')) return digits
  if (digits.startsWith('0')) return '63' + digits.slice(1)
  if (digits.length === 10) return '63' + digits
  return digits
}

function viberUrl(phone: string): string {
  const intl = toIntlPhone(phone)
  // viber://chat?number=+<intl> — the leading `+` must be URL-encoded.
  return intl ? `viber://chat?number=%2B${intl}` : ''
}

function whatsappUrl(phone: string): string {
  const intl = toIntlPhone(phone)
  // wa.me redirects to the WhatsApp Desktop / Web client cleanly.
  return intl ? `https://wa.me/${intl}` : ''
}

function telegramUrl(phone: string): string {
  const intl = toIntlPhone(phone)
  // tg://resolve?phone=… opens a chat in Telegram Desktop.
  return intl ? `tg://resolve?phone=${intl}` : ''
}

/**
 * Build a Google Maps "search" URL pre-loaded with the citizen's full
 * address. The page opens with the location pinned. Anchors with
 * target="_blank" are routed through main's setWindowOpenHandler →
 * shell.openExternal so the link lands in the OS default browser instead
 * of a new Electron window.
 */
function mapsUrl(row: CitizenRow): string {
  const parts = [
    [row.house_no, row.block].filter(Boolean).join(' '),
    row.street,
    row.address_barangay,
    row.city,
    row.zip_code,
    'Philippines'
  ].filter(Boolean)
  if (parts.length === 0) return ''
  const query = encodeURIComponent(parts.join(', '))
  return `https://www.google.com/maps/search/?api=1&query=${query}`
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
          placeholder="SEARCH NAME OR ID..."
        />
      </div>

      <select v-model="sortBy" class="select-base">
        <option value="recent">Sort: Most recent</option>
        <option value="name">Sort: Name (A → Z)</option>
      </select>

      <button
        type="button"
        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors"
        :class="
          filtersOpen || activeFilterCount > 0
            ? 'bg-maroon-accent text-cream-50 border-maroon-accent'
            : 'bg-cream-50 text-ink-700 border-cream-300 hover:bg-cream-200'
        "
        @click="filtersOpen = !filtersOpen"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.8"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
          />
        </svg>
        <span>Filters</span>
        <span
          v-if="activeFilterCount > 0"
          class="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-cream-50 text-maroon-accent text-[11px] font-bold"
        >{{ activeFilterCount }}</span>
      </button>

      <!-- View mode toggle -->
      <div
        class="inline-flex p-1 bg-cream-50 border border-cream-300 rounded-lg text-sm"
        role="tablist"
        aria-label="View mode"
      >
        <button
          type="button"
          :class="
            viewMode === 'table'
              ? 'bg-maroon-accent text-cream-50'
              : 'text-ink-700 hover:bg-cream-200'
          "
          class="px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
          @click="viewMode = 'table'"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.8"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
          Table
        </button>
        <button
          type="button"
          :class="
            viewMode === 'gallery'
              ? 'bg-maroon-accent text-cream-50'
              : 'text-ink-700 hover:bg-cream-200'
          "
          class="px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
          @click="viewMode = 'gallery'"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.8"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
          Gallery
        </button>
      </div>

      <button class="btn-primary" @click="newApplication">+ New application</button>
    </div>

    <!-- Filter panel — substring-matches each address component + age range -->
    <div v-if="filtersOpen" class="card p-5 space-y-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold">Filters</h3>
          <p class="text-xs text-ink-600">
            All non-empty filters are combined (AND). Address fields do partial,
            case-insensitive matching. Age is computed from date of birth.
          </p>
        </div>
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="text-xs text-maroon-accent hover:text-maroon-700"
          @click="clearAddressFilters"
        >
          Clear all
        </button>
      </div>

      <div>
        <div class="smallcaps mb-2">By address</div>
        <p class="text-[11px] text-ink-600 mb-2">
          Each dropdown is populated from values that actually exist in the loaded citizens.
          For street / barangay / city, picking "Angeles St" also matches records stored as
          "Angeles" — common road suffixes (St, Ave, Rd…) are ignored so shared keywords
          still hit.
        </p>
        <div class="grid grid-cols-12 gap-3">
          <label class="col-span-2 block">
            <span class="smallcaps">House / Lot No.</span>
            <FilterDropdown
              v-model="addressFilters.house_no"
              :options="distinctValues.house_no"
              class="mt-1"
            />
          </label>
          <label class="col-span-2 block">
            <span class="smallcaps">Block</span>
            <FilterDropdown
              v-model="addressFilters.block"
              :options="distinctValues.block"
              class="mt-1"
            />
          </label>
          <label class="col-span-3 block">
            <span class="smallcaps">Street</span>
            <FilterDropdown
              v-model="addressFilters.street"
              :options="distinctValues.street"
              class="mt-1"
            />
          </label>
          <label class="col-span-3 block">
            <span class="smallcaps">Barangay</span>
            <FilterDropdown
              v-model="addressFilters.address_barangay"
              :options="distinctValues.address_barangay"
              class="mt-1"
            />
          </label>
          <label class="col-span-2 block">
            <span class="smallcaps">City</span>
            <FilterDropdown
              v-model="addressFilters.city"
              :options="distinctValues.city"
              class="mt-1"
            />
          </label>
        </div>
      </div>

      <div>
        <div class="smallcaps mb-2">By age</div>
        <div class="grid grid-cols-12 gap-3">
          <label class="col-span-2 block">
            <span class="smallcaps">Min age</span>
            <input
              v-model="ageMin"
              type="number"
              min="0"
              max="150"
              class="mt-1 input-search pl-4 tabular-nums"
              placeholder="0"
            />
          </label>
          <label class="col-span-2 block">
            <span class="smallcaps">Max age</span>
            <input
              v-model="ageMax"
              type="number"
              min="0"
              max="150"
              class="mt-1 input-search pl-4 tabular-nums"
              placeholder="120"
            />
          </label>
          <p class="col-span-8 self-end text-[11px] text-ink-600 pb-1">
            Computed from each applicant's date of birth at today's date. Leave a side blank
            for an open-ended range.
          </p>
        </div>
      </div>

      <div>
        <div class="smallcaps mb-2">By gender</div>
        <div class="flex items-center gap-2">
          <button
            v-for="opt in [
              { value: '', label: 'Any' },
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' }
            ]"
            :key="opt.value"
            type="button"
            class="px-4 py-1.5 rounded-lg text-sm border transition-colors"
            :class="
              genderFilter === opt.value
                ? 'bg-maroon-accent text-cream-50 border-maroon-accent'
                : 'bg-cream-50 text-ink-700 border-cream-300 hover:bg-cream-200'
            "
            @click="genderFilter = opt.value as '' | 'MALE' | 'FEMALE'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Gallery view: grid of profile-photo cards -->
    <div v-if="viewMode === 'gallery'">
      <div v-if="loading" class="card p-12 text-center text-ink-600 text-sm">Loading…</div>
      <div v-else-if="error" class="card p-12 text-center text-maroon-accent text-sm">
        {{ error }}
      </div>
      <div v-else-if="filtered.length === 0" class="card p-12 text-center text-ink-600 text-sm">
        No citizens match the current search.
      </div>
      <div
        v-else
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
      >
        <button
          v-for="row in filtered"
          :key="row.id"
          type="button"
          class="card overflow-hidden text-left hover:ring-2 hover:ring-maroon-accent/40 transition group"
          @click="openDetail(row)"
        >
          <div class="aspect-square bg-cream-200 grid place-items-center overflow-hidden">
            <img
              v-if="profilePhotoFull(row)"
              :src="profilePhotoFull(row)!"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform"
              :alt="fullNameOf(row)"
            />
            <div v-else class="text-center text-ink-600">
              <div
                class="w-16 h-16 rounded-full bg-cream-300 grid place-items-center text-lg font-semibold mx-auto"
              >
                {{ row.first_name.charAt(0) }}{{ row.last_name.charAt(0) }}
              </div>
              <p class="text-[11px] mt-2">No photo</p>
            </div>
          </div>
          <div class="p-3 border-t border-cream-300/60">
            <div class="font-medium text-sm truncate">{{ fullNameOf(row) }}</div>
            <div class="text-xs text-ink-600 tabular-nums truncate">
              {{ row.contact_number || '—' }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Table view -->
    <div v-else class="card overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="text-left">
            <th class="smallcaps py-4 px-6">Photo</th>
            <th class="smallcaps py-4 px-6">Full name</th>
            <th class="smallcaps py-4 px-6">Address</th>
            <th class="smallcaps py-4 px-6">Contact</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="py-12 text-center text-ink-600 text-sm">Loading…</td>
          </tr>
          <tr v-else-if="error">
            <td colspan="5" class="py-12 text-center text-maroon-accent text-sm">
              {{ error }}
            </td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td colspan="5" class="py-12 text-center text-ink-600 text-sm">
              No citizens match the current search.
            </td>
          </tr>
          <tr
            v-for="row in filtered"
            v-else
            :key="row.id"
            class="border-t border-cream-200/70 hover:bg-cream-100/60 transition-colors"
          >
            <td class="py-3 px-6">
              <div
                class="w-10 h-10 rounded-full bg-cream-300 overflow-hidden grid place-items-center text-ink-600 text-xs"
              >
                <img
                  v-if="photoUrl(row)"
                  :src="photoUrl(row)!"
                  class="w-full h-full object-cover"
                />
                <span v-else>—</span>
              </div>
            </td>
            <td class="py-3 px-6 font-medium text-ink-900">
              <button
                type="button"
                class="text-left hover:text-maroon-accent transition-colors"
                @click="openDetail(row)"
              >
                {{
                  [row.first_name, row.middle_name, row.last_name, row.suffix]
                    .filter(Boolean)
                    .join(' ')
                }}
              </button>
            </td>
            <td class="py-3 px-6 text-sm uppercase">
              <a
                v-if="mapsUrl(row)"
                :href="mapsUrl(row)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-start gap-1.5 text-ink-800 hover:text-maroon-accent group"
                title="Open in Google Maps"
              >
                <span>{{ fullAddress(row) }}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50 group-hover:opacity-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.8"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
              </a>
              <span v-else class="text-ink-800">{{ fullAddress(row) }}</span>
            </td>
            <td class="py-3 px-6">
              <button
                v-if="row.contact_number"
                type="button"
                class="text-maroon-accent hover:text-maroon-700 underline tabular-nums"
                @click="openContactMenu(row)"
              >
                {{ row.contact_number }}
              </button>
              <span v-else class="text-ink-800">—</span>
            </td>
            <td class="py-3 px-6 text-right">
              <RouterLink
                :to="{ name: 'certificate', params: { id: row.id } }"
                class="btn-primary inline-flex"
              >
                Certificate
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Applicant detail modal — full record + full-size photo + IDs -->
    <Teleport to="body">
      <div
        v-if="detailRow"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6"
        @click.self="closeDetail"
      >
        <div class="card w-full max-w-5xl max-h-[92vh] flex flex-col p-6">
          <div class="flex items-start justify-between mb-4 shrink-0">
            <div>
              <div class="smallcaps">Applicant</div>
              <h2 class="text-2xl font-semibold leading-tight">
                {{ fullNameOf(detailRow) }}
              </h2>
              <p class="text-xs text-ink-600 mt-1 tabular-nums">
                Application ID: {{ detailRow.id }} · Filed
                {{ formatDate(detailRow.created) }}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
              @click="closeDetail"
            >
              ×
            </button>
          </div>

          <div class="overflow-auto flex-1 -mx-2 px-2 space-y-6">
            <!-- Photo + main grid -->
            <div class="flex gap-6">
              <div class="w-64 shrink-0">
                <div
                  class="aspect-[3/4] bg-cream-200 rounded-lg overflow-hidden border border-cream-300/60 grid place-items-center"
                >
                  <img
                    v-if="profilePhotoFull(detailRow)"
                    :src="profilePhotoFull(detailRow)!"
                    class="w-full h-full object-cover"
                    alt="Applicant photo"
                  />
                  <span v-else class="text-xs text-ink-600">No photo</span>
                </div>
              </div>

              <div class="flex-1 min-w-0 space-y-5">
                <section>
                  <h3 class="smallcaps mb-2">Personal Information</h3>
                  <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt class="text-ink-600 text-xs">Date of birth</dt>
                      <dd class="tabular-nums">{{ formatDate(detailRow.date_of_birth) || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Gender</dt>
                      <dd>{{ detailRow.gender || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Civil status</dt>
                      <dd>{{ detailRow.civil_status || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Religion</dt>
                      <dd>{{ detailRow.religion || '—' }}</dd>
                    </div>
                    <div v-if="detailRow.spouse_maiden_name">
                      <dt class="text-ink-600 text-xs">
                        {{
                          detailRow.civil_status === 'LIVE_IN'
                            ? 'Live-in partner'
                            : 'Spouse maiden name'
                        }}
                      </dt>
                      <dd>{{ detailRow.spouse_maiden_name }}</dd>
                    </div>
                    <div v-if="detailRow.spouse_phone">
                      <dt class="text-ink-600 text-xs">
                        {{
                          detailRow.civil_status === 'LIVE_IN'
                            ? 'Partner mobile'
                            : 'Spouse mobile'
                        }}
                      </dt>
                      <dd class="tabular-nums">{{ detailRow.spouse_phone }}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 class="smallcaps mb-2">Address</h3>
                  <dl class="grid grid-cols-1 gap-y-2 text-sm">
                    <div>
                      <dt class="text-ink-600 text-xs">Full address</dt>
                      <dd>{{ fullAddressLong(detailRow) || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Mailing address</dt>
                      <dd>{{ mailingAddress(detailRow) }}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 class="smallcaps mb-2">Contact</h3>
                  <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt class="text-ink-600 text-xs">Phone</dt>
                      <dd class="tabular-nums">{{ detailRow.contact_number || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Email</dt>
                      <dd class="break-all">{{ detailRow.email || '—' }}</dd>
                    </div>
                    <div v-if="detailRow.messenger">
                      <dt class="text-ink-600 text-xs">Messenger</dt>
                      <dd class="break-all">{{ detailRow.messenger }}</dd>
                    </div>
                    <div v-if="detailRow.viber">
                      <dt class="text-ink-600 text-xs">Viber</dt>
                      <dd class="tabular-nums">{{ detailRow.viber }}</dd>
                    </div>
                    <div v-if="detailRow.whatsapp">
                      <dt class="text-ink-600 text-xs">WhatsApp</dt>
                      <dd class="tabular-nums">{{ detailRow.whatsapp }}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 class="smallcaps mb-2">Employment & Residency</h3>
                  <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt class="text-ink-600 text-xs">Nature of work</dt>
                      <dd>{{ detailRow.nature_of_work || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Occupation</dt>
                      <dd>{{ detailRow.occupation || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-ink-600 text-xs">Years of residency</dt>
                      <dd>{{ residencyText(detailRow) }}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 class="smallcaps mb-2">Clearance</h3>
                  <dl class="text-sm">
                    <div>
                      <dt class="text-ink-600 text-xs">Purpose</dt>
                      <dd>{{ detailRow.purpose_of_clearance || '—' }}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>

            <!-- Identifications -->
            <section>
              <h3 class="smallcaps mb-3">Identifications presented</h3>
              <div v-if="detailIdsLoading" class="text-sm text-ink-600">Loading…</div>
              <div
                v-else-if="detailIds.length === 0"
                class="text-sm text-ink-600"
              >
                No identifications on record.
              </div>
              <div v-else class="grid grid-cols-3 gap-4">
                <div
                  v-for="doc in detailIds"
                  :key="doc.id"
                  class="border border-cream-300/60 rounded-lg overflow-hidden bg-cream-50"
                >
                  <div
                    class="aspect-video bg-cream-200 grid place-items-center overflow-hidden"
                  >
                    <img
                      v-if="idPhotoUrl(doc)"
                      :src="idPhotoUrl(doc)!"
                      class="w-full h-full object-cover"
                      :alt="doc.name"
                    />
                    <span v-else class="text-xs text-ink-600">No photo</span>
                  </div>
                  <div class="p-3 text-sm">
                    <div class="font-medium">{{ doc.name }}</div>
                    <div class="text-xs text-ink-600 mb-1">{{ doc.group || '' }}</div>
                    <div class="tabular-nums">{{ doc.number || '—' }}</div>
                    <div v-if="doc.expiry" class="text-xs text-ink-600 tabular-nums mt-1">
                      Expires {{ formatDate(doc.expiry) }}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div
            class="flex items-center justify-end gap-3 pt-4 border-t border-cream-300/60 mt-4 shrink-0"
          >
            <button
              type="button"
              class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
              @click="closeDetail"
            >
              Close
            </button>
            <RouterLink
              :to="{ name: 'certificate', params: { id: detailRow.id } }"
              class="btn-primary"
              @click="closeDetail"
            >
              View Certificate
            </RouterLink>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Contact action modal — opens the number in Viber/WhatsApp/Telegram
         desktop apps, or copies it to clipboard. -->
    <Teleport to="body">
      <div
        v-if="contactMenuRow"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6"
        @click.self="closeContactMenu"
      >
        <div class="card w-full max-w-sm p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <div class="smallcaps">Contact</div>
              <h2 class="text-lg font-semibold leading-tight">
                {{ fullNameOf(contactMenuRow) }}
              </h2>
              <p class="text-sm text-ink-700 tabular-nums mt-1">
                {{ contactMenuRow.contact_number }}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
              @click="closeContactMenu"
            >
              ×
            </button>
          </div>

          <div class="space-y-2">
            <a
              :href="viberUrl(contactMenuRow.contact_number)"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 px-4 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style="background-color: #7360f2"
              @click="closeContactMenu"
            >
              <span
                class="w-7 h-7 rounded-full bg-white/20 grid place-items-center text-xs font-bold"
              >V</span>
              <span>Open in Viber</span>
            </a>

            <a
              :href="whatsappUrl(contactMenuRow.contact_number)"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 px-4 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style="background-color: #25d366"
              @click="closeContactMenu"
            >
              <span
                class="w-7 h-7 rounded-full bg-white/20 grid place-items-center text-xs font-bold"
              >W</span>
              <span>Open in WhatsApp</span>
            </a>

            <a
              :href="telegramUrl(contactMenuRow.contact_number)"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 px-4 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style="background-color: #229ed9"
              @click="closeContactMenu"
            >
              <span
                class="w-7 h-7 rounded-full bg-white/20 grid place-items-center text-xs font-bold"
              >T</span>
              <span>Open in Telegram</span>
            </a>

            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-cream-100 hover:bg-cream-200 text-ink-800 font-medium transition-colors border border-cream-300/70"
              :disabled="copyState === 'copied'"
              @click="copyContactNumber"
            >
              <span class="w-7 h-7 rounded-full bg-ink-900/10 grid place-items-center">
                <svg
                  v-if="copyState !== 'copied'"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.6"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                  />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4 text-green-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              <span>{{ copyState === 'copied' ? 'Copied!' : 'Copy text' }}</span>
            </button>

            <p v-if="copyState === 'error'" class="text-xs text-maroon-accent text-center mt-2">
              Couldn't copy automatically — select the number above and press Ctrl+C.
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
