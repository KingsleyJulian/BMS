<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDictionaryStore } from '@/stores/dictionary'
import { useBarangayStore } from '@/stores/barangay'
import { getPb } from '@/services/pocketbase'
import {
  CATEGORY_LABELS,
  DICTIONARY_CATEGORIES,
  type DictionaryCategory
} from '@/data/dictionaryCategories'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dict = useDictionaryStore()
const barangay = useBarangayStore()

interface DraftRow {
  id?: string
  value: string
  deleted?: boolean
}

type Tab = DictionaryCategory | 'SIGNATURE' | 'LETTERHEAD'

const TABS: Tab[] = [...DICTIONARY_CATEGORIES, 'SIGNATURE', 'LETTERHEAD']
const TAB_LABELS: Record<Tab, string> = {
  ...CATEGORY_LABELS,
  SIGNATURE: 'Signature',
  LETTERHEAD: 'Letterhead'
}

const active = ref<Tab>('RELIGION')
const drafts = ref<Record<DictionaryCategory, DraftRow[]>>({
  RELIGION: [],
  BLOCK: [],
  STREET: [],
  ZIP_CODE: [],
  NATURE_OF_WORK: [],
  OCCUPATION: [],
  PURPOSE_OF_CLEARANCE: []
})
const saving = ref(false)
const error = ref<string | null>(null)

// --- Signature ---
const signatureFile = ref<File | null>(null)
const signaturePreviewUrl = ref<string>('') // local preview after pick
const uploadingSignature = ref(false)
const punongName = ref<string>('')
const letterheadText = ref<string>('')

// Identity fields rendered in the certificate header (and the sidebar).
// Stored on barangay_info; not uppercase-locked because the motto and
// proper nouns commonly use mixed case ("Bacolor", quoted motto, etc.).
const identity = reactive({
  name: '',
  motto: '',
  established: '',
  monogram: ''
})
// The "motto" column is repurposed as the address (relabeled in the UI).
const IDENTITY_FIELDS = ['name', 'motto', 'established', 'monogram'] as const

// --- Letterhead logos ---
const leftLogoFile = ref<File | null>(null)
const leftLogoPreviewUrl = ref<string>('')
const rightLogoFile = ref<File | null>(null)
const rightLogoPreviewUrl = ref<string>('')

const persistedLeftLogoUrl = computed(() => {
  const info = barangay.info
  if (!info?.left_logo || !info?.id) return null
  return `${pbBase()}/api/files/barangay_info/${info.id}/${info.left_logo}`
})
const persistedRightLogoUrl = computed(() => {
  const info = barangay.info
  if (!info?.right_logo || !info?.id) return null
  return `${pbBase()}/api/files/barangay_info/${info.id}/${info.right_logo}`
})

function onLeftLogoPicked(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  if (!file) return
  leftLogoFile.value = file
  if (leftLogoPreviewUrl.value) URL.revokeObjectURL(leftLogoPreviewUrl.value)
  leftLogoPreviewUrl.value = URL.createObjectURL(file)
}
function onRightLogoPicked(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  if (!file) return
  rightLogoFile.value = file
  if (rightLogoPreviewUrl.value) URL.revokeObjectURL(rightLogoPreviewUrl.value)
  rightLogoPreviewUrl.value = URL.createObjectURL(file)
}
async function clearLogo(side: 'left' | 'right'): Promise<void> {
  if (!barangay.info?.id) return
  const field = side === 'left' ? 'left_logo' : 'right_logo'
  error.value = null
  try {
    const pb = await getPb()
    const updated = await pb
      .collection('barangay_info')
      .update(barangay.info.id, { [field]: null })
    barangay.info = { ...barangay.info, [field]: '', ...updated }
    if (side === 'left') {
      leftLogoFile.value = null
      if (leftLogoPreviewUrl.value) URL.revokeObjectURL(leftLogoPreviewUrl.value)
      leftLogoPreviewUrl.value = ''
    } else {
      rightLogoFile.value = null
      if (rightLogoPreviewUrl.value) URL.revokeObjectURL(rightLogoPreviewUrl.value)
      rightLogoPreviewUrl.value = ''
    }
  } catch (e) {
    error.value = (e as Error).message
  }
}

