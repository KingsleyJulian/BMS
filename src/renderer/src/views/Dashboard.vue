<script setup lang="ts">
const stats = [
  { label: 'Households', value: '1,247' },
  { label: 'Active Cases', value: '18' },
  { label: 'Clearances (Mo)', value: '92' },
  { label: 'Senior Citizens', value: '186' }
]
</script>

<template>
  <div class="grid grid-cols-4 gap-5">
    <div v-for="s in stats" :key="s.label" class="card p-6">
      <div class="smallcaps text-[10px] mb-2">{{ s.label }}</div>
      <div class="text-3xl text-ink-900">{{ s.value }}</div>
    </div>
  </div>
</template>
