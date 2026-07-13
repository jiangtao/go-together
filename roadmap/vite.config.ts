import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { strictPublicFilesPlugin } from './scripts/lib/strict-public-files'

const publicDirectory = path.resolve(__dirname, './.generated/public')

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  publicDir: publicDirectory,
  plugins: [strictPublicFilesPlugin(publicDirectory), react(), tailwindcss()],
  build: {
    manifest: 'vite-manifest.json',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
