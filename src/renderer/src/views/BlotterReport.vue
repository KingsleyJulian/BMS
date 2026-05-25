<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useBarangayStore } from '@/stores/barangay'
import { getPb } from '@/services/pocketbase'
import BlotterAmendments from '@/components/BlotterAmendments.vue'

interface BlotterEntry {
  id: string
  collectionId: string
  case_no?: string
  date_time_occurred: string
  place_of_occurrence: string
  complainant_name: string
  complainant_address?: string
  complainant_contact?: string
  is_resident?: boolean
  narrative?: string
  created: string
}

interface CitizenMatch {
  id: string
  collectionId: string
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  contact_number?: string
  profile_photo?: string
  house_no?: string
  block?: string
  street?: string
  address_barangay?: string
  city?: string
}

const route = useRoute()
const router = useRouter()
const barangay = useBarangayStore()

// Compose mode = the user clicked "+ New entry" and is filling out a fresh
// form on the printable template. View mode = an existing record is being
// re-opened from the list (or after saving). The route name is the only
// signal — `/blotter/new` ↔ `/blotter/:id/report`.
const composing = computed(() => route.name === 'blotter-new')

const entry = ref<BlotterEntry | null>(null)
const loading = ref(!composing.value)
const error = ref<string | null>(null)
// Reactive so the logo computeds re-evaluate once PocketBase resolves —
// the previous `let` was captured at first render with an empty string,
// leaving the logo `<img>` tags broken until something else re-rendered.
const pbBaseUrl = ref('')

// Pre-generated 15-char [a-z0-9] id used as the PocketBase record id when
// saving. Generating it up front lets the case-number on the printable
// sheet match the eventually-saved record exactly, instead of dashes.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
function generatePbId(): string {
  let out = ''
  const arr = new Uint32Array(15)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 15; i++) out += ALPHABET[arr[i] % ALPHABET.length]
  return out
}
const draftId = ref<string>(composing.value ? generatePbId() : '')

// Previewed case number for the compose draft. Computed on mount and
// re-checked just before save to defend against same-day races. View
// mode reads `entry.case_no` directly.
const previewCaseNo = ref<string>('')

function todayDateStamp(d: Date = new Date()): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

// Counts existing rows whose `case_no` starts with today's stamp and
// returns the next free `YYYYMMDD-NNNNN` string. 5-digit padding with no
// hard cap — `String(n).padStart(5,'0')` widens past 5 digits naturally
// once a single day exceeds 99,999 entries.
async function nextCaseNumber(): Promise<string> {
  const stamp = todayDateStamp()
  const pb = await getPb()
  try {
    const filter = pb.filter('case_no ~ {:p}', { p: `${stamp}-` })
    const list = await pb
      .collection('blotter_entries')
      .getList<BlotterEntry>(1, 1, { filter, sort: '-case_no' })
    let nextSeq = 1
    if (list.items.length > 0 && list.items[0].case_no) {
      const last = list.items[0].case_no
      const tail = last.split('-')[1] ?? ''
      const parsed = parseInt(tail, 10)
      if (Number.isFinite(parsed)) nextSeq = parsed + 1
    }
    return `${stamp}-${String(nextSeq).padStart(5, '0')}`
  } catch {
    // PB unreachable — fall back to a plausible first-of-day number so
    // the compose preview still shows something. Save will re-check.
    return `${stamp}-00001`
  }
}

interface DraftForm {
  complainant_name: string
  complainant_address: string
  complainant_contact: string
  place_of_occurrence: string
  // datetime-local format: "YYYY-MM-DDTHH:mm"
  date_time_occurred: string
  is_resident: boolean
  narrative: string
}
const draft = reactive<DraftForm>({
  complainant_name: '',
  complainant_address: '',
  complainant_contact: '',
  place_of_occurrence: '',
  date_time_occurred: '',
  is_resident: true,
  narrative: ''
})

// Resident search modal — opened from the Person Reporting field in
// compose mode when "Resident" is ticked. Searches clearance_applications
// by name OR contact number; results show photo + address + phone so the
// desk officer can confirm the right person before selecting.
const residentSearchOpen = ref(false)
const residentQuery = ref('')
const residentMatches = ref<CitizenMatch[]>([])
const residentSearching = ref(false)
let residentDebounce: ReturnType<typeof setTimeout> | null = null

