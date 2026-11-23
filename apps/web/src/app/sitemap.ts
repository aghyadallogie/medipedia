import type { MetadataRoute } from 'next'

import { buildSitemap } from '@/lib/sitemap'
import { getSitemapEntries } from '@/server/public-queries'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(await getSitemapEntries(), new Date())
}
