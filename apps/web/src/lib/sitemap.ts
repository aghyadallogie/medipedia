import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/server/site'

/**
 * The URLs a search engine can read. Everything else on the site is for signed-in learners and
 * redirects to the sign-in page (AGENTS.md §15, "Members only"), so it would only mislead a
 * crawler. Add a page here when it becomes public (see `PUBLIC_PAGES` in `proxy.ts`).
 */
const PUBLIC_PATHS = ['/', '/terms', '/privacy'] as const

export function buildSitemap(now: Date): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: absoluteUrl(path), lastModified: now }))
}
