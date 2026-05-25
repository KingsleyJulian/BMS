<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { useBarangayStore } from '@/stores/barangay'
import { monthsToPhrase } from '@/composables/residencyToWords'
import { getPb } from '@/services/pocketbase'

interface ClearanceApplication {
  id: string
  collectionId: string
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string
  civil_status: string
  house_no: string
  block: string
  street: string
  address_barangay: string
  city: string
  zip_code: string
  contact_number: string
  months_of_residency: number
  purpose_of_clearance: string
  profile_photo?: string
  created: string
}

const route = useRoute()
const router = useRouter()
const barangay = useBarangayStore()

const application = ref<ClearanceApplication | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const qrDataUrl = ref<string | null>(null)
let pbBaseUrl = ''

onMounted(async () => {
  const id = route.params.id as string
  if (!id) {
    error.value = 'Missing application id.'
    loading.value = false
    return
  }
  try {
    const pb = await getPb()
    pbBaseUrl = pb.baseUrl
    application.value = await pb
      .collection('clearance_applications')
      .getOne<ClearanceApplication>(id)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

const fullName = computed(() => {
  const a = application.value
  if (!a) return ''
  return [a.first_name, a.middle_name, a.last_name, a.suffix]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
})

const fullAddress = computed(() => {
  const a = application.value
  if (!a) return ''
  const houseBlock = [a.house_no, a.block].filter(Boolean).join(' Blk. ')
  return [houseBlock, a.street].filter(Boolean).join(', ')
})

const residencyPhrase = computed(() => {
  const months = application.value?.months_of_residency
  if (!months) return ''
  return monthsToPhrase(months)
})

const issueDate = computed(() => {
  const d = application.value?.created ? new Date(application.value.created) : new Date()
  return {
    dayOrdinal: ordinal(d.getDate()),
    month: d.toLocaleString('en-US', { month: 'long' }),
    year: d.getFullYear()
  }
})

const profilePhotoUrl = computed(() => {
  const a = application.value
  if (!a?.profile_photo) return null
  return `${pbBaseUrl}/api/files/${a.collectionId}/${a.id}/${a.profile_photo}?thumb=300x300`
})

const signatureUrl = computed(() => {
  const info = barangay.info
  if (!info?.signature || !info?.id) return null
  return `${pbBaseUrl}/api/files/barangay_info/${info.id}/${info.signature}`
})

const leftLogoUrl = computed(() => {
  const info = barangay.info
  if (!info?.left_logo || !info?.id) return null
  return `${pbBaseUrl}/api/files/barangay_info/${info.id}/${info.left_logo}`
})

const rightLogoUrl = computed(() => {
  const info = barangay.info
  if (!info?.right_logo || !info?.id) return null
  return `${pbBaseUrl}/api/files/barangay_info/${info.id}/${info.right_logo}`
})

/**
 * Parse the letterhead textarea into structured blocks. A "section" is a
 * group of non-empty lines separated by at least one blank line; the first
 * line of each section is rendered as a blue title, the rest as plain
 * names/values stacked below.
 */
const sidebarBlocks = computed(() => {
  const text = barangay.info?.letterhead_sidebar ?? ''
  if (!text.trim()) return []
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length === 0) return null
      return { title: lines[0], lines: lines.slice(1) }
    })
    .filter((b): b is { title: string; lines: string[] } => b !== null)
})

watch(
  application,
  async (a) => {
    if (!a) {
      qrDataUrl.value = null
      return
    }
    const payload = JSON.stringify({
      id: a.id,
      name: [a.first_name, a.middle_name, a.last_name, a.suffix].filter(Boolean).join(' '),
      issued: a.created
    })
    try {
      qrDataUrl.value = await QRCode.toDataURL(payload, {
        margin: 0,
        width: 256,
        errorCorrectionLevel: 'M'
      })
    } catch {
      qrDataUrl.value = null
    }
  },
  { immediate: true }
)

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

function printDoc(): void {
  window.print()
}

