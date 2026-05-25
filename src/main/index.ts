import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import { startPocketBase, stopPocketBase, pocketbaseUrl } from './pocketbase'
import { evaluateLicense, clearLicense } from './license'
import { activateLicense, checkIn } from './supabase'
import { startSyncListener } from './sync'
import { getHardwareId } from './hardware'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#faf3e7',
    autoHideMenuBar: true,
    webPreferences: {
      // electron-vite emits the preload as .mjs (ESM) under "type": "module".
      // Loading it requires sandbox:false, which we already set below.
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('license:status', () => evaluateLicense())
  ipcMain.handle('license:activate', (_e, code: string, deviceLabel?: string) =>
    activateLicense(code, deviceLabel)
  )
  ipcMain.handle('license:checkIn', () => checkIn())
  ipcMain.handle('license:reset', () => {
    clearLicense()
    return evaluateLicense()
  })
  ipcMain.handle('system:hardwareId', () => getHardwareId())
  ipcMain.handle('system:pocketbaseUrl', () => pocketbaseUrl)
}

app.whenReady().then(async () => {
  // Auto-approve camera/microphone access for the renderer — used by the
  // WebcamCapture component for the clearance profile photo. We're a
  // single-window local app, so no per-origin gating is needed.
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === 'media') return callback(true)
      callback(false)
    }
  )

  registerIpc()
  await startPocketBase()
  startSyncListener()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  stopPocketBase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopPocketBase())
