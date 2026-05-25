import { contextBridge, ipcRenderer } from 'electron'

const api = {
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    activate: (code: string, deviceLabel?: string) =>
      ipcRenderer.invoke('license:activate', code, deviceLabel),
    checkIn: () => ipcRenderer.invoke('license:checkIn'),
    reset: () => ipcRenderer.invoke('license:reset')
  },
  system: {
    hardwareId: () => ipcRenderer.invoke('system:hardwareId'),
    pocketbaseUrl: () => ipcRenderer.invoke('system:pocketbaseUrl')
  }
}

contextBridge.exposeInMainWorld('bms', api)

export type BmsApi = typeof api
