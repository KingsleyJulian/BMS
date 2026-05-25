<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useResidentsStore, type HouseholdFlag } from '@/stores/residents'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [] }>()

const residents = useResidentsStore()

const FLAG_OPTIONS: HouseholdFlag[] = ['4PS', 'SENIOR', 'PWD', 'PENDING']

const form = reactive({
  household_id: '',
  head_of_family: '',
  purok: '',
  members: 1,
  flags: [] as HouseholdFlag[],
  contact: ''
})
const submitting = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.household_id = residents.nextHouseholdId()
      form.head_of_family = ''
      form.purok = ''
      form.members = 1
      form.flags = []
      form.contact = ''
      error.value = null
    }
  }
)

function toggleFlag(flag: HouseholdFlag): void {
  const i = form.flags.indexOf(flag)
  if (i === -1) form.flags.push(flag)
  else form.flags.splice(i, 1)
}

async function submit(): Promise<void> {
  if (!form.head_of_family.trim() || !form.household_id.trim()) {
    error.value = 'Household ID and Head of Family are required.'
    return
  }
  submitting.value = true
  error.value = null
  try {
    await residents.create({ ...form, head_of_family: form.head_of_family.trim() })
    emit('created')
    emit('close')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6"
      @click.self="emit('close')"
    >
      <div class="card w-full max-w-xl p-8">
        <div class="flex items-start justify-between mb-6">
          <div>
            <div class="smallcaps text-[10px]">Residents & Puroks</div>
            <h2 class="text-2xl text-ink-900">Register household</h2>
          </div>
          <button
            class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
            @click="emit('close')"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="grid grid-cols-2 gap-4">
            <label class="block">
              <span class="smallcaps text-[10px]">Household ID</span>
              <input
                v-model="form.household_id"
                v-uppercase
                class="mt-1 input-search pl-4"
                placeholder="SI-0012"
              />
            </label>
            <label class="block">
              <span class="smallcaps text-[10px]">Members</span>
              <input
                v-model.number="form.members"
                type="number"
                min="1"
                class="mt-1 input-search pl-4"
              />
            </label>
          </div>

          <label class="block">
            <span class="smallcaps text-[10px]">Head of Family</span>
            <input
              v-model="form.head_of_family"
              v-uppercase
              class="mt-1 input-search pl-4"
              placeholder="JUAN DELA CRUZ"
            />
          </label>

          <div class="grid grid-cols-2 gap-4">
            <label class="block">
              <span class="smallcaps text-[10px]">Purok</span>
              <input
                v-model="form.purok"
                v-uppercase
                class="mt-1 input-search pl-4"
                placeholder="LIBUTAD"
              />
            </label>
            <label class="block">
              <span class="smallcaps text-[10px]">Contact</span>
              <input
                v-model="form.contact"
                v-uppercase
                class="mt-1 input-search pl-4"
                placeholder="0917-555-0000"
              />
            </label>
          </div>

          <div>
            <span class="smallcaps text-[10px]">Flags</span>
            <div class="mt-2 flex gap-2 flex-wrap">
              <button
                v-for="flag in FLAG_OPTIONS"
                :key="flag"
                type="button"
                :class="[
                  'pill cursor-pointer transition-colors',
                  form.flags.includes(flag)
                    ? 'pill-pwd ring-2 ring-maroon-accent/40'
                    : 'pill-senior opacity-60 hover:opacity-100'
                ]"
                @click="toggleFlag(flag)"
              >
                {{ flag }}
              </button>
            </div>
          </div>

          <div v-if="error" class="text-sm text-maroon-accent">{{ error }}</div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button class="btn-primary" :disabled="submitting">
              {{ submitting ? 'Saving…' : 'Save household' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
