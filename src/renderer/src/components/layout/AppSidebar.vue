<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useBarangayStore } from '@/stores/barangay'

const barangay = useBarangayStore()

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/barangay-clearance', label: 'Barangay Clearance', icon: 'users' },
  { to: '/citizens', label: 'Citizens', icon: 'users' },
  { to: '/blotter', label: 'Blotter & Mediation', icon: 'shield' },
  { to: '/clearances', label: 'Clearances', icon: 'doc' },
  { to: '/health', label: 'Health & Social', icon: 'heart' },
  { to: '/disaster', label: 'Disaster Watch', icon: 'cloud' },
  { to: '/sessions', label: 'Session Minutes', icon: 'book' },
  { to: '/budget', label: 'Budget & SK', icon: 'wallet' },
  { to: '/settings', label: 'Settings', icon: 'cog' }
]
</script>

<template>
  <aside class="w-64 bg-maroon-900 text-cream-100 flex flex-col shrink-0">
    <!-- Brand (sourced from PocketBase barangay_info) -->
    <div class="px-6 pt-7 pb-5 border-b border-maroon-700/40">
      <div class="flex items-center gap-3">
        <div
          class="w-12 h-12 rounded-full bg-gold-500 text-maroon-900 flex items-center
                 justify-center font-semibold text-lg shadow-inner"
        >
          {{ barangay.info.monogram }}
        </div>
        <div>
          <div class="text-xl font-semibold leading-tight">
            {{ barangay.hasInfo ? barangay.info.name : barangay.displayLabel }}
          </div>
          <div
            v-if="barangay.hasInfo && barangay.addressLine"
            class="smallcaps text-[10px] text-cream-300/80"
          >
            {{ barangay.addressLine }}
          </div>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-link">
        <span class="w-5 h-5 inline-flex items-center justify-center">
          <component :is="`icon-${item.icon}`" />
          <!-- inline minimalist icons rendered below -->
          <svg
            v-if="item.icon === 'home'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 12l9-9 9 9M5 10v10h14V10"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'users'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19a4 4 0 10-8 0M9 11a3 3 0 100-6 3 3 0 000 6zM18 11a3 3 0 100-6 3 3 0 000 6zM21 19a4 4 0 00-3-3.87"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'shield'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3l8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7l8-4z"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'doc'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14 3H6v18h12V7l-4-4zM14 3v4h4M8 13h8M8 17h6"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'heart'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 8.25c0-2.485-2.014-4.5-4.5-4.5-1.79 0-3.34 1.05-4.07 2.572-.73-1.522-2.28-2.572-4.07-2.572A4.5 4.5 0 003 8.25c0 6.75 9 11.25 9 11.25s9-4.5 9-11.25z"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'cloud'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 15a4 4 0 014-4 6 6 0 0111-2 4 4 0 010 8H7a4 4 0 01-4-4z"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'book'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4V4zM4 4v12"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'wallet'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 7h15a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V7zM3 7l3-3h12M16 13h2"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'cog'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.3 3.6a2 2 0 013.4 0l.4.7a2 2 0 002 .9l.8-.1a2 2 0 012.1 2.1l-.1.8a2 2 0 00.9 2l.7.4a2 2 0 010 3.4l-.7.4a2 2 0 00-.9 2l.1.8a2 2 0 01-2.1 2.1l-.8-.1a2 2 0 00-2 .9l-.4.7a2 2 0 01-3.4 0l-.4-.7a2 2 0 00-2-.9l-.8.1a2 2 0 01-2.1-2.1l.1-.8a2 2 0 00-.9-2l-.7-.4a2 2 0 010-3.4l.7-.4a2 2 0 00.9-2l-.1-.8a2 2 0 012.1-2.1l.8.1a2 2 0 002-.9l.4-.7zM12 15a3 3 0 100-6 3 3 0 000 6z"
            />
          </svg>
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="px-6 py-4 border-t border-maroon-700/40 text-[10px] text-cream-300/60">
      <div v-if="barangay.info.established" class="smallcaps">
        {{ barangay.info.established }}
      </div>
      <div class="mt-1 font-sans tracking-wide">BMS v0.1 · Pilot</div>
    </div>
  </aside>
</template>
