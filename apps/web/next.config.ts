import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

// Validate environment variables when the app boots or builds (AGENTS.md §11).
import './src/env'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(dirname, '../..')

const nextConfig: NextConfig = {
  transpilePackages: ['@medipedia/shared', '@medipedia/api-client'],
  images: {
    // Local-disk media in development. In production, Vercel Blob URLs are absolute.
    localPatterns: [{ pathname: '/api/cms/media/file/**' }],
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
