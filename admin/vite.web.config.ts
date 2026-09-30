import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: '.',
  publicDir: 'templates',
  plugins: [react()],
  resolve: {
    alias: { '@engine': resolve('engine') },
  },
  server: { port: 5174, strictPort: true },
})
