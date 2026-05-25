<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { VALID_ID_GROUPS, type ValidId } from '@/data/validIds'

const props = withDefaults(
  defineProps<{
    modelValue: ValidId | null
    placeholder?: string
    /** Hide IDs whose `id` is in this array (e.g. ones already added). */
    hideIds?: string[]
  }>(),
  { placeholder: 'Select valid ID', hideIds: () => [] }
)
const emit = defineEmits<{ 'update:modelValue': [ValidId | null] }>()

const open = ref(false)
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const hidden = new Set(props.hideIds)
  return VALID_ID_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !hidden.has(item.id) && (!q || item.name.toLowerCase().includes(q))
    )
  })).filter((group) => group.items.length > 0)
})

function openModal(): void {
  open.value = true
}

function closeModal(): void {
  open.value = false
  search.value = ''
}

function pick(item: { id: string; name: string; description?: string }, group: string): void {
  emit('update:modelValue', { ...item, group })
  closeModal()
}

function clear(e: Event): void {
  e.stopPropagation()
  emit('update:modelValue', null)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) closeModal()
}

watch(open, async (val) => {
  if (val) {
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    searchInput.value?.focus()
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div>
    <button
      type="button"
      class="input-search pl-4 pr-10 text-left flex items-center justify-between w-full"
      @click="openModal"
    >
      <span :class="props.modelValue ? '' : 'text-ink-600'" class="truncate">
        {{ props.modelValue?.name ?? props.placeholder }}
      </span>
      <span class="flex items-center gap-2 shrink-0 ml-2">
        <span
          v-if="props.modelValue"
          class="text-ink-600 hover:text-maroon-accent cursor-pointer"
          role="button"
          aria-label="Clear selection"
          @click="clear"
          >×</span
        >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 text-ink-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-6"
        @click.self="closeModal"
      >
        <div class="card w-full max-w-2xl max-h-[80vh] flex flex-col p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <div class="smallcaps">Identification</div>
              <h2 class="text-xl font-semibold">Select a valid ID</h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="text-ink-600 hover:text-ink-900 text-2xl leading-none"
              @click="closeModal"
            >
              ×
            </button>
          </div>

          <input
            ref="searchInput"
            v-model="search"
            v-uppercase
            class="input-search pl-4 mb-4 shrink-0"
            placeholder="SEARCH ID..."
          />

          <div class="overflow-auto flex-1 -mx-2 px-2">
            <div v-if="filtered.length === 0" class="text-sm text-ink-600 py-8 text-center">
              No matching IDs
            </div>
            <div v-for="group in filtered" :key="group.group" class="mb-4 last:mb-0">
              <div
                class="smallcaps px-2 py-1.5 sticky top-0 bg-cream-50 z-10 border-b border-cream-300/60"
              >
                {{ group.group }}
              </div>
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                class="block w-full text-left px-3 py-2.5 hover:bg-cream-200 rounded text-sm"
                @click="pick(item, group.group)"
              >
                <div class="font-medium">{{ item.name }}</div>
                <div v-if="item.description" class="text-xs text-ink-600 mt-0.5">
                  {{ item.description }}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
