import { serializeJsonLd } from '@/lib/seo'

/** Structured data for search engines. `serializeJsonLd` escapes `<`, so it cannot break out. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
