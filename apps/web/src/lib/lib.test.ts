import type { Lecture, Paper, Video } from '@medipedia/shared'
import { describe, expect, it } from 'vitest'

import type { SitemapEntries } from '@/server/public-queries'

import { formatAuthors, formatDate, formatDuration } from './format'
import {
  breadcrumbJsonLd,
  lectureJsonLd,
  pageMetadata,
  paperJsonLd,
  plainText,
  serializeJsonLd,
  videoJsonLd,
  websiteJsonLd,
} from './seo'
import { buildSitemap } from './sitemap'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NOW = '2026-11-22T12:00:00.000Z'
const domain = { id: id(1), name: 'Cardiology', slug: 'cardiology' }
const empty = { html: '' }

describe('formatting', () => {
  it('formats dates in UTC so server and browser agree', () => {
    expect(formatDate('2026-11-22T23:59:59.000Z')).toBe('Nov 22, 2026')
    expect(formatDate('2026-11-23T00:00:00.000Z')).toBe('Nov 23, 2026')
    expect(formatDate('not a date')).toBe('')
  })

  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [125, '2:05'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [-4, '0:00'],
    [59.6, '1:00'],
  ])('formats %s seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it('shortens long author lists', () => {
    expect(formatAuthors(['A', 'B'])).toBe('A, B')
    expect(formatAuthors(['A', 'B', 'C'])).toBe('A, B, C')
    expect(formatAuthors(['A', 'B', 'C', 'D'])).toBe('A, B, C et al.')
    expect(formatAuthors(['A', 'B', 'C'], 2)).toBe('A, B et al.')
  })
})

describe('plainText', () => {
  it('strips tags, decodes entities and collapses whitespace', () => {
    expect(plainText('<p>Fish &amp; chips</p>\n<p>  are <strong>good</strong> </p>')).toBe(
      'Fish & chips are good',
    )
  })

  it('drops script and style content entirely', () => {
    expect(plainText('<p>Hi</p><script>alert(1)</script><style>p{}</style>')).toBe('Hi')
  })

  it('truncates with an ellipsis', () => {
    const text = plainText(`<p>${'word '.repeat(100)}</p>`, 50)
    expect(text.length).toBeLessThanOrEqual(50)
    expect(text.endsWith('…')).toBe(true)
  })
})

describe('serializeJsonLd', () => {
  it('escapes < so a value can never close the script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})

describe('pageMetadata', () => {
  it('sets canonical, Open Graph and Twitter fields from the site URL', () => {
    const meta = pageMetadata({
      title: 'Lecture',
      description: 'About it',
      path: '/lectures/a',
      image: '/cover.png',
      type: 'article',
    })
    expect(meta.alternates?.canonical).toBe('http://localhost:3000/lectures/a')
    expect(meta.openGraph).toMatchObject({
      type: 'article',
      url: 'http://localhost:3000/lectures/a',
      images: [{ url: 'http://localhost:3000/cover.png' }],
    })
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' })
  })

  it('keeps absolute image URLs and falls back to the site description', () => {
    const meta = pageMetadata({ title: 'T', path: '/', image: 'https://cdn.example/x.png' })
    expect(meta.openGraph).toMatchObject({ images: [{ url: 'https://cdn.example/x.png' }] })
    expect(meta.description).toMatch(/medical learners/)
    expect(pageMetadata({ title: 'T', path: '/' }).twitter).toMatchObject({ card: 'summary' })
  })
})

describe('JSON-LD builders', () => {
  it('describes the site and breadcrumbs with absolute URLs', () => {
    expect(websiteJsonLd()).toMatchObject({ '@type': 'WebSite', url: 'http://localhost:3000/' })
    expect(
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Lectures', path: '/lectures' },
      ]),
    ).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Home', item: 'http://localhost:3000/' },
        { position: 2, name: 'Lectures', item: 'http://localhost:3000/lectures' },
      ],
    })
  })

  it('describes a lecture as an Article', () => {
    const lecture: Lecture = {
      id: id(2),
      slug: 'acs',
      title: 'ACS',
      summary: null,
      coverImage: { url: '/img.png', alt: 'x', width: null, height: null },
      domains: [domain],
      accessTier: 'free',
      publishedAt: '2026-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-06-01T00:00:00.000Z',
      updatedAt: NOW,
      body: { html: '<p>Body &amp; more</p>' },
      citations: [],
      metaTitle: null,
      metaDescription: null,
    }
    expect(lectureJsonLd(lecture)).toMatchObject({
      '@type': 'Article',
      headline: 'ACS',
      description: 'Body & more',
      datePublished: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-06-01T00:00:00.000Z',
      image: 'http://localhost:3000/img.png',
      about: ['Cardiology'],
      isAccessibleForFree: true,
    })
  })

  it('describes a paper as a ScholarlyArticle with its DOI', () => {
    const paper: Paper = {
      id: id(3),
      slug: '4s',
      title: '4S',
      authors: ['A', 'B'],
      journal: 'The Lancet',
      year: 1994,
      doi: '10.1000/x',
      pubmedUrl: null,
      citationCount: null,
      leadAuthorHIndex: null,
      clinicalRelevance: 5,
      domain,
      accessTier: 'free',
      updatedAt: NOW,
      abstract: empty,
      sparkNotes: { html: '<p>Notes</p>' },
    }
    expect(paperJsonLd(paper)).toMatchObject({
      '@type': 'ScholarlyArticle',
      description: 'Notes',
      author: [
        { '@type': 'Person', name: 'A' },
        { '@type': 'Person', name: 'B' },
      ],
      isPartOf: { '@type': 'Periodical', name: 'The Lancet' },
      datePublished: '1994',
      sameAs: 'https://doi.org/10.1000/x',
    })
  })

  it('describes a video as a VideoObject with ISO duration', () => {
    const video: Video = {
      id: id(4),
      slug: 'v',
      title: 'A video',
      provider: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw',
      thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
      description: empty,
      domain,
      durationSeconds: 125,
      reviewedAt: null,
      accessTier: 'free',
      updatedAt: NOW,
    }
    expect(videoJsonLd(video)).toMatchObject({
      '@type': 'VideoObject',
      name: 'A video',
      description: 'A video',
      uploadDate: NOW,
      duration: 'PT125S',
    })
  })
})

describe('buildSitemap', () => {
  const entries: SitemapEntries = {
    domains: [{ slug: 'cardiology', updatedAt: '2026-01-01T00:00:00.000Z' }],
    lectures: [{ slug: 'a b', updatedAt: '2026-02-01T00:00:00.000Z' }],
    papers: [{ slug: 'p', updatedAt: '2026-03-01T00:00:00.000Z' }],
    videos: [],
    flashcardTopics: [{ slug: 'acs', updatedAt: '2026-04-01T00:00:00.000Z' }],
  }

  it('lists the index pages and one entry per document with its real modified date', () => {
    const urls = buildSitemap(entries, new Date(NOW))
    expect(urls.map((entry) => entry.url)).toEqual([
      'http://localhost:3000/',
      'http://localhost:3000/lectures',
      'http://localhost:3000/papers',
      'http://localhost:3000/videos',
      'http://localhost:3000/flashcards',
      'http://localhost:3000/domains',
      'http://localhost:3000/domains/cardiology',
      'http://localhost:3000/lectures/a%20b',
      'http://localhost:3000/papers/p',
      'http://localhost:3000/flashcards/acs',
    ])
    expect(urls.at(-1)?.lastModified).toEqual(new Date('2026-04-01T00:00:00.000Z'))
  })
})
