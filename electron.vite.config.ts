import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  // Make .env values visible inside the Electron main + preload bundles.
  // Without this, `process.env.VITE_*` is undefined at runtime in main —
  // Vite normally only inlines env into the renderer.
  const env = loadEnv(mode, process.cwd(), '')
  const inlineEnv: Record<string, string> = {}
  for (const key of [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'LICENSE_ENCRYPTION_SECRET',
    'POCKETBASE_ADMIN_EMAIL',
    'POCKETBASE_ADMIN_PASSWORD'
  ]) {
    inlineEnv[`process.env.${key}`] = JSON.stringify(env[key] ?? '')
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: inlineEnv,
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/main/index.ts') }
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      define: inlineEnv,
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/preload/index.ts') }
        }
      }
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src/renderer/src')
        }
      },
      plugins: [vue()],
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/renderer/index.html') }
        }
      }
    }
  }
})
