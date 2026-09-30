import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const engine = resolve('engine')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@engine': engine } },
    build: {
      rollupOptions: {
        input: resolve('electron/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('electron/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve('.'),
    resolve: {
      alias: { '@engine': engine },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve('index.html'),
      },
    },
  },
})
