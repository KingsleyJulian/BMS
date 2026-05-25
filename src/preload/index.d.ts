import type { BmsApi } from './index'

declare global {
  interface Window {
    bms: BmsApi
  }
}

export {}
