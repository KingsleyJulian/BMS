import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type LicenseStatus =
  | { state: 'unactivated' }
  | {
      state: 'active'
      expiresAt: string
      lastCheckInAt: string
      daysSinceCheckIn: number
      licenseId: string
      activationCode: string
      customerName: string | null
      deviceLabel: string | null
    }
  | { state: 'expired'; expiresAt: string }
  | { state: 'tampered'; reason: string }
  | { state: 'wrong-machine' }
  | { state: 'check-in-required'; daysSinceCheckIn: number }

export const useLicenseStore = defineStore('license', () => {
  const status = ref<LicenseStatus | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      status.value = (await window.bms.license.status()) as LicenseStatus
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function activate(
    code: string,
    deviceLabel?: string
  ): Promise<{ ok: boolean; reason?: string }> {
    const res = (await window.bms.license.activate(code, deviceLabel)) as
      | { ok: true; expiresAt: string; licenseId: string; customerName: string | null }
      | { ok: false; reason: string }
    if (res.ok) await refresh()
    return res
  }

  async function checkIn(): Promise<void> {
    await window.bms.license.checkIn()
    await refresh()
  }

  const needsActivation = computed(
    () => status.value?.state === 'unactivated' || status.value?.state === 'wrong-machine'
  )
  const isLocked = computed(() => {
    const s = status.value?.state
    return s === 'expired' || s === 'tampered' || s === 'check-in-required'
  })
  const isActive = computed(() => status.value?.state === 'active')

  /** Building tenant identity, surfaced once the license is active. */
  const building = computed(() => {
    if (status.value?.state !== 'active') return null
    return {
      licenseId: status.value.licenseId,
      activationCode: status.value.activationCode,
      customerName: status.value.customerName,
      deviceLabel: status.value.deviceLabel
    }
  })

  return {
    status,
    loading,
    error,
    refresh,
    activate,
    checkIn,
    needsActivation,
    isLocked,
    isActive,
    building
  }
})
