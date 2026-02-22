import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from "node:child_process";

const base = './'

const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
  version?: string
}
const appVersion = packageJson.version ?? '0.0.0'

const gitSha = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['puhrr-logo.svg'],
      // Source of truth for PWA metadata. Keep `public/manifest.json` mirrored.
      manifest: {
        name: 'PUHRR - Portable Electronic Health Record',
        short_name: 'PUHRR',
        description: 'Offline-first patient tracking for hospital rounds',
        start_url: './',
        display: 'standalone',
        background_color: '#FDF6F0',
        theme_color: '#E2614A',
        icons: [
          {
            src: 'puhrr-logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
})
