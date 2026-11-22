import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Valid placeholder values so importing src/env.ts does not throw in unit tests.
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/medipedia_test',
      DATABASE_URL_UNPOOLED: 'postgres://postgres:postgres@127.0.0.1:5432/medipedia_test',
      PAYLOAD_SECRET: 'test-payload-secret-at-least-32-characters',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    },
  },
})
