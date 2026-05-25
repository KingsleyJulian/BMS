<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

/**
 * FilterDropdown — popover-style picker fed by a runtime list of strings
 * (distinct values discovered across the dataset). Search input narrows
 * the popup options on the fly, but selection itself sets the bound value.
 *
 * Differs from AutocompleteInput: this is *closed* (free typing isn't
 * persisted) and the source list is provided as a prop, not from the
 * dictionary store. Used for data-driven filters where only existing
 * values should be selectable.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    options: string[]
    placeholder?: string
  }>(),
  { placeholder: 'Any' }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const search = ref('')
const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toUpperCase()
  if (!q) return props.options
  return props.options.filter((o) => o.toUpperCase().includes(q))
})

function toggle(): void {
  open.value = !open.value
}
function close(): void {
  open.value = false
  search.value = ''
}
function pick(v: string): void {
  emit('update:modelValue', v)
  close()
}
function clear(e: Event): void {
  e.stopPropagation()
  emit('update:modelValue', '')
}

function onDocPointer(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) close()
}

watch(open, async (val) => {
  if (val) {
    document.addEventListener('mousedown', onDocPointer)
    await nextTick()
    searchInput.value?.focus()
  } else {
    document.removeEventListener('mousedown', onDocPointer)
  }
})

onUnmounted(() => document.removeEventListener('mousedown', onDocPointer))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="input-search pl-4 pr-10 text-left flex items-center justify-between w-full"
      @click="toggle"
    >
      <span :class="props.modelValue ? '' : 'text-ink-600'" class="truncate">
        {{ props.modelValue || props.placeholder }}
      </span>
      <span class="flex items-center gap-2 shrink-0 ml-2">
        <span
          v-if="props.modelValue"
          class="text-ink-600 hover:text-maroon-accent cursor-pointer"
          role="button"
          aria-label="Clear filter"
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

    <div
      v-if="open"
      class="absolute top-full left-0 right-0 mt-1 card p-1 z-30 max-h-72 overflow-auto shadow-lg"
    >
      <input
        ref="searchInput"
        v-model="search"
        v-uppercase
        class="input-search pl-4 mb-1 sticky top-0"
        placeholder="SEARCH…"
      />
      <div v-if="props.options.length === 0" class="text-xs text-ink-600 px-3 py-3 text-center">
        No data yet for this field.
      </div>
      <div v-else-if="filtered.length === 0" class="text-xs text-ink-600 px-3 py-3 text-center">
        No matches for "{{ search }}".
      </div>
      <button
        v-for="opt in filtered"
        v-else
        :key="opt"
        type="button"
        class="block w-full text-left px-3 py-1.5 hover:bg-cream-200 rounded text-sm uppercase"
        @click="pick(opt)"
      >
        {{ opt }}
      </button>
    </div>
  </div>
</template>
