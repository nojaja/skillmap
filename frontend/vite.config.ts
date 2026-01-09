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
    const swSource = resolve(__dirname, '../service-worker/public/sw.js')
    const swDest = resolve(__dirname, './public/sw.js')
    try {
      mkdirSync(resolve(__dirname, './public'), { recursive: true })
      copyFileSync(swSource, swDest)
      console.log('✓ Service Worker copied to public/sw.js')
    } catch (error) {
      console.warn('Warning: Could not copy service worker:', error)
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: '/skillmap/',
  plugins: [vue(), copyServiceWorkerPlugin],
})

