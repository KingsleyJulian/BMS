<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBarangayStore } from '@/stores/barangay'
import { getPb } from '@/services/pocketbase'

interface ParentEntry {
  id: string
  case_no?: string
  complainant_name?: string
  date_time_occurred?: string
  place_of_occurrence?: string
}

interface MediationEntry {
  id: string
  collectionId: string
  parent: string
  mediation_date_time: string
  place_of_mediation: string
  respondent_name: string
  respondent_address?: string
  respondent_contact?: string
  notes?: string
  created: string
}

const route = useRoute()
const router = useRouter()
const barangay = useBarangayStore()

const composing = computed(() => route.name === 'blotter-mediation-new')

const parent = ref<ParentEntry | null>(null)
const entry = ref<MediationEntry | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pbBaseUrl = ref('')

interface DraftForm {
  mediation_date_time: string
  place_of_mediation: string
  respondent_name: string
  respondent_address: string
  respondent_contact: string
  notes: string
}
const draft = reactive<DraftForm>({
  mediation_date_time: '',
  place_of_mediation: '',
  respondent_name: '',
  respondent_address: '',
  respondent_contact: '',
  notes: ''
})

const saving = ref(false)
const saveError = ref<string | null>(null)

onMounted(async () => {
  const pb = await getPb()
  pbBaseUrl.value = pb.baseUrl
  const parentId = route.params.id as string
  try {
    parent.value = await pb.collection('blotter_entries').getOne<ParentEntry>(parentId)
    const mediationId = route.params.mid as string | undefined
    if (mediationId) {
      entry.value = await pb
        .collection('blotter_mediations')
        .getOne<MediationEntry>(mediationId)
    } else if (parent.value && composing.value) {
      // Default place is the barangay hall; case_no is shown read-only.
      draft.place_of_mediation = `BARANGAY HALL — ${barangay.info.name.toUpperCase()}`
    }
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

const parentRef = computed(() => parent.value?.case_no ?? parent.value?.id.slice(-6).toUpperCase() ?? '')
const issueDate = computed(() => formatDateTime(entry.value?.created ?? new Date().toISOString()))
const mediationOn = computed(() =>
  formatDateTime(entry.value?.mediation_date_time ?? draft.mediation_date_time)
)

const canSave = computed(
  () =>
    !!draft.respondent_name.trim() &&
    !!draft.place_of_mediation.trim() &&
    !!draft.mediation_date_time &&
    !saving.value
)

const dateTimeEl = ref<HTMLInputElement | null>(null)
function openDateTimePicker(): void {
  const el = dateTimeEl.value
  if (!el) return
  if (typeof el.showPicker === 'function') {
    try {
      el.showPicker()
      return
    } catch {
      /* ignore */
    }
  }
  el.focus()
  el.click()
}

async function save(): Promise<MediationEntry | null> {
  if (!canSave.value || !parent.value) return null
  saveError.value = null
  saving.value = true
  try {
    const pb = await getPb()
    const created = await pb
      .collection('blotter_mediations')
      .create<MediationEntry>({
        parent: parent.value.id,
        mediation_date_time: new Date(draft.mediation_date_time).toISOString(),
        place_of_mediation: draft.place_of_mediation.trim().toUpperCase(),
        respondent_name: draft.respondent_name.trim().toUpperCase(),
        respondent_address: draft.respondent_address.trim().toUpperCase(),
        respondent_contact: draft.respondent_contact.trim(),
        notes: draft.notes.trim()
      })
    return created
  } catch (e) {
    saveError.value = (e as Error).message
    return null
  } finally {
    saving.value = false
  }
}

async function saveAndPrint(): Promise<void> {
  const created = await save()
  if (created && parent.value) {
    entry.value = created
    await router.replace({
      name: 'blotter-mediation',
      params: { id: parent.value.id, mid: created.id }
    })
    await nextTick()
    window.print()
  }
}

async function saveAndExit(): Promise<void> {
  const created = await save()
  if (created && parent.value) {
    entry.value = created
    void router.replace({
      name: 'blotter-mediation',
      params: { id: parent.value.id, mid: created.id }
    })
  }
}

function printDoc(): void {
  window.print()
}

function back(): void {
  if (parent.value) {
    void router.push({ name: 'blotter-report', params: { id: parent.value.id } })
  } else {
    void router.push('/blotter')
  }
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
        ← Back to Blotter Report
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
        <button v-else class="btn-primary" :disabled="!entry" @click="printDoc">
          Print / Save as PDF
        </button>
      </div>
    </div>

    <div v-if="loading" class="card p-12 text-center text-ink-600 print:hidden">Loading…</div>
    <div v-else-if="error" class="card p-12 text-center text-maroon-accent print:hidden">
      {{ error }}
    </div>

    <!-- Mediation invitation sheet -->
    <article
      v-if="parent && (composing || entry)"
      class="report-sheet bg-white shadow mx-auto p-12 text-ink-900 flex flex-col relative"
      style="width: 8.5in; min-height: 11in"
    >
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
          Lupong Tagapamayapa
        </h2>
      </header>

      <div class="text-center mt-8">
        <h2 class="text-2xl font-bold tracking-wide">INVITATION TO MEDIATE</h2>
        <p class="mt-1 text-[11pt] tabular-nums">
          Re: Blotter Case No.
          <span class="font-mono font-semibold">{{ parentRef }}</span>
        </p>
      </div>

      <section class="mt-8" style="font-size: 11pt">
        <p class="mb-1 tabular-nums">{{ issueDate }}</p>
        <p class="mt-6">TO:
          <strong v-if="!composing" class="uppercase">{{ entry?.respondent_name }}</strong>
          <input
            v-else
            v-model="draft.respondent_name"
            v-uppercase
            class="inline-field font-semibold uppercase ml-2"
            style="width: 60%"
            placeholder="RESPONDENT FULL NAME"
            required
          />
        </p>
        <p class="mt-1">
          Address:
          <span v-if="!composing" class="uppercase">{{ entry?.respondent_address || '—' }}</span>
          <input
            v-else
            v-model="draft.respondent_address"
            v-uppercase
            class="inline-field uppercase ml-2"
            style="width: 70%"
            placeholder="HOUSE, STREET, BARANGAY, CITY"
          />
        </p>
        <p class="mt-1">
          Contact:
          <span v-if="!composing" class="tabular-nums">{{ entry?.respondent_contact || '—' }}</span>
          <input
            v-else
            v-model="draft.respondent_contact"
            type="tel"
            class="inline-field tabular-nums ml-2"
            style="width: 40%"
            placeholder="09xx xxx xxxx"
          />
        </p>

        <p class="mt-8 leading-relaxed text-justify indent-8">
          You are hereby invited to appear before the
          <strong>Lupong Tagapamayapa</strong> of Barangay
          <strong>{{ barangay.info.name }}</strong> in connection with Blotter Case No.
          <strong class="font-mono">{{ parentRef }}</strong> filed by
          <strong class="uppercase">{{ parent.complainant_name || '—' }}</strong>,
          for the purpose of amicable settlement / mediation pursuant to the Katarungang
          Pambarangay Law (R.A. 7160).
        </p>

        <p class="mt-4 leading-relaxed text-justify indent-8">
          Please be present on the date, time, and place indicated below. Failure to
          appear without justifiable cause may bar you from filing a corresponding
          counter-charge in court.
        </p>
      </section>

      <section class="mt-6 border border-ink-900" style="font-size: 10pt">
        <dl>
          <div class="grid grid-cols-12 border-b border-ink-900">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Date / Time of mediation
            </dt>
            <dd class="col-span-8 px-3 py-1 tabular-nums">
              <template v-if="composing">
                <button
                  type="button"
                  class="inline-field w-full text-left tabular-nums"
                  @click="openDateTimePicker"
                >
                  <span :class="!draft.mediation_date_time ? 'text-ink-600' : ''">
                    {{
                      draft.mediation_date_time
                        ? formatDateTime(draft.mediation_date_time)
                        : 'Click to pick date & time'
                    }}
                  </span>
                </button>
                <input
                  ref="dateTimeEl"
                  v-model="draft.mediation_date_time"
                  type="datetime-local"
                  required
                  class="dt-hidden"
                  tabindex="-1"
                  aria-hidden="true"
                />
              </template>
              <template v-else>{{ mediationOn }}</template>
            </dd>
          </div>
          <div class="grid grid-cols-12">
            <dt class="col-span-4 px-3 py-1 bg-cream-100 smallcaps !text-[9px] border-r border-ink-900">
              Place of mediation
            </dt>
            <dd class="col-span-8 px-3 py-1 uppercase">
              <input
                v-if="composing"
                v-model="draft.place_of_mediation"
                v-uppercase
                maxlength="240"
                class="inline-field uppercase w-full"
                placeholder="VENUE / OFFICE"
              />
              <template v-else>{{ entry?.place_of_mediation }}</template>
            </dd>
          </div>
        </dl>
      </section>

      <section class="mt-4">
        <div class="smallcaps !text-[10px] mb-1">Notes (optional)</div>
        <textarea
          v-if="composing"
          v-model="draft.notes"
          rows="4"
          class="w-full border border-ink-900 px-3 py-2 text-[10pt] leading-relaxed bg-transparent focus:outline-none"
          placeholder="Any additional instructions or attachments…"
        />
        <p
          v-else-if="entry?.notes"
          class="border border-ink-900 px-3 py-2 text-[10pt] leading-relaxed whitespace-pre-wrap"
        >{{ entry.notes }}</p>
      </section>

      <section class="mt-auto pt-12 grid grid-cols-2 gap-12" style="font-size: 10pt">
        <div class="text-center">
          <div class="border-t border-ink-900 pt-1 mt-12">Lupon Chairperson</div>
        </div>
        <div class="text-center">
          <div class="border-t border-ink-900 pt-1 mt-12">Punong Barangay</div>
        </div>
      </section>
    </article>
  </div>
</template>

<style scoped>
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

.dt-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  left: 0;
  top: 0;
}

@media print {
  @page {
    size: 8.5in 11in;
    margin: 0;
  }
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
  .inline-field {
    border-bottom: 0 !important;
    background: transparent !important;
  }
}
</style>
