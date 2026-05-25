<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBarangayStore } from '@/stores/barangay'
import { useDictionaryStore } from '@/stores/dictionary'
import { residencyToWords } from '@/composables/residencyToWords'
import IdSelector from '@/components/IdSelector.vue'
import AutocompleteInput from '@/components/AutocompleteInput.vue'
import DictionaryManager from '@/components/DictionaryManager.vue'
import DictionaryModalSelector from '@/components/DictionaryModalSelector.vue'
import WebcamCapture from '@/components/WebcamCapture.vue'
import PhAddressFields from '@/components/PhAddressFields.vue'
import { getPb } from '@/services/pocketbase'
import type { ValidId } from '@/data/validIds'

const dict = useDictionaryStore()
const router = useRouter()
const settingsOpen = ref(false)
const profilePhoto = ref<Blob | null>(null)

// --- Duplicate detection ---
interface DuplicateRow {
  id: string
  first_name: string
  middle_name: string
  last_name: string
}
const duplicates = ref<DuplicateRow[]>([])
const checkingDuplicates = ref(false)
let dupTimer: ReturnType<typeof setTimeout> | null = null

const barangay = useBarangayStore()

interface IdEntry {
  type: string
  name: string
  group: string
  number: string
  expiry: string
  photoFile: File | null
  photoUrl: string
}

type CivilStatus =
  | ''
  | 'SINGLE'
  | 'MARRIED'
  | 'LIVE_IN'
  | 'WIDOWED'
  | 'SEPARATED'
  | 'ANNULLED'

type Gender = '' | 'MALE' | 'FEMALE'

interface ClearanceForm {
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string
  gender: Gender
  civil_status: CivilStatus
  religion: string
  spouse_maiden_name: string
  spouse_phone: string

  house_no: string
  block: string
  street: string
  address_barangay: string
  city: string
  zip_code: string

  mailing_same_as_address: boolean
  mailing_house_no: string
  mailing_block: string
  mailing_street: string
  mailing_address_barangay: string
  mailing_city: string
  mailing_zip_code: string

  contact_number: string
  email: string
  messenger: string
  viber: string
  whatsapp: string

  nature_of_work: string
  occupation: string

  months_of_residency: number | null

  purpose_of_clearance: string

  identifications: IdEntry[]
}

function blank(): ClearanceForm {
  return {
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    date_of_birth: '',
    gender: '',
    civil_status: '',
    religion: '',
    spouse_maiden_name: '',
    spouse_phone: '',
    house_no: '',
    block: '',
    street: '',
    address_barangay: barangay.info.name ?? '',
    city: barangay.addressLine ?? '',
    zip_code: '',
    mailing_same_as_address: false,
    mailing_house_no: '',
    mailing_block: '',
    mailing_street: '',
    mailing_address_barangay: '',
    mailing_city: '',
    mailing_zip_code: '',
    contact_number: '',
    email: '',
    messenger: '',
    viber: '',
    whatsapp: '',
    nature_of_work: '',
    occupation: '',
    months_of_residency: null,
    purpose_of_clearance: '',
    identifications: []
  }
}

const form = reactive<ClearanceForm>(blank())
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

/**
 * Watch the three name fields and run a debounced PocketBase query for any
 * existing clearance application matching the *exact* same name. We use the
 * SDK's `pb.filter()` template helper so user-typed values are escaped
 * before they hit the filter expression.
 */
async function checkDuplicates(): Promise<void> {
  const first = form.first_name.trim().toUpperCase()
  const last = form.last_name.trim().toUpperCase()
  if (!first || !last) {
    duplicates.value = []
    return
  }
  checkingDuplicates.value = true
  try {
    const pb = await getPb()
    const middle = form.middle_name.trim().toUpperCase()
    const filter = middle
      ? pb.filter(
          'first_name = {:first} && middle_name = {:middle} && last_name = {:last}',
          { first, middle, last }
        )
      : pb.filter('first_name = {:first} && last_name = {:last}', { first, last })
    const list = await pb
      .collection('clearance_applications')
      .getFullList<DuplicateRow>({ filter })
    duplicates.value = list
  } catch {
    duplicates.value = []
  } finally {
    checkingDuplicates.value = false
  }
}

