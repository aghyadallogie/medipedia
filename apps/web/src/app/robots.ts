import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/server/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The admin panel and both APIs are for applications, not search results.
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
