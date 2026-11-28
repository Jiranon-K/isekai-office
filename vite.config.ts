import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./web/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url))
    }
  },
  server: {
    port: 4300,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.SERVER_PORT ?? 4302}` }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'room', tags: ['$initial'] }] } } }
  }
})
