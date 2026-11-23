import {
  DomainSchema,
  FlashcardSchema,
  LectureSchema,
  LectureSummarySchema,
  PaperSchema,
  PaperSummarySchema,
  TopicSchema,
  VideoSchema,
} from '@medipedia/shared'
import { describe, expect, it } from 'vitest'

import type { Domain, Flashcard, Lecture, Media, Paper, Topic, Video } from '@/payload-types'

import { paragraphsToLexical } from './lexical'
import {
  toDomain,
  toFlashcard,
  toFlashcardBack,
  toLecture,
  toLectureSummary,
  toMedia,
  toPaper,
  toPaperSummary,
  toTopic,
  toVideo,
} from './serializers'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NOW = '2026-11-22T12:00:00.000Z'
const rich = (text: string) => paragraphsToLexical([text])

const cardiology: Domain = {
  id: id(1),
  name: 'Cardiology',
  slug: 'cardiology',
  description: 'Heart.',
  parent: null,
  order: 1,
  updatedAt: NOW,
  createdAt: NOW,
}
const sub: Domain = {
  ...cardiology,
  id: id(2),
  name: 'Arrhythmias',
  slug: 'arrhythmias',
  parent: cardiology.id,
}
const acs: Topic = {
  id: id(3),
  name: 'ACS',
  slug: 'acs',
  domain: cardiology,
  order: 1,
  updatedAt: NOW,
  createdAt: NOW,
}
const image: Media = {
  id: id(4),
  alt: 'A diagram',
  url: '/api/cms/media/file/diagram.png',
  width: 800,
  height: 600,
  updatedAt: NOW,
  createdAt: NOW,
}

describe('taxonomy', () => {
  it('serializes a domain with its parent id', () => {
    const dto = toDomain(sub)
    expect(DomainSchema.parse(dto)).toEqual(dto)
    expect(dto.parentId).toBe(cardiology.id)
    expect(toDomain({ ...sub, parent: cardiology }).parentId).toBe(cardiology.id)
    expect(toDomain({ ...cardiology, description: undefined }).description).toBeNull()
  })

  it('serializes a topic with its domain', () => {
    const dto = toTopic(acs)
    expect(TopicSchema.parse(dto)).toEqual(dto)
    expect(dto.domain).toEqual({ id: cardiology.id, name: 'Cardiology', slug: 'cardiology' })
  })

  it('refuses a topic whose domain was not populated', () => {
    expect(() => toTopic({ ...acs, domain: cardiology.id })).toThrow(/depth >= 1/)
  })
})

describe('media', () => {
  it('maps a populated upload and ignores ids, missing files and empty values', () => {
    expect(toMedia(image)).toEqual({
      url: '/api/cms/media/file/diagram.png',
      alt: 'A diagram',
      width: 800,
      height: 600,
    })
    expect(toMedia(image.id)).toBeNull()
    expect(toMedia(null)).toBeNull()
    expect(toMedia(undefined)).toBeNull()
    expect(toMedia({ ...image, url: null })).toBeNull()
    expect(toMedia({ ...image, width: undefined, height: undefined })).toMatchObject({
      width: null,
      height: null,
    })
  })
})

describe('lectures', () => {
  const lecture: Lecture = {
    id: id(10),
    title: 'Chest pain',
    slug: 'chest-pain',
    summary: 'Summary',
    coverImage: image,
    domains: [cardiology, sub.id],
    body: rich('Body text'),
    citations: [{ id: 'row-1', label: 'Guideline', url: 'https://example.com/g' }],
    publishedAt: NOW,
    lastReviewedAt: null,
    accessTier: 'free',
    metaTitle: null,
    metaDescription: 'Meta',
    updatedAt: NOW,
    createdAt: NOW,
    _status: 'published',
  }

  it('summaries drop unpopulated domains and carry no body', () => {
    const dto = toLectureSummary(lecture)
    expect(LectureSummarySchema.parse(dto)).toEqual(dto)
    expect(dto.domains.map((domain) => domain.slug)).toEqual(['cardiology'])
    expect(dto).not.toHaveProperty('body')
    expect(dto.lastReviewedAt).toBeNull()
  })

  it('full lectures render the body as HTML and strip citation row ids', () => {
    const dto = toLecture(lecture)
    expect(LectureSchema.parse(dto)).toEqual(dto)
    expect(dto.body).toEqual({ html: '<p>Body text</p>' })
    expect(dto.citations).toEqual([{ label: 'Guideline', url: 'https://example.com/g' }])
    expect(dto.metaTitle).toBeNull()
    expect(dto.metaDescription).toBe('Meta')
  })

  it('tolerates optional fields that are absent', () => {
    const dto = toLecture({
      ...lecture,
      summary: undefined,
      coverImage: undefined,
      citations: undefined,
      publishedAt: undefined,
    })
    expect(LectureSchema.parse(dto)).toEqual(dto)
    expect(dto.coverImage).toBeNull()
    expect(dto.citations).toEqual([])
  })
})

