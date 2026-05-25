<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getPb } from '@/services/pocketbase'

interface Amendment {
  id: string
  collectionId: string
  parent: string
  amendment_letter: string
  case_no?: string
  kind: 'resolution' | 'follow_up'
  narrative?: string
  date_time_occurred?: string
  place_of_occurrence?: string
  complainant_name?: string
  complainant_address?: string
  complainant_contact?: string
  is_resident?: boolean
  created: string
}

interface ParentEntry {
  id: string
  case_no?: string
}

const props = defineProps<{ parent: ParentEntry }>()

const items = ref<Amendment[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Track which amendment cards are expanded — keyed by id. New amendments
// auto-expand once saved so the writer can verify the saved content.
const expanded = reactive<Record<string, boolean>>({})

// Composer state. `kind` null = no composer open; the user picks via the
// dropdown next to the Amend Report button.
type AmendKind = 'resolution' | 'follow_up'
const composerKind = ref<AmendKind | null>(null)
const composerOpen = computed(() => composerKind.value !== null)

interface AmendForm {
  narrative: string
  date_time_occurred: string
  place_of_occurrence: string
  complainant_name: string
  complainant_address: string
  complainant_contact: string
  is_resident: boolean
}
const draft = reactive<AmendForm>(blankDraft())
function blankDraft(): AmendForm {
  return {
    narrative: '',
    date_time_occurred: '',
    place_of_occurrence: '',
    complainant_name: '',
    complainant_address: '',
    complainant_contact: '',
    is_resident: true
  }
}

const saving = ref(false)
const saveError = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const pb = await getPb()
    const list = await pb
      .collection('blotter_amendments')
      .getFullList<Amendment>({
        filter: pb.filter('parent = {:p}', { p: props.parent.id }),
        sort: 'amendment_letter'
      })
    items.value = list
  } catch (e) {
    error.value = (e as Error).message
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())

// Generate the next free letter (A..Z) for the parent case. Skips ones
// already taken so deletion + re-creation don't reuse a letter mid-thread.
function nextLetter(): string | null {
  const used = new Set(items.value.map((a) => a.amendment_letter))
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i)
    if (!used.has(ch)) return ch
  }
  return null
}

function openComposer(kind: AmendKind): void {
  Object.assign(draft, blankDraft())
  saveError.value = null
  composerKind.value = kind
}

function closeComposer(): void {
  composerKind.value = null
}

const canSave = computed(() => {
  if (saving.value) return false
  if (composerKind.value === 'resolution') {
    return !!draft.narrative.trim()
  }
  if (composerKind.value === 'follow_up') {
    return (
      !!draft.complainant_name.trim() &&
      !!draft.place_of_occurrence.trim() &&
      !!draft.date_time_occurred
    )
  }
  return false
})

