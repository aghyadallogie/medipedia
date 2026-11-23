import type { MetadataRoute } from 'next'

import type { SitemapEntries } from '@/server/public-queries'
import { absoluteUrl } from '@/server/site'

const STATIC_PATHS = ['/', '/lectures', '/papers', '/videos', '/flashcards', '/domains'] as const

/** Every public URL: the index pages plus one entry per published document. */
export function buildSitemap(entries: SitemapEntries, now: Date): MetadataRoute.Sitemap {
  const documents = (base: string, items: SitemapEntries[keyof SitemapEntries]) =>
    items.map(({ slug, updatedAt }) => ({
      url: absoluteUrl(`${base}/${encodeURIComponent(slug)}`),
      lastModified: new Date(updatedAt),
    }))

  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path), lastModified: now })),
    ...documents('/domains', entries.domains),
    ...documents('/lectures', entries.lectures),
    ...documents('/papers', entries.papers),
    ...documents('/videos', entries.videos),
    ...documents('/flashcards', entries.flashcardTopics),
  ]
}
