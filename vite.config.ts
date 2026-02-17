import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { execSync } from "node:child_process";

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/'

const gitSha = execSync("git rev-parse --short HEAD").toString().trim();

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Portable Electronic Health Record',
        short_name: 'PEHR',
        description: 'Offline-first patient tracking for hospital rounds',
        start_url: './',
        display: 'standalone',
        background_color: '#d7c0aeff',
        theme_color: '#e17e65ff',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0-dev"),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
})