async function save(): Promise<void> {
  if (!canSave.value || !composerKind.value) return
  const letter = nextLetter()
  if (!letter) {
    saveError.value = 'This case already has 26 amendments (A–Z). No further letters are available.'
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const pb = await getPb()
    const baseCaseNo = props.parent.case_no
      ? `${props.parent.case_no}-${letter}`
      : `${props.parent.id.slice(-6).toUpperCase()}-${letter}`
    const payload: Partial<Amendment> = {
      parent: props.parent.id,
      amendment_letter: letter,
      case_no: baseCaseNo,
      kind: composerKind.value,
      narrative: draft.narrative.trim()
    }
    if (composerKind.value === 'follow_up') {
      payload.date_time_occurred = new Date(draft.date_time_occurred).toISOString()
      payload.place_of_occurrence = draft.place_of_occurrence.trim().toUpperCase()
      payload.complainant_name = draft.complainant_name.trim().toUpperCase()
      payload.complainant_address = draft.complainant_address.trim().toUpperCase()
      payload.complainant_contact = draft.complainant_contact.trim()
      payload.is_resident = draft.is_resident
    }
    const created = await pb
      .collection('blotter_amendments')
      .create<Amendment>(payload as Record<string, unknown>)
    items.value = [...items.value, created]
    expanded[created.id] = true
    closeComposer()
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function caseRefOf(a: Amendment): string {
  return a.case_no ?? `${props.parent.case_no ?? props.parent.id.slice(-6).toUpperCase()}-${a.amendment_letter}`
}

function kindLabel(k: Amendment['kind']): string {
  return k === 'resolution' ? 'Resolution' : 'Follow-up Report'
}

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

function toggle(id: string): void {
  expanded[id] = !expanded[id]
}
</script>

<template>
  <section class="space-y-3 print:hidden">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">Amendments</h3>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-lg text-sm border border-cream-300 bg-cream-50 hover:bg-cream-200 transition"
          :disabled="composerOpen"
          @click="openComposer('follow_up')"
        >
          + New Blotter Report
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="composerOpen"
          @click="openComposer('resolution')"
        >
          Amend Report — Resolution
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-xs text-ink-600">Loading amendments…</p>
    <p v-else-if="error" class="text-xs text-maroon-accent">{{ error }}</p>
    <p v-else-if="items.length === 0 && !composerOpen" class="text-xs text-ink-600">
      No amendments yet. Use the buttons above to file a follow-up report or record a resolution.
    </p>

    <!-- Email-thread style cards. Header is always visible; clicking it
         toggles the body. Newly saved amendments auto-expand once. -->
    <ul class="space-y-2">
      <li
        v-for="a in items"
        :key="a.id"
        class="card overflow-hidden border border-cream-300/70"
      >
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cream-100 transition"
          @click="toggle(a.id)"
        >
          <span
            class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold tabular-nums"
            :class="
              a.kind === 'resolution'
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            "
          >{{ a.amendment_letter }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">
              {{ kindLabel(a.kind) }} ·
              <span class="font-mono">{{ caseRefOf(a) }}</span>
            </div>
            <div class="text-[11px] text-ink-600 truncate">
              {{ formatDateTime(a.created) }}
              <span v-if="a.kind === 'follow_up' && a.complainant_name">
                · {{ a.complainant_name }}
              </span>
              <span v-else-if="a.narrative">
                · {{ a.narrative.slice(0, 80) }}{{ a.narrative.length > 80 ? '…' : '' }}
              </span>
            </div>
          </div>
          <span class="text-xs text-ink-600">
            {{ expanded[a.id] ? '▾' : '▸' }}
          </span>
        </button>

        <div
          v-if="expanded[a.id]"
          class="px-5 py-4 border-t border-cream-300/70 text-sm space-y-3"
        >
          <template v-if="a.kind === 'follow_up'">
            <dl class="grid grid-cols-3 gap-x-4 gap-y-1.5">
              <dt class="smallcaps text-[10px]">Date / Time</dt>
              <dd class="col-span-2 tabular-nums">{{ formatDateTime(a.date_time_occurred ?? '') }}</dd>
              <dt class="smallcaps text-[10px]">Place</dt>
              <dd class="col-span-2 uppercase">{{ a.place_of_occurrence }}</dd>
              <dt class="smallcaps text-[10px]">Person reporting</dt>
              <dd class="col-span-2 uppercase font-medium">
                {{ a.complainant_name }}
                <span v-if="a.is_resident !== undefined" class="text-[10px] font-normal normal-case ml-2 text-ink-600">
                  ({{ a.is_resident ? 'Resident' : 'Non-resident' }})
                </span>
              </dd>
              <template v-if="a.complainant_address">
                <dt class="smallcaps text-[10px]">Address</dt>
                <dd class="col-span-2 uppercase">{{ a.complainant_address }}</dd>
              </template>
              <template v-if="a.complainant_contact">
                <dt class="smallcaps text-[10px]">Contact</dt>
                <dd class="col-span-2 tabular-nums">{{ a.complainant_contact }}</dd>
              </template>
            </dl>
            <div v-if="a.narrative" class="pt-2 border-t border-cream-200/70">
              <div class="smallcaps text-[10px] mb-1">Narrative</div>
              <p class="whitespace-pre-wrap text-[12px] leading-relaxed">{{ a.narrative }}</p>
            </div>
          </template>
          <template v-else>
            <div class="smallcaps text-[10px] mb-1">Resolution</div>
            <p class="whitespace-pre-wrap leading-relaxed">{{ a.narrative }}</p>
          </template>
        </div>
      </li>
    </ul>

    <!-- Composer — shown inline at the bottom of the thread. -->
    <div v-if="composerOpen" class="card p-5 border border-maroon-accent/30 space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <div class="smallcaps">
            New amendment ·
            {{ composerKind === 'resolution' ? 'Resolution' : 'Follow-up Report' }}
          </div>
          <p class="text-[11px] text-ink-600 mt-0.5">
            Will be filed as
            <span class="font-mono font-semibold">
              {{ props.parent.case_no ?? props.parent.id.slice(-6).toUpperCase() }}-{{
                nextLetter() ?? '?'
              }}
            </span>
          </p>
        </div>
        <button
          type="button"
          class="text-ink-600 hover:text-ink-900 text-xl leading-none"
          @click="closeComposer"
        >
          ×
        </button>
      </div>

      <template v-if="composerKind === 'follow_up'">
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="smallcaps text-[10px]">Date / Time of occurrence *</span>
            <input
              v-model="draft.date_time_occurred"
              type="datetime-local"
              class="mt-1 input-search pl-4 tabular-nums"
            />
          </label>
          <label class="block">
            <span class="smallcaps text-[10px]">Place of occurrence *</span>
            <input
              v-model="draft.place_of_occurrence"
              v-uppercase
              maxlength="240"
              class="mt-1 input-search pl-4"
            />
          </label>
          <label class="block">
            <span class="smallcaps text-[10px]">Person reporting *</span>
            <input
              v-model="draft.complainant_name"
              v-uppercase
              maxlength="200"
              class="mt-1 input-search pl-4"
            />
          </label>
          <div class="block">
            <span class="smallcaps text-[10px]">Type</span>
            <div class="mt-1 flex items-center gap-3 text-sm">
              <label class="flex items-center gap-1.5">
                <input v-model="draft.is_resident" type="radio" :value="true" />
                Resident
              </label>
              <label class="flex items-center gap-1.5">
                <input v-model="draft.is_resident" type="radio" :value="false" />
                Non-resident
              </label>
            </div>
          </div>
          <label class="block col-span-2">
            <span class="smallcaps text-[10px]">Address</span>
            <input
              v-model="draft.complainant_address"
              v-uppercase
              maxlength="240"
              class="mt-1 input-search pl-4"
            />
          </label>
          <label class="block">
            <span class="smallcaps text-[10px]">Contact</span>
            <input
              v-model="draft.complainant_contact"
              type="tel"
              maxlength="32"
              class="mt-1 input-search pl-4 tabular-nums"
            />
          </label>
        </div>
        <label class="block">
          <span class="smallcaps text-[10px]">Narrative</span>
          <textarea
            v-model="draft.narrative"
            rows="6"
            class="mt-1 input-search pl-4 py-2 leading-relaxed"
            placeholder="Statement…"
          />
        </label>
      </template>

      <template v-else>
        <label class="block">
          <span class="smallcaps text-[10px]">Resolution *</span>
          <textarea
            v-model="draft.narrative"
            rows="8"
            class="mt-1 input-search pl-4 py-2 leading-relaxed"
            placeholder="Describe how the case was resolved…"
          />
        </label>
      </template>

      <p v-if="saveError" class="text-xs text-maroon-accent">{{ saveError }}</p>
      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
          @click="closeComposer"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="!canSave"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'File amendment' }}
        </button>
      </div>
    </div>
  </section>
</template>
