import { publicEnv } from '@/env'

/** Absolute URL on this site, for canonical links, sitemaps and structured data. */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString()
}