// When set, the modal shows a large-photo confirmation pane instead of
// the result list. Cancel returns to the list; Confirm fills the report.
const residentToConfirm = ref<CitizenMatch | null>(null)

// What the resident search is filling. `complainant` updates the Person
// Reporting cell; `narrative` injects "<NAME> of <ADDRESS>" at the
// textarea cursor. The button in the narrative panel sets this before
// opening the modal so a single confirm-flow serves both targets.
type ResidentTarget = 'complainant' | 'narrative'
const residentSearchTarget = ref<ResidentTarget>('complainant')

// Narrative textarea ref + remembered cursor offset. Capturing on blur
// (the insert button steals focus when clicked) lets us splice the
// inserted text at the user's last caret position instead of always
// appending to the end.
const narrativeEl = ref<HTMLTextAreaElement | null>(null)
let narrativeCursor = 0
function rememberNarrativeCursor(): void {
  if (narrativeEl.value) narrativeCursor = narrativeEl.value.selectionStart
}

// Hidden datetime-local input — we keep it offscreen and call its
// showPicker() on click. The opacity:0 overlay approach is unreliable
// in Chromium because the native picker is gated by the calendar
// indicator icon, which gets eaten by absolute-positioned wrappers.
const dateTimeEl = ref<HTMLInputElement | null>(null)
function openDateTimePicker(): void {
  const el = dateTimeEl.value
  if (!el) return
  if (typeof el.showPicker === 'function') {
    try {
      el.showPicker()
      return
    } catch {
      /* fall through to focus fallback */
    }
  }
  el.focus()
  el.click()
}

