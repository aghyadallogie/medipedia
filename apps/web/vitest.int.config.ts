import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** Minimal .env reader (KEY=value lines). Real environment variables, as set in CI, win. */
function readDotEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const values: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match?.[1] === undefined || match[2] === undefined) continue
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}

const fromProcess = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
)

/**
 * Integration tests: they run against a real Postgres (DATABASE_URL), but each run creates a
 * throwaway schema and drops it afterwards, so existing tables are never touched.
 *
 *   pnpm test:int
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    env: { ...readDotEnv(path.resolve(dirname, '.env')), ...fromProcess },
    testTimeout: 60_000,
    hookTimeout: 180_000,
    // One schema per file and a shared database: keep files sequential and predictable.
    fileParallelism: false,
  },
})
