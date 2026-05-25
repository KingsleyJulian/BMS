<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useDictionaryStore } from '@/stores/dictionary'
import { CATEGORY_LABELS, type DictionaryCategory } from '@/data/dictionaryCategories'

/**
 * DictionaryModalSelector — modal-based picker that pulls its options from
 * the `dictionaries` collection (filtered by the given category). Same UX
 * shape as IdSelector but with a flat (non-grouped) list since dictionary
 * entries don't carry a group.
 *
 * Selecting an entry emits its string value upward via v-model. Free typing
 * happens elsewhere (the gear-icon Settings modal) — this component only
 * picks from existing entries.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    category: DictionaryCategory
    placeholder?: string
  }>(),
  { placeholder: 'Select…' }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const dict = useDictionaryStore()
const open = ref(false)
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

const items = computed(() => dict.byCategory[props.category] ?? [])

const filtered = computed(() => {
  const q = search.value.trim().toUpperCase()
  if (!q) return items.value
  return items.value.filter((e) => e.value.includes(q))
})

const title = computed(() => CATEGORY_LABELS[props.category] ?? 'Select')

function openModal(): void {
  open.value = true
}

function closeModal(): void {
  open.value = false
  search.value = ''
}

function pick(value: string): void {
  emit('update:modelValue', value)
  closeModal()
}

function clear(e: Event): void {
  e.stopPropagation()
  emit('update:modelValue', '')
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
        {{ props.modelValue || props.placeholder }}
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
              <div class="smallcaps">{{ title }}</div>
              <h2 class="text-xl font-semibold">Select a {{ title.toLowerCase() }}</h2>
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
            placeholder="SEARCH…"
          />

          <div class="overflow-auto flex-1 -mx-2 px-2">
            <div v-if="items.length === 0" class="text-sm text-ink-600 py-12 text-center">
              No entries yet. Open the gear icon → Settings → {{ title }} to add some.
            </div>
            <div v-else-if="filtered.length === 0" class="text-sm text-ink-600 py-8 text-center">
              No matches for "{{ search }}".
            </div>
            <button
              v-for="item in filtered"
              v-else
              :key="item.id"
              type="button"
              class="block w-full text-left px-3 py-2.5 hover:bg-cream-200 rounded text-sm"
              @click="pick(item.value)"
            >
              {{ item.value }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
