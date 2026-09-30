import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@engine': resolve('engine') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
