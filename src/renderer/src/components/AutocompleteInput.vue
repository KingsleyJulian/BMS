<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useDictionaryStore } from '@/stores/dictionary'
import type { DictionaryCategory } from '@/data/dictionaryCategories'

const props = withDefaults(
  defineProps<{
    modelValue: string
    category: DictionaryCategory
    placeholder?: string
    disabled?: boolean
  }>(),
  { placeholder: '', disabled: false }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const dict = useDictionaryStore()

const localValue = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v)
})

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const suggestions = computed(() => {
  const q = props.modelValue.trim().toUpperCase()
  const all = dict.byCategory[props.category] ?? []
  if (!q) return all.slice(0, 8)
  return all.filter((e) => e.value.includes(q) && e.value !== q).slice(0, 8)
})

function pick(value: string): void {
  emit('update:modelValue', value)
  open.value = false
}

function onDocPointer(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

watch(open, (val) => {
  if (val) document.addEventListener('mousedown', onDocPointer)
  else document.removeEventListener('mousedown', onDocPointer)
})

onUnmounted(() => document.removeEventListener('mousedown', onDocPointer))
</script>

<template>
  <div ref="root" class="relative">
    <input
      v-model="localValue"
      v-uppercase
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      class="input-search pl-4 disabled:cursor-not-allowed"
      autocomplete="off"
      @focus="open = true"
      @input="open = true"
    />
    <div
      v-if="open && !props.disabled && suggestions.length > 0"
      class="absolute top-full left-0 right-0 mt-1 card p-1 z-20 max-h-60 overflow-auto shadow-lg"
    >
      <button
        v-for="s in suggestions"
        :key="s.id"
        type="button"
        class="block w-full text-left px-3 py-1.5 hover:bg-cream-200 rounded text-sm"
        @click="pick(s.value)"
      >
        {{ s.value }}
      </button>
    </div>
  </div>
</template>
