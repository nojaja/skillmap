import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// Copy service worker from service-worker/public to frontend/public
const copyServiceWorkerPlugin: Plugin = {
  name: 'copy-service-worker',
  apply: 'build',
  enforce: 'post',
  writeBundle() {
    const swSource = resolve(__dirname, '../dist/service-worker/sw.js')
    const swDest = resolve(__dirname, '../dist/frontend/sw.js')
    try {
      mkdirSync(resolve(__dirname, '../dist/frontend'), { recursive: true })
      copyFileSync(swSource, swDest)
      console.log('✓ Service Worker copied to dist/frontend/sw.js')
    } catch (error) {
      console.warn('Warning: Could not copy service worker:', error)
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: '/skillmap/',
  plugins: [vue(), copyServiceWorkerPlugin],
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
})