watch(
  () => [form.first_name, form.middle_name, form.last_name] as const,
  () => {
    if (dupTimer) clearTimeout(dupTimer)
    dupTimer = setTimeout(() => void checkDuplicates(), 400)
  }
)

onUnmounted(() => {
  if (dupTimer) clearTimeout(dupTimer)
})

function viewDuplicates(): void {
  void router.push({
    path: '/citizens',
    query: {
      first: form.first_name,
      middle: form.middle_name,
      last: form.last_name
    }
  })
}

/** Married AND Live-in both surface a partner-name + partner-mobile pair. */
const showsPartnerFields = computed(
  () => form.civil_status === 'MARRIED' || form.civil_status === 'LIVE_IN'
)

const partnerNameLabel = computed(() =>
  form.civil_status === 'LIVE_IN' ? 'Live-in partner name' : 'Spouse full maiden name'
)
const partnerPhoneLabel = computed(() =>
  form.civil_status === 'LIVE_IN' ? 'Live-in partner mobile' : 'Spouse mobile'
)

/**
 * When the "same as full address" toggle is on, mirror every full-address
 * field into the mailing-address fields — both at the moment the toggle
 * flips on AND on every subsequent edit to the source. When the toggle is
 * off, mailing fields keep their last value and become editable again.
 */
function mirrorAddress(): void {
  form.mailing_house_no = form.house_no
  form.mailing_block = form.block
  form.mailing_street = form.street
  form.mailing_address_barangay = form.address_barangay
  form.mailing_city = form.city
  form.mailing_zip_code = form.zip_code
}

watch(
  () => form.mailing_same_as_address,
  (same) => {
    if (same) mirrorAddress()
  }
)
watch(
  () => [
    form.house_no,
    form.block,
    form.street,
    form.address_barangay,
    form.city,
    form.zip_code
  ],
  () => {
    if (form.mailing_same_as_address) mirrorAddress()
  }
)

const residencyPreview = computed(() => {
  if (form.months_of_residency == null) return ''
  return residencyToWords(form.months_of_residency, barangay.info.name)
})

const alreadyPickedIds = computed(() => form.identifications.map((i) => i.type))

function addIdentification(picked: ValidId | null): void {
  if (!picked) return
  form.identifications.push({
    type: picked.id,
    name: picked.name,
    group: picked.group,
    number: '',
    expiry: '',
    photoFile: null,
    photoUrl: ''
  })
}

function removeIdentification(idx: number): void {
  const entry = form.identifications[idx]
  if (entry?.photoUrl) URL.revokeObjectURL(entry.photoUrl)
  form.identifications.splice(idx, 1)
}

function onIdPhotoPicked(e: Event, idx: number): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const entry = form.identifications[idx]
  if (!entry) return
  if (entry.photoUrl) URL.revokeObjectURL(entry.photoUrl)
  entry.photoFile = file
  entry.photoUrl = URL.createObjectURL(file)
  // Clear the input so the same file can be re-picked if needed.
  ;(e.target as HTMLInputElement).value = ''
}

// --- Webcam capture for ID photos ---
const capturingForIdx = ref<number | null>(null)
const capturingBlob = ref<Blob | null>(null)

function openWebcamFor(idx: number): void {
  capturingBlob.value = null
  capturingForIdx.value = idx
}

function closeWebcam(): void {
  capturingForIdx.value = null
  capturingBlob.value = null
}