const persistedSignatureUrl = computed(() => {
  const info = barangay.info
  if (!info?.signature) return null
  // PB exposes file URLs at /api/files/<collectionId|name>/<recordId>/<file>
  return `${pbBase()}/api/files/barangay_info/${info.id}/${info.signature}`
})

function pbBase(): string {
  // Fallback when called pre-load — barangay.info has the URL via PB SDK,
  // but we don't keep a copy. Use the IPC-backed value.
  return (window as any).__pbBase ?? 'http://127.0.0.1:8090'
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    seedAllDrafts()
    // Cache PB base URL for the persisted signature URL.
    try {
      const url = await window.bms.system.pocketbaseUrl()
      ;(window as any).__pbBase = url
    } catch {
      /* no-op */
    }
  }
)

function seedAllDrafts(): void {
  for (const cat of DICTIONARY_CATEGORIES) {
    drafts.value[cat] = (dict.byCategory[cat] ?? []).map((e) => ({
      id: e.id,
      value: e.value
    }))
  }
  signatureFile.value = null
  if (signaturePreviewUrl.value) URL.revokeObjectURL(signaturePreviewUrl.value)
  signaturePreviewUrl.value = ''
  punongName.value = barangay.info?.punong_barangay_name ?? ''
  letterheadText.value = barangay.info?.letterhead_sidebar ?? ''
  for (const f of IDENTITY_FIELDS) {
    identity[f] = (barangay.info as any)?.[f] ?? ''
  }
  leftLogoFile.value = null
  rightLogoFile.value = null
  if (leftLogoPreviewUrl.value) URL.revokeObjectURL(leftLogoPreviewUrl.value)
  if (rightLogoPreviewUrl.value) URL.revokeObjectURL(rightLogoPreviewUrl.value)
  leftLogoPreviewUrl.value = ''
  rightLogoPreviewUrl.value = ''
  error.value = null
}

function isDictionaryTab(t: Tab): t is DictionaryCategory {
  return t !== 'SIGNATURE' && t !== 'LETTERHEAD'
}

function addRow(): void {
  if (!isDictionaryTab(active.value)) return
  drafts.value[active.value].push({ value: '' })
}

function removeRow(idx: number): void {
  if (!isDictionaryTab(active.value)) return
  const row = drafts.value[active.value][idx]
  if (row.id) row.deleted = !row.deleted
  else drafts.value[active.value].splice(idx, 1)
}

function onSignaturePicked(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  if (!file) return
  signatureFile.value = file
  if (signaturePreviewUrl.value) URL.revokeObjectURL(signaturePreviewUrl.value)
  signaturePreviewUrl.value = URL.createObjectURL(file)
}

