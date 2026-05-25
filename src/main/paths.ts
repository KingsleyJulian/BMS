import { app } from 'electron'
import { join } from 'node:path'

/**
 * Centralized filesystem layout. Anything per-installation lives under
 * userData/ so multiple OS users on the same machine each get isolated state.
 */
export const paths = {
  /** PocketBase working directory (database + migrations + hooks live here). */
  pbData: () => join(app.getPath('userData'), 'pb_data'),

  /** Bundled PocketBase binary (extracted from extraResources at install time). */
  pbBinary: () => {
    const isWin = process.platform === 'win32'
    const name = isWin ? 'pocketbase.exe' : 'pocketbase'
    if (app.isPackaged) {
      return join(process.resourcesPath, 'pocketbase', name)
    }
    return join(app.getAppPath(), 'resources', 'pocketbase', name)
  },

  /**
   * Bundled JS migrations. Shipped alongside the binary and passed to PB via
   * --migrationsDir so collections (households, etc.) are created on first
   * launch without us having to drive the admin API.
   */
  pbMigrations: () => {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'pocketbase', 'pb_migrations')
    }
    return join(app.getAppPath(), 'resources', 'pocketbase', 'pb_migrations')
  },

  /** Where we cache the hardware ID and the encrypted license token. */
  licenseStore: () => join(app.getPath('userData'), 'license.json')
}