// When the user captures, the WebcamCapture component flips its v-model to
// a Blob. Pull it into the right ID row, convert to File so PocketBase has a
// filename for the upload, and close the modal.
watch(capturingBlob, (blob) => {
  if (!blob || capturingForIdx.value === null) return
  const entry = form.identifications[capturingForIdx.value]
  if (!entry) return
  if (entry.photoUrl) URL.revokeObjectURL(entry.photoUrl)
  entry.photoFile = new File([blob], `id-photo-${Date.now()}.jpg`, { type: blob.type })
  entry.photoUrl = URL.createObjectURL(blob)
  closeWebcam()
})

function reset(): void {
  // Free any pending object URLs before nuking the array.
  for (const id of form.identifications) {
    if (id.photoUrl) URL.revokeObjectURL(id.photoUrl)
  }
  Object.assign(form, blank())
  error.value = null
  success.value = null
}

async function submit(): Promise<void> {
  error.value = null
  success.value = null
  if (duplicates.value.length > 0) {
    error.value = 'A clearance application for this name already exists. Open Citizens to review.'
    return
  }
  if (!form.first_name || !form.last_name) {
    error.value = 'First name and last name are required.'
    return
  }
  if (!form.date_of_birth) {
    error.value = 'Date of birth is required.'
    return
  }
  if (!form.gender) {
    error.value = 'Gender is required.'
    return
  }
  if (!form.civil_status) {
    error.value = 'Civil status is required.'
    return
  }
  if (
    showsPartnerFields.value &&
    (!form.spouse_maiden_name.trim() || !form.spouse_phone.trim())
  ) {
    error.value =
      form.civil_status === 'LIVE_IN'
        ? 'Live-in partner name and mobile number are required.'
        : 'Spouse maiden name and mobile number are required when married.'
    return
  }
  if (!form.house_no || !form.street || !form.city || !form.zip_code) {
    error.value = 'House/Lot, Street, City, and Zip Code are required.'
    return
  }
  if (!form.contact_number) {
    error.value = 'Contact number is required.'
    return
  }
  if (form.months_of_residency == null || form.months_of_residency <= 0) {
    error.value = 'Years of Residency is required (input in months — see hint).'
    return
  }
  if (!form.purpose_of_clearance.trim()) {
    error.value = 'Purpose of clearance is required.'
    return
  }
  if (form.identifications.length === 0) {
    error.value = 'At least one identification is required.'
    return
  }
  for (const id of form.identifications) {
    if (!id.photoFile) {
      error.value = `A photo is required for ${id.name}.`
      return
    }
    if (!id.number.trim()) {
      error.value = `ID number is required for ${id.name}.`
      return
    }
  }

  submitting.value = true
  try {
    // Auto-add any new dictionary values so they show up as suggestions next time.
    await Promise.all([
      dict.ensureEntry('RELIGION', form.religion),
      dict.ensureEntry('BLOCK', form.block),
      dict.ensureEntry('STREET', form.street),
      dict.ensureEntry('ZIP_CODE', form.zip_code),
      dict.ensureEntry('NATURE_OF_WORK', form.nature_of_work),
      dict.ensureEntry('OCCUPATION', form.occupation),
      dict.ensureEntry('PURPOSE_OF_CLEARANCE', form.purpose_of_clearance),
      // Mailing values are only worth indexing when they differ.
      form.mailing_same_as_address
        ? Promise.resolve(null)
        : Promise.all([
            dict.ensureEntry('BLOCK', form.mailing_block),
            dict.ensureEntry('STREET', form.mailing_street),
            dict.ensureEntry('ZIP_CODE', form.mailing_zip_code)
          ])
    ])

    const pb = await getPb()
    const payload: Record<string, unknown> = {
      first_name: form.first_name,
      middle_name: form.middle_name,
      last_name: form.last_name,
      suffix: form.suffix,
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      civil_status: form.civil_status,
      religion: form.religion,
      spouse_maiden_name: showsPartnerFields.value ? form.spouse_maiden_name : '',
      spouse_phone: showsPartnerFields.value ? form.spouse_phone : '',
      house_no: form.house_no,
      block: form.block,
      street: form.street,
      address_barangay: form.address_barangay,
      city: form.city,
      zip_code: form.zip_code,
      mailing_same_as_address: form.mailing_same_as_address,
      mailing_house_no: form.mailing_house_no,
      mailing_block: form.mailing_block,
      mailing_street: form.mailing_street,
      mailing_address_barangay: form.mailing_address_barangay,
      mailing_city: form.mailing_city,
      mailing_zip_code: form.mailing_zip_code,
      contact_number: form.contact_number,
      email: form.email,
      messenger: form.messenger,
      viber: form.viber,
      whatsapp: form.whatsapp,
      nature_of_work: form.nature_of_work,
      occupation: form.occupation,
      months_of_residency: form.months_of_residency,
      purpose_of_clearance: form.purpose_of_clearance
      // identifications are no longer persisted as a JSON field — each one
      // becomes its own row in the `id_documents` collection below so we can
      // attach a real photo file per ID.
    }

    let createdApp: { id: string } = { id: '' }
    if (profilePhoto.value) {
      const fd = new FormData()
      for (const [k, v] of Object.entries(payload)) {
        if (v === null || v === undefined) continue
        if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) {
          fd.append(k, JSON.stringify(v))
        } else {
          fd.append(k, String(v))
        }
      }
      fd.append('profile_photo', profilePhoto.value, 'photo.jpg')
      createdApp = await pb.collection('clearance_applications').create<{ id: string }>(fd)
    } else {
      createdApp = await pb.collection('clearance_applications').create<{ id: string }>(payload)
    }

    // Persist each identification as its own row with the photo file.
    for (const id of form.identifications) {
      const fd = new FormData()
      fd.append('clearance', createdApp.id)
      fd.append('type', id.type)
      fd.append('name', id.name)
      if (id.group) fd.append('group', id.group)
      fd.append('number', id.number)
      if (id.expiry) fd.append('expiry', id.expiry)
      if (id.photoFile) fd.append('photo', id.photoFile)
      await pb.collection('id_documents').create(fd)
    }
    const fullName = [form.first_name, form.last_name, form.suffix].filter(Boolean).join(' ')
    success.value = `Clearance application saved for ${fullName}. Opening certificate…`
    profilePhoto.value = null
    reset()
    // Hand off to the certificate preview so the user can print/PDF
    // the freshly issued certification.
    if (createdApp.id) {
      void router.push({ name: 'certificate', params: { id: createdApp.id } })
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Top toolbar: gear opens the settings modal -->
    <div class="flex justify-end">
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        class="w-10 h-10 grid place-items-center rounded-lg text-ink-700
               hover:bg-cream-200 transition"
        @click="settingsOpen = true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- Duplicate-detection banner — surfaces hits from /clearance_applications -->
    <div
      v-if="duplicates.length > 0"
      class="card p-5 border-l-4 border-maroon-accent flex items-start gap-4"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-6 h-6 text-maroon-accent shrink-0 mt-0.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z"
        />
      </svg>
      <div class="flex-1">
        <p class="font-semibold text-ink-900">Possible duplicate found</p>
        <p class="text-sm text-ink-700 mt-1">
          {{ duplicates.length }} existing clearance
          {{ duplicates.length === 1 ? 'application matches' : 'applications match' }}
          this name. Submission is blocked until you confirm this isn't a duplicate.
        </p>
      </div>
      <button type="button" class="btn-primary shrink-0" @click="viewDuplicates">
        View existing entries
      </button>
    </div>

    <form class="space-y-6" @submit.prevent="submit">
      <!-- Profile photo + Clearance purpose share the top row -->
      <section class="card p-8">
        <div class="flex items-start gap-8">
          <div class="w-40 shrink-0">
            <WebcamCapture v-model="profilePhoto" circular />
          </div>
          <div class="flex-1 space-y-5">
            <div>
              <h2 class="text-xl font-semibold">Profile Photo</h2>
              <p class="text-xs text-ink-600 mt-1 max-w-md">
                Capture a photo of the applicant via webcam. Optional but recommended.
              </p>
            </div>
            <div class="border-t border-cream-300/60 pt-5">
              <h2 class="text-xl font-semibold mb-3">Clearance Purpose *</h2>
              <div class="grid grid-cols-12 gap-4">
                <label class="col-span-8 block">
                  <span class="smallcaps">Purpose of clearance *</span>
                  <DictionaryModalSelector
                    v-model="form.purpose_of_clearance"
                    category="PURPOSE_OF_CLEARANCE"
                    placeholder="SELECT A PURPOSE…"
                    class="mt-1"
                  />
                  <span class="block text-[11px] text-ink-600 mt-1">
                    Manage the list via the gear icon → Settings → Purpose of Clearance.
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Personal Information -->
      <section class="card p-8 space-y-4">
        <h2 class="text-xl font-semibold">Personal Information</h2>
        <div class="grid grid-cols-12 gap-4">
          <label class="block col-span-3">
            <span class="smallcaps">First name *</span>
            <input v-model="form.first_name" v-uppercase class="mt-1 input-search pl-4" />
          </label>
          <label class="block col-span-3">
            <span class="smallcaps">Middle name</span>
            <input v-model="form.middle_name" v-uppercase class="mt-1 input-search pl-4" />
          </label>
          <label class="block col-span-3">
            <span class="smallcaps">Last name *</span>
            <input v-model="form.last_name" v-uppercase class="mt-1 input-search pl-4" />
          </label>
          <label class="block col-span-1">
            <span class="smallcaps">Suffix</span>
            <input
              v-model="form.suffix"
              v-uppercase
              class="mt-1 input-search pl-4"
              placeholder="JR."
            />
          </label>
          <label class="block col-span-2">
            <span class="smallcaps">Date of birth *</span>
            <input v-model="form.date_of_birth" type="date" class="mt-1 input-search pl-4" />
          </label>

          <label class="block col-span-2">
            <span class="smallcaps">Gender *</span>
            <select v-model="form.gender" class="mt-1 select-base w-full">
              <option value="">Select…</option>
              <option value="MALE">MALE</option>
              <option value="FEMALE">FEMALE</option>
            </select>
          </label>
          <label class="block col-span-3">
            <span class="smallcaps">Civil status *</span>
            <select v-model="form.civil_status" class="mt-1 select-base w-full">
              <option value="">Select…</option>
              <option value="SINGLE">SINGLE</option>
              <option value="MARRIED">MARRIED</option>
              <option value="LIVE_IN">SINGLE / WITH LIVE-IN PARTNER</option>
              <option value="WIDOWED">WIDOWED</option>
              <option value="SEPARATED">SEPARATED</option>
              <option value="ANNULLED">ANNULLED</option>
            </select>
          </label>
          <label class="block col-span-3">
            <span class="smallcaps">Religion</span>
            <AutocompleteInput
              v-model="form.religion"
              category="RELIGION"
              class="mt-1"
              placeholder="START TYPING…"
            />
          </label>
          <template v-if="showsPartnerFields">
            <label class="block col-span-2 col-start-1">
              <span class="smallcaps">{{ partnerNameLabel }} *</span>
              <input
                v-model="form.spouse_maiden_name"
                v-uppercase
                class="mt-1 input-search pl-4"
              />
            </label>
            <label class="block col-span-2">
              <span class="smallcaps">{{ partnerPhoneLabel }} *</span>
              <input
                v-model="form.spouse_phone"
                v-mobile
                inputmode="tel"
                class="mt-1 input-search pl-4"
                placeholder="09XXXXXXXXX"
              />
            </label>
          </template>
        </div>
      </section>

      <!-- Address — single wide row -->
      <section class="card p-8 space-y-4">
        <h2 class="text-xl font-semibold">Full Address</h2>
        <div class="grid grid-cols-12 gap-4">
          <label class="block col-span-3">
            <span class="smallcaps">House / Lot No. *</span>
            <input v-model="form.house_no" v-uppercase class="mt-1 input-search pl-4" />
          </label>
          <label class="block col-span-2">
            <span class="smallcaps">Block</span>
            <AutocompleteInput v-model="form.block" category="BLOCK" class="mt-1" />
          </label>
          <label class="block col-span-5">
            <span class="smallcaps">Street *</span>
            <AutocompleteInput v-model="form.street" category="STREET" class="mt-1" />
          </label>
          <label class="block col-span-2">
            <span class="smallcaps">Zip code *</span>
            <AutocompleteInput v-model="form.zip_code" category="ZIP_CODE" class="mt-1" />
          </label>
        </div>
        <PhAddressFields
          :city="form.city"
          :barangay="form.address_barangay"
          @update:city="form.city = $event"
          @update:barangay="form.address_barangay = $event"
        />
      </section>

      <!-- Mailing Address — same fields, optional toggle to mirror full address -->
      <section class="card p-8 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <h2 class="text-xl font-semibold">Mailing Address</h2>

          <label class="inline-flex items-center cursor-pointer gap-3 select-none">
            <input
              v-model="form.mailing_same_as_address"
              type="checkbox"
              class="sr-only peer"
            />
            <span
              class="relative w-10 h-6 bg-cream-300 peer-checked:bg-maroon-accent rounded-full transition-colors"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"
              />
            </span>
            <span class="text-sm">Same as full address</span>
          </label>
        </div>

        <div
          class="space-y-4"
          :class="{ 'opacity-60': form.mailing_same_as_address }"
        >
          <div class="grid grid-cols-12 gap-4">
            <label class="block col-span-3">
              <span class="smallcaps">House / Lot No.</span>
              <input
                v-model="form.mailing_house_no"
                v-uppercase
                :disabled="form.mailing_same_as_address"
                class="mt-1 input-search pl-4 disabled:cursor-not-allowed"
              />
            </label>
            <label class="block col-span-2">
              <span class="smallcaps">Block</span>
              <AutocompleteInput
                v-model="form.mailing_block"
                category="BLOCK"
                class="mt-1"
                :disabled="form.mailing_same_as_address"
              />
            </label>
            <label class="block col-span-5">
              <span class="smallcaps">Street</span>
              <AutocompleteInput
                v-model="form.mailing_street"
                category="STREET"
                class="mt-1"
                :disabled="form.mailing_same_as_address"
              />
            </label>
            <label class="block col-span-2">
              <span class="smallcaps">Zip code</span>
              <AutocompleteInput
                v-model="form.mailing_zip_code"
                category="ZIP_CODE"
                class="mt-1"
                :disabled="form.mailing_same_as_address"
              />
            </label>
          </div>
          <PhAddressFields
            :city="form.mailing_city"
            :barangay="form.mailing_address_barangay"
            :disabled="form.mailing_same_as_address"
            @update:city="form.mailing_city = $event"
            @update:barangay="form.mailing_address_barangay = $event"
          />
        </div>
      </section>

      <!-- Contact — single wide row -->
      <section class="card p-8 space-y-4">
        <h2 class="text-xl font-semibold">Contact</h2>
        <div class="grid grid-cols-12 gap-4">
          <label class="block col-span-2">
            <span class="smallcaps">Contact number *</span>
            <input
              v-model="form.contact_number"
              v-mobile
              inputmode="tel"
              class="mt-1 input-search pl-4"
              placeholder="09XXXXXXXXX"
            />
          </label>
          <label class="block col-span-3">
            <span class="smallcaps">Email address</span>
            <input
              v-model="form.email"
              type="email"
              class="mt-1 input-search pl-4"
              placeholder="juan@example.com"
            />
          </label>
          <label class="block col-span-3">
            <span class="smallcaps">Facebook Messenger</span>
            <input
              v-model="form.messenger"
              class="mt-1 input-search pl-4"
              placeholder="m.me/username"
            />
            <details class="mt-1 text-xs">
              <summary class="cursor-pointer text-maroon-accent select-none">
                How do I get my m.me link?
              </summary>
              <ol
                class="mt-2 p-3 bg-cream-200 rounded text-ink-700 space-y-1 list-decimal list-inside"
              >
                <li>Open Facebook on phone or web.</li>
                <li>Go to <strong>Settings &amp; Privacy → Settings → Username</strong>.</li>
                <li>Set or copy your username (e.g. <code>juan.dela.cruz</code>).</li>
                <li>
                  Your Messenger link is <code>m.me/&lt;username&gt;</code> — paste only that
                  part.
                </li>
              </ol>
            </details>
          </label>
          <label class="block col-span-2">
            <span class="smallcaps">Viber number</span>
            <input
              v-model="form.viber"
              v-mobile
              inputmode="tel"
              class="mt-1 input-search pl-4"
              placeholder="09XXXXXXXXX"
            />
          </label>
          <label class="block col-span-2">
            <span class="smallcaps">WhatsApp number</span>
            <input
              v-model="form.whatsapp"
              v-mobile
              inputmode="tel"
              class="mt-1 input-search pl-4"
              placeholder="09XXXXXXXXX"
            />
          </label>
        </div>
      </section>

      <!-- Employment & Residency — share a row -->
      <section class="card p-8 space-y-4">
        <h2 class="text-xl font-semibold">Employment &amp; Residency</h2>
        <div class="grid grid-cols-12 gap-4 items-start">
          <label class="block col-span-4">
            <span class="smallcaps">Nature of work (optional)</span>
            <AutocompleteInput
              v-model="form.nature_of_work"
              category="NATURE_OF_WORK"
              class="mt-1"
            />
          </label>
          <label class="block col-span-4">
            <span class="smallcaps">Occupation (optional)</span>
            <AutocompleteInput v-model="form.occupation" category="OCCUPATION" class="mt-1" />
          </label>
          <label class="block col-span-4">
            <span class="smallcaps">Years of Residency *</span>
            <input
              v-model.number="form.months_of_residency"
              type="number"
              step="0.01"
              min="0"
              class="mt-1 input-search pl-4"
              placeholder="e.g. 13"
            />
            <span class="block text-[11px] text-ink-600 mt-1">
              Decimals allowed. Input is in months — 0.5 = half a month, 12 = 1 year, 13 = 1 year +
              1 month.
            </span>
          </label>
        </div>
        <p
          v-if="residencyPreview"
          class="text-sm italic text-ink-700 bg-cream-200 px-4 py-2 rounded"
        >
          {{ residencyPreview }}
        </p>
      </section>

      <!-- Identifications (add-as-you-go, each with a photo) -->
      <section class="card p-8 space-y-4">
        <h2 class="text-xl font-semibold">Identifications *</h2>
        <p class="text-xs text-ink-600">
          At least one identification is required. For each, attach a photo of the ID for proof.
          Select the ID type from the dropdown to add it.
        </p>

        <div v-if="form.identifications.length > 0" class="space-y-3">
          <div
            v-for="(entry, idx) in form.identifications"
            :key="entry.type + idx"
            class="grid grid-cols-12 gap-3 items-end border-t border-cream-300/60 pt-4 first:border-t-0 first:pt-0"
          >
            <div class="col-span-3">
              <div class="text-sm font-medium">{{ entry.name }}</div>
              <div class="smallcaps mt-0.5">{{ entry.group }}</div>
            </div>
            <div class="col-span-2">
              <span class="smallcaps">ID photo *</span>

              <!-- Captured/uploaded preview with hover replace controls -->
              <div
                v-if="entry.photoUrl"
                class="mt-1 h-20 rounded-lg overflow-hidden border border-cream-300 relative group"
              >
                <img
                  :src="entry.photoUrl"
                  class="w-full h-full object-cover"
                  alt="ID photo"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center gap-2 bg-ink-900/0 group-hover:bg-ink-900/40 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <label
                    class="cursor-pointer w-8 h-8 grid place-items-center rounded-full bg-cream-50 text-ink-800 hover:bg-cream-100"
                    title="Replace from file"
                  >
                    <svg
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
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      class="hidden"
                      @change="onIdPhotoPicked($event, idx)"
                    />
                  </label>
                  <button
                    type="button"
                    class="w-8 h-8 grid place-items-center rounded-full bg-cream-50 text-ink-800 hover:bg-cream-100"
                    title="Replace via webcam"
                    @click="openWebcamFor(idx)"
                  >
                    <svg
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
                        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Empty state: side-by-side Upload / Webcam picker -->
              <div
                v-else
                class="mt-1 h-20 rounded-lg border-2 border-dashed border-cream-300
                       flex items-stretch divide-x divide-cream-300 overflow-hidden"
              >
                <label
                  class="flex-1 grid place-items-center cursor-pointer hover:bg-cream-200 transition-colors text-ink-700"
                  title="Upload from file"
                >
                  <div class="text-center px-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4 mx-auto mb-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.6"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                    <div class="text-[10px]">Upload</div>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="onIdPhotoPicked($event, idx)"
                  />
                </label>
                <button
                  type="button"
                  class="flex-1 grid place-items-center hover:bg-cream-200 transition-colors text-ink-700"
                  title="Capture via webcam"
                  @click="openWebcamFor(idx)"
                >
                  <div class="text-center px-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4 mx-auto mb-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.6"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <div class="text-[10px]">Webcam</div>
                  </div>
                </button>
              </div>
            </div>
            <label class="col-span-3 block">
              <span class="smallcaps">ID number *</span>
              <input
                v-model="entry.number"
                v-uppercase
                class="mt-1 input-search pl-4"
                placeholder="ALPHANUMERIC"
              />
            </label>
            <label class="col-span-3 block">
              <span class="smallcaps">Expiry</span>
              <input v-model="entry.expiry" type="date" class="mt-1 input-search pl-4" />
            </label>
            <button
              type="button"
              aria-label="Remove identification"
              title="Remove"
              class="col-span-1 self-end justify-self-center w-9 h-9 grid place-items-center
                     rounded-full text-ink-600 hover:bg-maroon-accent/10 hover:text-maroon-accent
                     transition-colors"
              @click="removeIdentification(idx)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="max-w-md">
          <span class="smallcaps">Add identification</span>
          <IdSelector
            :model-value="null"
            placeholder="+ ADD AN ID"
            :hide-ids="alreadyPickedIds"
            class="mt-1"
            @update:model-value="addIdentification"
          />
        </div>
      </section>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1">
          <p v-if="error" class="text-sm text-maroon-accent">{{ error }}</p>
          <p v-if="success" class="text-sm text-green-700">{{ success }}</p>
        </div>
        <button
          type="button"
          class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
          @click="reset"
        >
          Reset
        </button>
        <button
          class="btn-primary"
          :disabled="submitting || duplicates.length > 0"
        >
          {{ submitting ? 'Saving…' : 'Save clearance application' }}
        </button>
      </div>
    </form>

    <DictionaryManager :open="settingsOpen" @close="settingsOpen = false" />

    <!-- Per-row webcam capture modal — opened from the ID photo "Webcam" button -->
    <Teleport to="body">
      <div
        v-if="capturingForIdx !== null"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6"
        @click.self="closeWebcam"
      >
        <div class="card w-full max-w-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <div class="smallcaps">ID Photo</div>
              <h2 class="text-xl font-semibold">
                Capture {{ form.identifications[capturingForIdx]?.name ?? 'ID' }} photo
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
              @click="closeWebcam"
            >
              ×
            </button>
          </div>
          <WebcamCapture v-model="capturingBlob" />
          <p class="text-xs text-ink-600 mt-3">
            Capturing will replace any existing photo for this ID.
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