async function clearSignature(): Promise<void> {
  if (!barangay.info?.id) return
  uploadingSignature.value = true
  error.value = null
  try {
    const pb = await getPb()
    const updated = await pb
      .collection('barangay_info')
      .update(barangay.info.id, { signature: null })
    barangay.info = { ...barangay.info, signature: '' as any, ...updated }
    signatureFile.value = null
    if (signaturePreviewUrl.value) URL.revokeObjectURL(signaturePreviewUrl.value)
    signaturePreviewUrl.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    uploadingSignature.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  try {
    // 1. Persist dictionary changes
    for (const cat of DICTIONARY_CATEGORIES) {
      const rows = drafts.value[cat]
      const seen = new Set<string>()
      for (const row of rows) {
        const trimmed = row.value.trim().toUpperCase()
        if (row.deleted && row.id) {
          await dict.deleteEntry(row.id)
          continue
        }
        if (!trimmed) continue
        if (seen.has(trimmed)) continue
        seen.add(trimmed)
        if (row.id) {
          const original = dict.entries.find((e) => e.id === row.id)
          if (original && original.value !== trimmed) {
            await dict.updateEntry(row.id, trimmed)
          }
        } else {
          await dict.ensureEntry(cat, trimmed)
        }
      }
    }

    // 2. Persist identity, signature, name, letterhead, logos (single update)
    if (barangay.info?.id) {
      const trimmedName = punongName.value.trim().toUpperCase()
      const trimmedLetterhead = letterheadText.value
      const nameChanged = trimmedName !== (barangay.info.punong_barangay_name ?? '')
      const letterheadChanged =
        trimmedLetterhead !== (barangay.info.letterhead_sidebar ?? '')

      const identityChanges: Record<string, string> = {}
      for (const f of IDENTITY_FIELDS) {
        const next = identity[f].trim()
        if (next !== ((barangay.info as any)[f] ?? '')) identityChanges[f] = next
      }

      const anyFile =
        !!signatureFile.value || !!leftLogoFile.value || !!rightLogoFile.value
      const anyChange =
        anyFile ||
        nameChanged ||
        letterheadChanged ||
        Object.keys(identityChanges).length > 0

      if (anyChange) {
        const pb = await getPb()
        if (anyFile) {
          const fd = new FormData()
          if (signatureFile.value) fd.append('signature', signatureFile.value)
          if (leftLogoFile.value) fd.append('left_logo', leftLogoFile.value)
          if (rightLogoFile.value) fd.append('right_logo', rightLogoFile.value)
          fd.append('punong_barangay_name', trimmedName)
          fd.append('letterhead_sidebar', trimmedLetterhead)
          for (const [k, v] of Object.entries(identityChanges)) fd.append(k, v)
          const updated = await pb.collection('barangay_info').update(barangay.info.id, fd)
          barangay.info = { ...barangay.info, ...updated }
        } else {
          const payload: Record<string, unknown> = { ...identityChanges }
          if (nameChanged) payload.punong_barangay_name = trimmedName
          if (letterheadChanged) payload.letterhead_sidebar = trimmedLetterhead
          const updated = await pb
            .collection('barangay_info')
            .update(barangay.info.id, payload)
          barangay.info = { ...barangay.info, ...updated }
        }
      }
    }

    emit('close')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function close(): void {
  if (saving.value) return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6"
      @click.self="close"
    >
      <div class="card w-full max-w-6xl max-h-[90vh] flex flex-col p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="smallcaps">Settings</div>
            <h2 class="text-xl font-semibold">Settings</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
            @click="close"
          >
            ×
          </button>
        </div>

        <div class="flex flex-wrap gap-1 mb-4 border-b border-cream-300/70">
          <button
            v-for="tab in TABS"
            :key="tab"
            type="button"
            class="px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors"
            :class="
              active === tab
                ? 'border-maroon-accent text-maroon-accent font-medium'
                : 'border-transparent text-ink-700 hover:text-ink-900'
            "
            @click="active = tab"
          >
            {{ TAB_LABELS[tab] }}
          </button>
        </div>

        <!-- Dictionary tabs -->
        <div v-if="isDictionaryTab(active)" class="overflow-auto flex-1 -mx-2 px-2">
          <div v-if="drafts[active].length === 0" class="text-sm text-ink-600 py-4 text-center">
            No entries yet. Click "+ Add entry" below to start.
          </div>
          <div
            v-for="(row, idx) in drafts[active]"
            :key="row.id ?? `new-${idx}`"
            class="flex items-center gap-2 mb-2"
            :class="{ 'opacity-40': row.deleted }"
          >
            <input
              v-model="row.value"
              v-uppercase
              :disabled="row.deleted"
              class="input-search pl-4 flex-1"
              :placeholder="`New ${TAB_LABELS[active].toLowerCase()}`"
            />
            <button
              type="button"
              class="w-9 h-9 grid place-items-center rounded-full text-ink-600 hover:bg-maroon-accent/10 hover:text-maroon-accent transition-colors"
              :title="row.deleted ? 'Undo delete' : 'Remove'"
              @click="removeRow(idx)"
            >
              <svg
                v-if="!row.deleted"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 12a9 9 0 1015.59-6.36L21 3M21 3v5h-5"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Letterhead tab — identity, sidebar text, left/right logos -->
        <div v-else-if="active === 'LETTERHEAD'" class="overflow-auto flex-1 -mx-2 px-2">
          <div class="space-y-8 max-w-3xl">
            <!-- Barangay identity (printed in the certificate header) -->
            <div class="space-y-3">
              <h3 class="text-base font-semibold">Barangay identity</h3>
              <p class="text-xs text-ink-600">
                Drives the centered block in the certificate's letterhead and the app sidebar.
                The barangay name is printed in upper case automatically; the rest are shown
                as-typed (mixed case is fine for proper nouns and the motto).
              </p>
              <div class="grid grid-cols-12 gap-3">
                <label class="col-span-5 block">
                  <span class="smallcaps">Barangay name</span>
                  <input v-model="identity.name" class="mt-1 input-search pl-4" />
                </label>
                <label class="col-span-7 block">
                  <span class="smallcaps">Address</span>
                  <input
                    v-model="identity.motto"
                    class="mt-1 input-search pl-4"
                    placeholder="e.g. Bacolor, Pampanga"
                  />
                </label>
                <label class="col-span-9 block">
                  <span class="smallcaps">Established / footer line (sidebar)</span>
                  <input
                    v-model="identity.established"
                    class="mt-1 input-search pl-4"
                    placeholder="e.g. Villa de Bacolor · Est. 1576"
                  />
                </label>
                <label class="col-span-3 block">
                  <span class="smallcaps">Monogram (sidebar fallback)</span>
                  <input
                    v-model="identity.monogram"
                    v-uppercase
                    maxlength="4"
                    class="mt-1 input-search pl-4"
                    placeholder="SI"
                  />
                </label>
              </div>
            </div>

            <!-- Logos -->
            <div class="space-y-3 border-t border-cream-300/60 pt-6">
              <h3 class="text-base font-semibold">Header logos</h3>
              <p class="text-xs text-ink-600">
                Two square images that appear flanking the barangay name on issued
                certifications. Leave blank to fall back to the monogram circle.
              </p>
              <div class="grid grid-cols-2 gap-6">
                <!-- Left -->
                <div class="space-y-2">
                  <span class="smallcaps">Left logo</span>
                  <div
                    class="aspect-square w-full max-w-[160px] bg-cream-200 rounded-lg overflow-hidden grid place-items-center border border-cream-300/60"
                  >
                    <img
                      v-if="leftLogoPreviewUrl"
                      :src="leftLogoPreviewUrl"
                      class="w-full h-full object-contain"
                      alt="Pending left logo"
                    />
                    <img
                      v-else-if="persistedLeftLogoUrl"
                      :src="persistedLeftLogoUrl"
                      class="w-full h-full object-contain"
                      alt="Saved left logo"
                    />
                    <span v-else class="text-xs text-ink-600 text-center px-2">No left logo</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <label
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-ink-800 hover:bg-cream-200 cursor-pointer transition"
                    >
                      <span>{{ persistedLeftLogoUrl ? 'Replace' : 'Choose file…' }}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        class="hidden"
                        @change="onLeftLogoPicked"
                      />
                    </label>
                    <button
                      v-if="persistedLeftLogoUrl"
                      type="button"
                      class="text-xs text-maroon-accent hover:text-maroon-700"
                      @click="clearLogo('left')"
                    >
                      Remove saved
                    </button>
                  </div>
                </div>

                <!-- Right -->
                <div class="space-y-2">
                  <span class="smallcaps">Right logo</span>
                  <div
                    class="aspect-square w-full max-w-[160px] bg-cream-200 rounded-lg overflow-hidden grid place-items-center border border-cream-300/60"
                  >
                    <img
                      v-if="rightLogoPreviewUrl"
                      :src="rightLogoPreviewUrl"
                      class="w-full h-full object-contain"
                      alt="Pending right logo"
                    />
                    <img
                      v-else-if="persistedRightLogoUrl"
                      :src="persistedRightLogoUrl"
                      class="w-full h-full object-contain"
                      alt="Saved right logo"
                    />
                    <span v-else class="text-xs text-ink-600 text-center px-2">No right logo</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <label
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-ink-800 hover:bg-cream-200 cursor-pointer transition"
                    >
                      <span>{{ persistedRightLogoUrl ? 'Replace' : 'Choose file…' }}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        class="hidden"
                        @change="onRightLogoPicked"
                      />
                    </label>
                    <button
                      v-if="persistedRightLogoUrl"
                      type="button"
                      class="text-xs text-maroon-accent hover:text-maroon-700"
                      @click="clearLogo('right')"
                    >
                      Remove saved
                    </button>
                  </div>
                </div>
              </div>
              <p class="text-[11px] text-ink-600">
                PNG, JPG, WebP, or SVG. Max 2 MB each. Click "Save changes" below to upload.
              </p>
            </div>

            <!-- Sidebar text -->
            <div class="space-y-3 border-t border-cream-300/60 pt-6">
              <h3 class="text-base font-semibold">Side panel text</h3>
              <p class="text-xs text-ink-600">
                Text shown on the left side of issued certifications. Blank lines separate
                sections — the first line of each is rendered as a blue title; the rest are
                stacked below.
              </p>
              <textarea
                v-model="letterheadText"
                v-uppercase
                rows="16"
                class="w-full px-4 py-3 rounded-lg bg-cream-50 border border-cream-300 focus:outline-none focus:ring-2 focus:ring-maroon-accent/30 text-sm font-mono leading-relaxed"
                placeholder="PUNONG BARANGAY&#10;HON. FELICIANO F. DELA CRUZ&#10;&#10;BARANGAY COUNCIL&#10;HON. DANILO S. DRUECO&#10;HON. CARLOS M. MEDINA JR."
              />
            </div>
          </div>
        </div>

        <!-- Signature tab -->
        <div v-else class="overflow-auto flex-1 -mx-2 px-2">
          <div class="space-y-4">
            <label class="block max-w-md">
              <span class="smallcaps">Punong Barangay name (printed below signature)</span>
              <input
                v-model="punongName"
                v-uppercase
                class="mt-1 input-search pl-4"
                placeholder="HON. JUAN DELA CRUZ"
              />
            </label>

            <p class="text-sm text-ink-700">
              Upload an image of the barangay captain's signature. This will be embedded into
              issued clearance documents.
            </p>

            <div
              class="aspect-[3/1] bg-cream-200 rounded-lg overflow-hidden grid place-items-center border border-cream-300/60"
            >
              <img
                v-if="signaturePreviewUrl"
                :src="signaturePreviewUrl"
                class="max-w-full max-h-full object-contain"
                alt="Pending signature"
              />
              <img
                v-else-if="persistedSignatureUrl"
                :src="persistedSignatureUrl"
                class="max-w-full max-h-full object-contain"
                alt="Saved signature"
              />
              <span v-else class="text-sm text-ink-600">No signature uploaded yet.</span>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <label
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cream-50 border border-cream-300 text-sm text-ink-800 hover:bg-cream-200 cursor-pointer transition"
              >
                <span>{{ persistedSignatureUrl ? 'Replace signature' : 'Choose file…' }}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  class="hidden"
                  @change="onSignaturePicked"
                />
              </label>
              <button
                v-if="persistedSignatureUrl"
                type="button"
                class="text-sm text-maroon-accent hover:text-maroon-700"
                :disabled="uploadingSignature"
                @click="clearSignature"
              >
                Remove saved signature
              </button>
              <span class="text-xs text-ink-600">
                PNG, JPG, WebP, or SVG. Max 2 MB. Click "Save changes" below to upload.
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-4 border-t border-cream-300/60 mt-4">
          <button
            v-if="isDictionaryTab(active)"
            type="button"
            class="text-sm text-maroon-accent hover:text-maroon-700 font-medium"
            @click="addRow"
          >
            + Add entry
          </button>
          <span v-else></span>

          <div class="flex items-center gap-3">
            <p v-if="error" class="text-xs text-maroon-accent">{{ error }}</p>
            <button
              type="button"
              class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
              :disabled="saving"
              @click="close"
            >
              Cancel
            </button>
            <button class="btn-primary" :disabled="saving" @click="save">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
