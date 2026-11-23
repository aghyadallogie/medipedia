/** Metadata and structured data (JSON-LD) builders. Pure apart from reading the site URL. */
import type { Lecture, Paper, Video } from '@medipedia/shared'
import type { Metadata } from 'next'

import { absoluteUrl } from '@/server/site'

export const SITE_NAME = 'Medipedia'
export const SITE_DESCRIPTION =
  'Lectures, flashcards, practice questions, landmark papers and vetted videos for medical learners.'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
}

/** Rich text HTML -> plain text, for meta descriptions and structured data. */
export function plainText(html: string, maxLength = 300): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`
}

type PageMeta = {
  title: string
  description?: string | null
  /** Site-relative path, e.g. `/lectures/acs`. Used for the canonical URL. */
  path: string
  image?: string | null
  type?: 'website' | 'article' | 'video.other'
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
}: PageMeta): Metadata {
  const canonical = absoluteUrl(path)
  const desc = description?.trim() || SITE_DESCRIPTION
  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      siteName: SITE_NAME,
      type,
      ...(image
        ? { images: [{ url: image.startsWith('http') ? image : absoluteUrl(image) }] }
        : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description: desc },
  }
}

// ---------- JSON-LD ----------

type JsonLd = Record<string, unknown>

/** Script-safe: `<` is escaped so a value can never close the surrounding <script> tag. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
  }
}

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function lectureJsonLd(lecture: Lecture): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: lecture.title,
    description: lecture.summary ?? plainText(lecture.body.html),
    url: absoluteUrl(`/lectures/${lecture.slug}`),
    datePublished: lecture.publishedAt ?? lecture.updatedAt,
    dateModified: lecture.lastReviewedAt ?? lecture.updatedAt,
    ...(lecture.coverImage ? { image: absoluteUrl(lecture.coverImage.url) } : {}),
    about: lecture.domains.map((domain) => domain.name),
    publisher: { '@type': 'Organization', name: SITE_NAME },
    isAccessibleForFree: lecture.accessTier === 'free',
  }
}

export function paperJsonLd(paper: Paper): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: paper.title,
    name: paper.title,
    description: plainText(paper.sparkNotes.html) || plainText(paper.abstract.html),
    url: absoluteUrl(`/papers/${paper.slug}`),
    author: paper.authors.map((name) => ({ '@type': 'Person', name })),
    ...(paper.journal ? { isPartOf: { '@type': 'Periodical', name: paper.journal } } : {}),
    ...(paper.year ? { datePublished: String(paper.year) } : {}),
    ...(paper.doi ? { sameAs: `https://doi.org/${paper.doi}` } : {}),
    ...(paper.domain ? { about: paper.domain.name } : {}),
  }
}

export function videoJsonLd(video: Video): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: plainText(video.description.html) || video.title,
    embedUrl: video.embedUrl,
    uploadDate: video.reviewedAt ?? video.updatedAt,
    ...(video.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl } : {}),
    ...(video.durationSeconds ? { duration: `PT${Math.round(video.durationSeconds)}S` } : {}),
  }
}
