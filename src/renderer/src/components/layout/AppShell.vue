<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
</script>

<template>
  <div class="h-full flex bg-cream-100 print:block print:bg-white">
    <AppSidebar class="print:hidden" />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader class="print:hidden" />
      <main class="flex-1 overflow-auto px-10 py-8 print:overflow-visible print:p-0">
        <RouterView />
      </main>
    </div>
  </div>
</template>