function back(): void {
  void router.push('/citizens')
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
        ← Back to Citizens
      </button>
      <button class="btn-primary" :disabled="!application" @click="printDoc">
        Print / Save as PDF
      </button>
    </div>

    <div v-if="loading" class="card p-12 text-center text-ink-600 print:hidden">Loading…</div>
    <div v-else-if="error" class="card p-12 text-center text-maroon-accent print:hidden">
      {{ error }}
    </div>

    <!-- Certificate sheet -->
    <article
      v-if="application"
      class="certificate-sheet bg-white shadow mx-auto p-12 text-ink-900 flex flex-col relative"
      style="width: 8.5in; min-height: 11in"
    >
      <!-- Header (full width) — logos either side, monogram fallback -->
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

      <!-- Title row: spans the full width above the letterhead + body. Photo
           sits in its own slot on the right; an empty mirror slot on the
           left keeps the title optically centered on the page. -->
      <div class="flex items-center gap-4 mt-8 mb-8">
        <div class="w-24 shrink-0" aria-hidden="true"></div>
        <div class="flex-1 text-center">
          <h2 class="text-2xl font-bold tracking-wide">BARANGAY CERTIFICATION</h2>
        </div>
        <div class="w-24 shrink-0">
          <template v-if="profilePhotoUrl">
            <img
              :src="profilePhotoUrl"
              class="w-24 h-24 object-cover border border-ink-700 ml-auto"
              alt="Applicant photo"
            />
          </template>
        </div>
      </div>

      <!-- Two-column body: optional left sidebar + main content. flex-1 so
           the divider stretches all the way to the bottom of the sheet. -->
      <div :class="sidebarBlocks.length ? 'flex gap-8 flex-1' : 'flex-1'">
        <!-- Left letterhead panel -->
        <aside
          v-if="sidebarBlocks.length"
          class="w-48 shrink-0 text-[10pt] leading-snug pr-4"
          style="border-right: 1px solid #cbd5e1"
        >
          <div v-for="(block, bIdx) in sidebarBlocks" :key="bIdx" class="mb-4 last:mb-0">
            <h3 class="font-bold text-center" style="color: #1d4ed8">{{ block.title }}</h3>
            <p v-for="(line, lIdx) in block.lines" :key="lIdx" class="text-center">
              {{ line }}
            </p>
          </div>
        </aside>

        <!-- Main content -->
        <main class="flex-1 min-w-0">
          <!-- Body @ 11pt -->
          <section
            class="space-y-4 leading-relaxed text-justify"
            style="font-size: 11pt"
          >
            <p>To Whom It May Concern,</p>

            <p class="indent-8">
              This is to certify that <strong>{{ fullName }}</strong>, a resident of
              <strong>{{ fullAddress }}</strong>, Barangay
              <strong>{{ application.address_barangay || barangay.info.name }}</strong
              >, {{ application.city }}<span v-if="residencyPhrase">,
              has been residing in this barangay for
              <strong>{{ residencyPhrase }}</strong></span>.
            </p>

            <p class="indent-8">
              This certification is being issued upon the request of the above-named
              individual for <strong>{{ application.purpose_of_clearance }}</strong>.
            </p>

            <p class="indent-8">
              Done this <strong>{{ issueDate.dayOrdinal }}</strong> day of
              <strong>{{ issueDate.month }}, {{ issueDate.year }}</strong> at this Office,
              Barangay {{ barangay.info.name
              }}<span v-if="barangay.addressLine">, {{ barangay.addressLine }}</span>,
              Philippines.
            </p>

            <p class="indent-8 italic">
              This certification is valid only for one (1) year from the issuance.
            </p>
          </section>

          <!-- Signature block -->
          <section class="mt-16 text-right" style="font-size: 11pt">
            <div class="inline-block text-center">
              <img
                v-if="signatureUrl"
                :src="signatureUrl"
                class="h-16 mx-auto mb-1 object-contain"
                alt="Signature"
              />
              <div v-else class="h-16 mb-1" aria-hidden="true" />
              <p class="font-bold uppercase border-t-2 border-ink-900 pt-1 px-4">
                {{ barangay.info.punong_barangay_name || 'Punong Barangay' }}
              </p>
              <p class="text-sm">Punong Barangay</p>
            </div>
          </section>
        </main>
      </div>

      <img
        v-if="qrDataUrl"
        :src="qrDataUrl"
        class="absolute bottom-8 right-8 w-16 h-16 object-contain"
        alt="Verification QR code"
      />
    </article>
  </div>
</template>

<style scoped>
@media print {
  @page {
    size: 8.5in 11in;
    margin: 0;
  }
  .certificate-sheet {
    box-shadow: none !important;
    margin: 0 !important;
    width: 8.5in !important;
    /* Use a hair under 11in to avoid sub-pixel rounding spilling to page 2. */
    height: 10.99in !important;
    min-height: 0 !important;
    max-height: 10.99in !important;
    overflow: hidden !important;
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
    break-after: avoid !important;
    break-inside: avoid !important;
  }
}
</style>