function fullNameOf(c: CitizenMatch): string {
  return [c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
}

function residentAddress(c: CitizenMatch): string {
  return [
    [c.house_no, c.block].filter(Boolean).join(' '),
    c.street,
    c.address_barangay,
    c.city
  ]
    .filter(Boolean)
    .join(', ')
}

function residentPhotoUrl(c: CitizenMatch): string | null {
  if (!c.profile_photo || !pbBaseUrl.value) return null
  return `${pbBaseUrl.value}/api/files/${c.collectionId}/${c.id}/${c.profile_photo}?thumb=100x100`
}

// Full-size photo for the confirmation pane — no `?thumb=` so the picture
// is sharp at large sizes for visual verification.
function residentPhotoFull(c: CitizenMatch): string | null {
  if (!c.profile_photo || !pbBaseUrl.value) return null
  return `${pbBaseUrl.value}/api/files/${c.collectionId}/${c.id}/${c.profile_photo}`
}

async function runResidentSearch(query: string): Promise<void> {
  const q = query.trim()
  if (q.length < 2) {
    residentMatches.value = []
    return
  }
  residentSearching.value = true
  try {
    const pb = await getPb()
    // Single haystack: matches against any name component OR the contact
    // number. PB's `~` is a substring (LIKE %q%) match so partial phone
    // digits work too.
    const filter = pb.filter(
      'first_name ~ {:q} || middle_name ~ {:q} || last_name ~ {:q} || contact_number ~ {:q}',
      { q: q.toUpperCase() }
    )
    const list = await pb
      .collection('clearance_applications')
      .getList<CitizenMatch>(1, 30, { filter, sort: 'last_name,first_name' })
    residentMatches.value = list.items
  } catch {
    residentMatches.value = []
  } finally {
    residentSearching.value = false
  }
}

function onResidentQueryInput(): void {
  if (residentDebounce) clearTimeout(residentDebounce)
  residentDebounce = setTimeout(() => {
    void runResidentSearch(residentQuery.value)
  }, 200)
}

function openResidentSearch(): void {
  if (!draft.is_resident) return
  residentSearchTarget.value = 'complainant'
  residentSearchOpen.value = true
  residentQuery.value = draft.complainant_name
  void runResidentSearch(residentQuery.value)
}

// Opens the same modal but routes the confirmed pick into the narrative
// textarea instead of the Person Reporting cell. Used to add the name +
// address of someone being complained about.
function openResidentSearchForNarrative(): void {
  residentSearchTarget.value = 'narrative'
  residentSearchOpen.value = true
  residentQuery.value = ''
  residentMatches.value = []
}

function closeResidentSearch(): void {
  residentSearchOpen.value = false
  residentToConfirm.value = null
}

// Two-step selection — the row's "Select" button stages the resident
// here so the writer can visually verify the photo at full size, then
// confirmResident commits the choice.
function stageResident(c: CitizenMatch): void {
  residentToConfirm.value = c
}

function cancelResidentConfirm(): void {
  residentToConfirm.value = null
}

function confirmResident(): void {
  const c = residentToConfirm.value
  if (!c) return
  if (residentSearchTarget.value === 'narrative') {
    const name = fullNameOf(c)
    const addr = residentAddress(c).toUpperCase()
    const insertion = addr ? `${name} of ${addr}` : name
    const text = draft.narrative
    const at = Math.min(narrativeCursor, text.length)
    const before = text.slice(0, at)
    const after = text.slice(at)
    // Pad with surrounding spaces only when the boundaries aren't already
    // whitespace, so consecutive inserts don't pile up double spaces.
    const lead = before && !/\s$/.test(before) ? ' ' : ''
    const trail = after && !/^\s/.test(after) ? ' ' : ''
    draft.narrative = `${before}${lead}${insertion}${trail}${after}`
    narrativeCursor = at + lead.length + insertion.length
  } else {
    draft.complainant_name = fullNameOf(c)
    draft.complainant_address = residentAddress(c).toUpperCase()
    draft.complainant_contact = c.contact_number ?? ''
  }
  closeResidentSearch()
}

function setResidency(value: boolean): void {
  if (draft.is_resident === value) return
  draft.is_resident = value
  // Switching modes clears the staged complainant fields so the operator
  // doesn't accidentally save a non-resident's typed values as a matched
  // resident, or vice versa.
  draft.complainant_name = ''
  draft.complainant_address = ''
  draft.complainant_contact = ''
  residentMatches.value = []
}

const saving = ref(false)
const saveError = ref<string | null>(null)

onMounted(async () => {
  const pb = await getPb()
  pbBaseUrl.value = pb.baseUrl

  if (composing.value) {
    previewCaseNo.value = await nextCaseNumber()
    return
  }

  const id = route.params.id as string
  if (!id) {
    error.value = 'Missing entry id.'
    loading.value = false
    return
  }
  try {
    entry.value = await pb.collection('blotter_entries').getOne<BlotterEntry>(id)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

const leftLogoUrl = computed(() => {
  const info = barangay.info
  if (!info?.left_logo || !info?.id || !pbBaseUrl.value) return null
  return `${pbBaseUrl.value}/api/files/barangay_info/${info.id}/${info.left_logo}`
})

const rightLogoUrl = computed(() => {
  const info = barangay.info
  if (!info?.right_logo || !info?.id || !pbBaseUrl.value) return null
  return `${pbBaseUrl.value}/api/files/barangay_info/${info.id}/${info.right_logo}`
})

// Printable case number. Format: YYYYMMDD-NNNNN. Compose mode shows the
// previewed next-in-sequence; view mode shows the persisted value, with
// a fallback to the last 6 of the PB id for legacy rows that pre-date
// the case_no field.
const caseRef = computed(() => {
  if (entry.value?.case_no) return entry.value.case_no
  if (composing.value) return previewCaseNo.value
  if (entry.value?.id) return entry.value.id.slice(-6).toUpperCase()
  return ''
})

function formatDateTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return `${date} at ${time}`
}

const filedOn = computed(() => {
  if (composing.value) return formatDateTime(new Date().toISOString())
  return formatDateTime(entry.value?.created ?? '')
})
const occurredOn = computed(() =>
  formatDateTime(entry.value?.date_time_occurred ?? '')
)

const canSave = computed(
  () =>
    !!draft.complainant_name.trim() &&
    !!draft.place_of_occurrence.trim() &&
    !!draft.date_time_occurred &&
    !saving.value
)

async function save(): Promise<BlotterEntry | null> {
  if (!canSave.value) return null
  saveError.value = null
  saving.value = true
  try {
    const pb = await getPb()
    const basePayload = {
      // Pre-generated id so the case number printed in the draft matches
      // the saved record. PocketBase accepts a 15-char [a-z0-9] id at
      // create time.
      id: draftId.value,
      complainant_name: draft.complainant_name.trim().toUpperCase(),
      complainant_address: draft.complainant_address.trim().toUpperCase(),
      complainant_contact: draft.complainant_contact.trim(),
      place_of_occurrence: draft.place_of_occurrence.trim().toUpperCase(),
      date_time_occurred: new Date(draft.date_time_occurred).toISOString(),
      is_resident: draft.is_resident,
      narrative: draft.narrative.trim()
    }

    // Try the previewed case_no first; on uniqueness conflict, recompute
    // and retry up to 3 times. The preview can grow stale if another
    // entry was filed on the same day between mount and save.
    for (let attempt = 0; attempt < 3; attempt++) {
      const caseNo = attempt === 0 ? previewCaseNo.value : await nextCaseNumber()
      try {
        const created = await pb
          .collection('blotter_entries')
          .create<BlotterEntry>({ ...basePayload, case_no: caseNo })
        return created
      } catch (e) {
        const msg = (e as Error).message ?? ''
        // PB returns 400 with "case_no" in the failure data on unique
        // index violation. Anything else (validation, network, etc.) is
        // a real error — surface it immediately.
        if (!msg.toLowerCase().includes('case_no') && attempt === 0) {
          previewCaseNo.value = await nextCaseNumber()
          continue
        }
        if (attempt === 2) throw e
        previewCaseNo.value = await nextCaseNumber()
      }
    }
    return null
  } catch (e) {
    saveError.value = (e as Error).message
    return null
  } finally {
    saving.value = false
  }
}

async function saveAndExit(): Promise<void> {
  const created = await save()
  if (created) {
    // Seed the entry ref before navigating so view mode renders the
    // saved record immediately — the component instance is reused across
    // /blotter/new → /blotter/:id/report and onMounted does NOT fire
    // again, so without this the article would unmount once `composing`
    // flips to false.
    entry.value = created
    void router.replace({ name: 'blotter-report', params: { id: created.id } })
  }
}

async function saveAndPrint(): Promise<void> {
  const created = await save()
  if (created) {
    entry.value = created
    await router.replace({ name: 'blotter-report', params: { id: created.id } })
    // Wait one tick so Vue swaps compose-mode inputs for view-mode text
    // before the print dialog snapshots the DOM. Without this, the print
    // would capture the half-transitioned page (often blank).
    await nextTick()
    window.print()
  }
}

function printDoc(): void {
  window.print()
}

function back(): void {
  void router.push('/blotter')
}
</script>

<template>
  <div class="space-y-4 pb-12 print:space-y-0 print:p-0 print:m-0">
    <!-- Toolbar (hidden on print) -->
    <div class="flex items-center justify-between print:hidden">
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
        @click="back"
      >
        ← Back to Blotter
      </button>
      <div class="flex items-center gap-3">
        <span v-if="saveError" class="text-xs text-maroon-accent">{{ saveError }}</span>
        <template v-if="composing">
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm border border-cream-300 hover:bg-cream-200 transition disabled:opacity-50"
            :disabled="!canSave"
            @click="saveAndExit"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!canSave"
            @click="saveAndPrint"
          >
            {{ saving ? 'Saving…' : 'Save & Print' }}
          </button>
        </template>
        <template v-else>
          <RouterLink
            v-if="entry"
            :to="{ name: 'blotter-mediation-new', params: { id: entry.id } }"
            class="px-4 py-2 rounded-lg text-sm border border-cream-300 hover:bg-cream-200 transition"
          >
            + Invitation to Mediate
          </RouterLink>
          <button
            class="btn-primary"
            :disabled="!entry"
            @click="printDoc"
          >
            Print / Save as PDF
          </button>
        </template>
      </div>
    </div>

    <div v-if="loading" class="card p-12 text-center text-ink-600 print:hidden">Loading…</div>
    <div v-else-if="error" class="card p-12 text-center text-maroon-accent print:hidden">
      {{ error }}
    </div>

    <!-- Report sheet — Letter (8.5x11) -->
    <article
      v-if="composing || entry"
      class="report-sheet bg-white shadow mx-auto p-12 text-ink-900 flex flex-col relative"
      style="width: 8.5in; min-height: 11in"
    >
      <!-- Top header — same as the certificate preview -->
      <header class="text-center pb-4 border-b-2" style="border-color: #1d4ed8">
        <div class="flex items-center justify-center gap-6">
          <div class="w-20 h-20 shrink-0 grid place-items-center">
            <img
              v-if="leftLogoUrl"
              :src="leftLogoUrl"
              class="w-full h-full object-contain"
              alt="Left logo"
            />
            <div
              v-else
              class="w-16 h-16 rounded-full bg-gold-500 text-maroon-900 grid place-items-center font-semibold text-xl"
            >
              {{ barangay.info.monogram }}
            </div>
          </div>
          <div>
            <p class="text-xs italic">Republic of the Philippines</p>
            <h1 class="text-2xl font-bold tracking-wide" style="color: #1d4ed8">
              BARANGAY {{ barangay.info.name.toUpperCase() }}
            </h1>
            <p class="text-xs">{{ barangay.addressLine }}</p>
          </div>
          <div class="w-20 h-20 shrink-0 grid place-items-center">
            <img
              v-if="rightLogoUrl"
              :src="rightLogoUrl"
              class="w-full h-full object-contain"
              alt="Right logo"
            />
            <div
              v-else
              class="w-16 h-16 rounded-full bg-gold-500 text-maroon-900 grid place-items-center font-semibold text-xl"
            >
              {{ barangay.info.monogram }}
            </div>
          </div>
        </div>
        <h2 class="mt-4 text-lg font-semibold tracking-widest uppercase">
          Office of the Punong Barangay
        </h2>
      </header>

      <!-- Report title row -->
      <div class="text-center mt-8">
        <h2 class="text-2xl font-bold tracking-wide">BARANGAY BLOTTER REPORT</h2>
        <p class="mt-1 text-[11pt] tabular-nums">
          Case No.
          <span class="font-mono font-semibold">{{ caseRef }}</span>
        </p>
      </div>

      <!-- Captured fields — report-style, two-column key/value rows.
           In compose mode the value cells are inputs; otherwise plain text. -->
      <section class="mt-6 border border-ink-900" style="font-size: 10pt">
        <dl>
          <div class="grid grid-cols-12 border-b border-ink-900">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Date filed
            </dt>
            <dd class="col-span-8 px-3 py-1 tabular-nums">{{ filedOn }}</dd>
          </div>
          <div class="grid grid-cols-12 border-b border-ink-900">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Date / Time of occurrence
            </dt>
            <dd class="col-span-8 px-3 py-1 tabular-nums">
              <!-- Compose mode renders the printed-style "Month D, YYYY at
                   H:MM AM/PM" so the cell matches Date filed. Clicking
                   the display fires the hidden datetime-local input's
                   showPicker(); the input itself stays offscreen so its
                   chrome never paints over the formatted text. -->
              <template v-if="composing">
                <button
                  type="button"
                  class="inline-field w-full text-left tabular-nums"
                  @click="openDateTimePicker"
                >
                  <span :class="!draft.date_time_occurred ? 'text-ink-600' : ''">
                    {{
                      draft.date_time_occurred
                        ? formatDateTime(draft.date_time_occurred)
                        : 'Click to pick date & time'
                    }}
                  </span>
                </button>
                <input
                  ref="dateTimeEl"
                  v-model="draft.date_time_occurred"
                  type="datetime-local"
                  required
                  class="dt-hidden"
                  tabindex="-1"
                  aria-hidden="true"
                />
              </template>
              <template v-else>{{ occurredOn }}</template>
            </dd>
          </div>
          <div class="grid grid-cols-12 border-b border-ink-900">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Place of occurrence
            </dt>
            <dd class="col-span-8 px-3 py-1 uppercase">
              <input
                v-if="composing"
                v-model="draft.place_of_occurrence"
                v-uppercase
                required
                maxlength="240"
                placeholder="STREET / LANDMARK"
                class="inline-field uppercase w-full"
              />
              <template v-else>{{ entry?.place_of_occurrence }}</template>
            </dd>
          </div>
          <div class="grid grid-cols-12 border-b border-ink-900">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Person reporting
            </dt>
            <dd class="col-span-8 px-3 py-1 font-semibold uppercase">
              <!-- Resident / Non-resident — printed checkboxes always
                   show both, with the chosen one ticked. In compose mode
                   they're clickable to flip the lookup behavior. -->
              <div class="flex items-center gap-5 mb-1 font-normal normal-case text-[9pt]">
                <button
                  v-if="composing"
                  type="button"
                  class="flex items-center gap-2 hover:text-maroon-accent"
                  @click="setResidency(true)"
                >
                  <span
                    class="w-3.5 h-3.5 border border-ink-900 grid place-items-center text-[10px] leading-none"
                  >{{ draft.is_resident ? '✓' : '' }}</span>
                  Resident
                </button>
                <span v-else class="flex items-center gap-2">
                  <span
                    class="w-3.5 h-3.5 border border-ink-900 grid place-items-center text-[10px] leading-none"
                  >{{ entry?.is_resident ? '✓' : '' }}</span>
                  Resident
                </span>

                <button
                  v-if="composing"
                  type="button"
                  class="flex items-center gap-2 hover:text-maroon-accent"
                  @click="setResidency(false)"
                >
                  <span
                    class="w-3.5 h-3.5 border border-ink-900 grid place-items-center text-[10px] leading-none"
                  >{{ !draft.is_resident ? '✓' : '' }}</span>
                  Non-resident
                </button>
                <span v-else class="flex items-center gap-2">
                  <span
                    class="w-3.5 h-3.5 border border-ink-900 grid place-items-center text-[10px] leading-none"
                  >{{ entry?.is_resident === false ? '✓' : '' }}</span>
                  Non-resident
                </span>
              </div>

              <!-- Name input. In Resident mode the field is read-only and
                   clicking it opens the search modal. In Non-resident mode
                   it's a plain typeable input. -->
              <template v-if="composing">
                <button
                  v-if="draft.is_resident"
                  type="button"
                  class="inline-field font-semibold uppercase w-full text-left flex items-center justify-between gap-2"
                  @click="openResidentSearch"
                >
                  <span :class="!draft.complainant_name ? 'text-ink-600 font-normal normal-case' : ''">
                    {{ draft.complainant_name || 'Click to search residents…' }}
                  </span>
                  <span class="text-[10pt] text-ink-600 font-normal normal-case">🔍</span>
                </button>
                <input
                  v-else
                  v-model="draft.complainant_name"
                  v-uppercase
                  required
                  maxlength="200"
                  placeholder="JUAN P. DELA CRUZ"
                  class="inline-field font-semibold uppercase w-full"
                />
              </template>
              <template v-else>{{ entry?.complainant_name }}</template>
            </dd>
          </div>
          <div class="grid grid-cols-12 border-b border-ink-900">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Address
            </dt>
            <dd class="col-span-8 px-3 py-1 uppercase">
              <input
                v-if="composing"
                v-model="draft.complainant_address"
                v-uppercase
                maxlength="240"
                placeholder="HOUSE NO., STREET, BARANGAY, CITY"
                class="inline-field uppercase w-full"
              />
              <template v-else>{{ entry?.complainant_address || '—' }}</template>
            </dd>
          </div>
          <div class="grid grid-cols-12">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Contact number
            </dt>
            <dd class="col-span-8 px-3 py-1 tabular-nums">
              <input
                v-if="composing"
                v-model="draft.complainant_contact"
                type="tel"
                maxlength="32"
                placeholder="09xx xxx xxxx"
                class="inline-field tabular-nums w-full"
              />
              <template v-else>{{ entry?.complainant_contact || '—' }}</template>
            </dd>
          </div>
        </dl>
      </section>

      <!-- Narrative — typeable in compose mode (lined background acts as a
           writing guide); displayed as plain text when viewing a saved
           record. Leaving it blank still prints the ruled form for
           handwriting. -->
      <section class="mt-6 flex-1 flex flex-col">
        <div class="flex items-center justify-between mb-2">
          <div class="smallcaps !text-[10px]">Narrative / Statement</div>
          <!-- Compose-only helper: opens the same resident-search modal
               but routes the confirmed pick into the narrative as
               "<NAME> of <ADDRESS>". Hidden on print so it never bleeds
               into the saved/printed report. -->
          <button
            v-if="composing"
            type="button"
            class="text-[10px] text-maroon-accent hover:text-maroon-700 underline print:hidden"
            @click="openResidentSearchForNarrative"
          >
            + Insert resident name &amp; address
          </button>
        </div>
        <textarea
          v-if="composing"
          ref="narrativeEl"
          v-model="draft.narrative"
          class="narrative-area ruled-lines flex-1 border border-ink-900"
          placeholder="Type the statement here, or leave blank to fill in by hand…"
          @blur="rememberNarrativeCursor"
        />
        <div
          v-else
          class="ruled-lines flex-1 border border-ink-900 narrative-area whitespace-pre-wrap"
        >{{ entry?.narrative || '' }}</div>
      </section>

      <!-- Signature lines -->
      <section class="mt-8 grid grid-cols-2 gap-12" style="font-size: 10pt">
        <div class="text-center">
          <div class="border-t border-ink-900 pt-1 mt-12">Signature of Complainant</div>
        </div>
        <div class="text-center">
          <div class="border-t border-ink-900 pt-1 mt-12">Officer on Duty</div>
        </div>
      </section>
    </article>

    <!-- Amendments thread — only available once a record exists. Hidden
         on print so the saved blotter prints cleanly without the email
         thread underneath. -->
    <BlotterAmendments
      v-if="!composing && entry"
      :parent="{ id: entry.id, case_no: entry.case_no }"
      class="max-w-[8.5in] mx-auto"
    />

    <!-- Resident search modal — opens from the Person Reporting field in
         compose+resident mode. Hidden on print. -->
    <Teleport to="body">
      <div
        v-if="residentSearchOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6 print:hidden"
        @click.self="closeResidentSearch"
      >
        <div class="card w-full max-w-3xl max-h-[85vh] flex flex-col p-6">
          <!-- Search list view (default) — switches to confirmation view
               once a row's Select button stages a resident. -->
          <template v-if="!residentToConfirm">
            <div class="flex items-start justify-between mb-4 shrink-0">
              <div>
                <div class="smallcaps">
                  {{
                    residentSearchTarget === 'narrative'
                      ? 'Insert into narrative'
                      : 'Person reporting'
                  }}
                </div>
                <h2 class="text-xl font-semibold leading-tight">Find resident</h2>
                <p class="text-xs text-ink-600 mt-1">
                  Search by name or phone number. Pick a result to verify the photo
                  {{
                    residentSearchTarget === 'narrative'
                      ? 'before inserting their name and address.'
                      : 'before filling the report.'
                  }}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
                @click="closeResidentSearch"
              >
                ×
              </button>
            </div>

            <div class="relative shrink-0">
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
                v-model="residentQuery"
                v-uppercase
                autofocus
                class="input-search"
                placeholder="SEARCH NAME OR PHONE NUMBER..."
                @input="onResidentQueryInput"
              />
            </div>

            <div class="overflow-auto flex-1 mt-4 -mx-2 px-2">
              <div
                v-if="residentSearching"
                class="py-12 text-center text-ink-600 text-sm"
              >
                Searching…
              </div>
              <div
                v-else-if="residentQuery.trim().length < 2"
                class="py-12 text-center text-ink-600 text-sm"
              >
                Type at least two characters to begin.
              </div>
              <div
                v-else-if="residentMatches.length === 0"
                class="py-12 text-center text-ink-600 text-sm"
              >
                No residents match. Switch to <em>Non-resident</em> to keep the typed name instead.
              </div>
              <ul v-else class="divide-y divide-cream-200/70">
                <li
                  v-for="c in residentMatches"
                  :key="c.id"
                  class="flex items-center gap-4 py-3"
                >
                  <div
                    class="w-14 h-14 shrink-0 rounded-full bg-cream-200 overflow-hidden grid place-items-center text-ink-600 text-xs"
                  >
                    <img
                      v-if="residentPhotoUrl(c)"
                      :src="residentPhotoUrl(c)!"
                      class="w-full h-full object-cover"
                      :alt="fullNameOf(c)"
                    />
                    <span v-else>
                      {{ c.first_name.charAt(0) }}{{ c.last_name.charAt(0) }}
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm uppercase truncate">
                      {{ fullNameOf(c) }}
                    </div>
                    <div class="text-xs text-ink-600 uppercase truncate">
                      {{ residentAddress(c) || '—' }}
                    </div>
                    <div class="text-xs text-ink-600 tabular-nums">
                      {{ c.contact_number || '—' }}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn-primary shrink-0"
                    @click="stageResident(c)"
                  >
                    Select
                  </button>
                </li>
              </ul>
            </div>
          </template>

          <!-- Confirmation view — large photo for visual verification.
               The writer must press Confirm to commit the choice. -->
          <template v-else>
            <div class="flex items-start justify-between mb-4 shrink-0">
              <div>
                <div class="smallcaps">Verify resident</div>
                <h2 class="text-xl font-semibold leading-tight">
                  Is this the person reporting?
                </h2>
                <p class="text-xs text-ink-600 mt-1">
                  Compare the photo and details before filling the blotter.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
                @click="closeResidentSearch"
              >
                ×
              </button>
            </div>

            <div class="overflow-auto flex-1 -mx-2 px-2">
              <div class="flex gap-6">
                <div class="w-64 shrink-0">
                  <div
                    class="aspect-[3/4] bg-cream-200 rounded-lg overflow-hidden border border-cream-300/60 grid place-items-center"
                  >
                    <img
                      v-if="residentPhotoFull(residentToConfirm)"
                      :src="residentPhotoFull(residentToConfirm)!"
                      class="w-full h-full object-cover"
                      :alt="fullNameOf(residentToConfirm)"
                    />
                    <span v-else class="text-xs text-ink-600">No photo on record</span>
                  </div>
                </div>

                <div class="flex-1 min-w-0 space-y-4">
                  <div>
                    <div class="smallcaps text-[10px]">Full name</div>
                    <div class="text-lg font-semibold uppercase">
                      {{ fullNameOf(residentToConfirm) }}
                    </div>
                  </div>
                  <div>
                    <div class="smallcaps text-[10px]">Address</div>
                    <div class="text-sm uppercase">
                      {{ residentAddress(residentToConfirm) || '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="smallcaps text-[10px]">Phone</div>
                    <div class="text-sm tabular-nums">
                      {{ residentToConfirm.contact_number || '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="smallcaps text-[10px]">Application ID</div>
                    <div class="text-[11px] font-mono text-ink-600">
                      {{ residentToConfirm.id }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="flex items-center justify-end gap-3 pt-4 border-t border-cream-300/60 mt-4 shrink-0"
            >
              <button
                type="button"
                class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
                @click="cancelResidentConfirm"
              >
                ← Back to results
              </button>
              <button type="button" class="btn-primary" @click="confirmResident">
                Confirm — fill report
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Inline document inputs: invisible chrome on screen so they read as part
 * of the printed form, with a faint underline cue while editing. Hidden
 * entirely on print so the saved value reads as plain text. */
.inline-field {
  background: transparent;
  border: 0;
  border-bottom: 1px dotted rgba(15, 23, 42, 0.4);
  outline: none;
  padding: 1px 2px;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
}
.inline-field:focus {
  border-bottom-color: #1d4ed8;
  background: rgba(29, 78, 216, 0.05);
}
.inline-field::placeholder {
  color: rgba(15, 23, 42, 0.35);
  font-weight: 400;
}

/* Off-screen but still focus-/showPicker-able. `display:none` would block
 * the native picker entirely, hence the position trick. */
.dt-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  left: 0;
  top: 0;
}

/* Repeating ruled lines fill the narrative box. The stride matches the
 * narrative-area line-height exactly so typed text sits cleanly on the
 * baselines — change one and the other has to follow. */
.ruled-lines {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 15px,
    rgba(15, 23, 42, 0.35) 15px,
    rgba(15, 23, 42, 0.35) 16px
  );
  min-height: 3in;
  /* Chromium drops background images on print by default. Force them to
   * render so the lined narrative + label cells survive Save as PDF. */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* 7.5pt is small but readable; the 16px line-height (≈1.6×) keeps the
 * baselines aligned with the .ruled-lines stride above. */
.narrative-area {
  line-height: 16px;
  padding: 0 12px;
  font-size: 7.5pt;
  font-family: inherit;
  color: inherit;
  resize: none;
  outline: none;
  background-color: transparent;
}
textarea.narrative-area:focus {
  background-color: rgba(29, 78, 216, 0.04);
}

@media print {
  @page {
    size: 8.5in 11in;
    margin: 0;
  }
  /* Preserve every background colour and image on the printed sheet —
   * ruled lines, label-cell tints, header divider, etc. Without this
   * Chromium strips them and the document prints as plain text. */
  .report-sheet,
  .report-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .report-sheet {
    box-shadow: none !important;
    margin: 0 !important;
    width: 8.5in !important;
    height: 10.99in !important;
    min-height: 0 !important;
    max-height: 10.99in !important;
    overflow: hidden !important;
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
    break-after: avoid !important;
    break-inside: avoid !important;
  }
  /* Strip the dotted underline on print so saved values look like typed text. */
  .inline-field {
    border-bottom: 0 !important;
    background: transparent !important;
  }
}
</style>