describe('flashcards', () => {
  const card: Flashcard = {
    id: id(20),
    front: 'Front?',
    frontImage: image,
    back: rich('Answer'),
    topic: acs,
    domain: cardiology,
    tags: ['a'],
    accessTier: 'free',
    updatedAt: NOW,
    createdAt: NOW,
    _status: 'published',
  }

  it('includes the back for the web shape and omits it for mobile', () => {
    const web = toFlashcard(card, { includeBack: true })
    expect(FlashcardSchema.parse(web)).toEqual(web)
    expect(web.back).toEqual({ html: '<p>Answer</p>' })

    const mobile = toFlashcard(card, { includeBack: false })
    expect(FlashcardSchema.parse(mobile)).toEqual(mobile)
    expect(mobile).not.toHaveProperty('back')
  })

  it('always carries the stable id and updatedAt that review state is keyed by', () => {
    const dto = toFlashcard(card, { includeBack: false })
    expect(dto.id).toBe(card.id)
    expect(dto.updatedAt).toBe(NOW)
  })

  it('reports missing relationships instead of guessing', () => {
    expect(() => toFlashcard({ ...card, topic: acs.id }, { includeBack: true })).toThrow(/topic/)
    expect(() => toFlashcard({ ...card, domain: null }, { includeBack: true })).toThrow(/domain/)
  })

  it('serializes just the back', () => {
    expect(toFlashcardBack(card)).toEqual({ id: card.id, back: { html: '<p>Answer</p>' } })
  })
})

describe('papers', () => {
  const paper: Paper = {
    id: id(30),
    title: '4S',
    slug: '4s',
    authors: ['A', 'B'],
    journal: 'The Lancet',
    year: 1994,
    doi: '10.1000/x',
    pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/1/',
    citationCount: 10,
    leadAuthorHIndex: 5,
    clinicalRelevance: 5,
    abstract: rich('Abstract'),
    sparkNotes: rich('Notes'),
    domain: cardiology,
    accessTier: 'free',
    updatedAt: NOW,
    createdAt: NOW,
    _status: 'published',
  }

  it('summaries omit the abstract and spark notes', () => {
    const dto = toPaperSummary(paper)
    expect(PaperSummarySchema.parse(dto)).toEqual(dto)
    expect(dto).not.toHaveProperty('abstract')
    expect(dto).not.toHaveProperty('sparkNotes')
  })

  it('full papers include both as HTML', () => {
    const dto = toPaper(paper)
    expect(PaperSchema.parse(dto)).toEqual(dto)
    expect(dto.sparkNotes.html).toBe('<p>Notes</p>')
    expect(dto.abstract.html).toBe('<p>Abstract</p>')
  })

  it('maps absent metadata to null and tolerates an unpopulated domain', () => {
    const dto = toPaperSummary({
      ...paper,
      journal: undefined,
      year: undefined,
      doi: undefined,
      pubmedUrl: undefined,
      citationCount: undefined,
      leadAuthorHIndex: undefined,
      clinicalRelevance: undefined,
      domain: cardiology.id,
    })
    expect(PaperSummarySchema.parse(dto)).toEqual(dto)
    expect(dto).toMatchObject({ journal: null, year: null, doi: null, domain: null })
  })
})

describe('videos', () => {
  const video: Video = {
    id: id(40),
    title: 'Video',
    slug: 'video',
    embedUrl: 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw',
    provider: 'youtube',
    providerVideoId: 'jNQXAC9IVRw',
    description: rich('About'),
    domain: cardiology,
    durationSeconds: 19,
    reviewedAt: NOW,
    accessTier: 'free',
    updatedAt: NOW,
    createdAt: NOW,
    _status: 'published',
  }

  it('derives a YouTube thumbnail when none was uploaded', () => {
    const dto = toVideo(video)
    expect(VideoSchema.parse(dto)).toEqual(dto)
    expect(dto.thumbnailUrl).toBe('https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg')
    expect(dto.description.html).toBe('<p>About</p>')
  })

  it('prefers an uploaded thumbnail', () => {
    expect(toVideo({ ...video, thumbnail: image }).thumbnailUrl).toBe(image.url)
  })

  it('has no derived thumbnail for Vimeo', () => {
    const dto = toVideo({ ...video, provider: 'vimeo', providerVideoId: '76979871' })
    expect(dto.thumbnailUrl).toBeNull()
    expect(dto.provider).toBe('vimeo')
  })

  it('falls back to "other" when the provider was never derived', () => {
    expect(toVideo({ ...video, provider: null, providerVideoId: null }).provider).toBe('other')
  })
})
