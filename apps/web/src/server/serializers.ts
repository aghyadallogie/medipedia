/**
 * Payload documents -> the DTOs the API and the pages share (packages/shared/src/content.ts).
 * Relationships must be populated (depth >= 1). A relationship that is still an id cannot be
 * turned into a reference with a name and slug, so it is dropped (lists) or reported (required).
 */
import {
  providerThumbnailUrl,
  type Domain as DomainDto,
  type DomainRef,
  type Flashcard as FlashcardDto,
  type FlashcardBack,
  type Lecture as LectureDto,
  type LectureSummary,
  type Media as MediaDto,
  type Paper as PaperDto,
  type PaperSummary,
  type TopicRef,
  type Topic as TopicDto,
  type Video as VideoDto,
  type VideoSummary,
} from '@medipedia/shared'

import type { Domain, Flashcard, Lecture, Media, Paper, Topic, Video } from '@/payload-types'
import { idOf } from '@/server/ids'
import { lexicalToRichText } from '@/server/richtext'

/** The document behind a relationship, or null when it was not populated. */
export function populated<T extends object>(value: string | T | null | undefined): T | null {
  return typeof value === 'object' && value !== null ? value : null
}

export function require_<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`Cannot serialize: ${what} is not populated. Query with depth >= 1.`)
  }
  return value
}

// ---------- references ----------

export function toMedia(value: string | Media | null | undefined): MediaDto | null {
  const doc = populated(value)
  if (!doc?.url) return null
  return {
    url: doc.url,
    alt: doc.alt,
    width: doc.width ?? null,
    height: doc.height ?? null,
  }
}

export const toDomainRef = (doc: Domain): DomainRef => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
})

export const toTopicRef = (doc: Topic): TopicRef => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
})

const domainRefs = (values: ReadonlyArray<string | Domain> | null | undefined): DomainRef[] =>
  (values ?? []).flatMap((value) => {
    const doc = populated(value)
    return doc ? [toDomainRef(doc)] : []
  })

const optionalDomainRef = (value: string | Domain | null | undefined): DomainRef | null => {
  const doc = populated(value)
  return doc ? toDomainRef(doc) : null
}

// ---------- taxonomy ----------

export const toDomain = (doc: Domain): DomainDto => ({
  ...toDomainRef(doc),
  description: doc.description ?? null,
  parentId: idOf(doc.parent),
  order: doc.order,
  updatedAt: doc.updatedAt,
})

export const toTopic = (doc: Topic): TopicDto => ({
  ...toTopicRef(doc),
  domain: toDomainRef(require_(populated(doc.domain), 'topic.domain')),
  order: doc.order,
  updatedAt: doc.updatedAt,
})

// ---------- lectures ----------

export type LectureSummaryDoc = Pick<
  Lecture,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'coverImage'
  | 'domains'
  | 'accessTier'
  | 'publishedAt'
  | 'lastReviewedAt'
  | 'updatedAt'
>

export const toLectureSummary = (doc: LectureSummaryDoc): LectureSummary => ({
  id: doc.id,
  slug: doc.slug,
  title: doc.title,
  summary: doc.summary ?? null,
  coverImage: toMedia(doc.coverImage),
  domains: domainRefs(doc.domains),
  accessTier: doc.accessTier,
  publishedAt: doc.publishedAt ?? null,
  lastReviewedAt: doc.lastReviewedAt ?? null,
  updatedAt: doc.updatedAt,
})

export const toLecture = (doc: Lecture): LectureDto => ({
  ...toLectureSummary(doc),
  body: lexicalToRichText(doc.body),
  citations: (doc.citations ?? []).map(({ label, url }) => ({ label, url })),
  metaTitle: doc.metaTitle ?? null,
  metaDescription: doc.metaDescription ?? null,
})

// ---------- flashcards ----------

/** `back` is left out until revealed (`GET /flashcards/:id/back`) and always for `?client=mobile`. */
export function toFlashcard(doc: Flashcard, options: { includeBack: boolean }): FlashcardDto {
  const topic = require_(populated(doc.topic), 'flashcard.topic')
  const domain = require_(populated(doc.domain), 'flashcard.domain')
  return {
    id: doc.id,
    front: doc.front,
    frontImage: toMedia(doc.frontImage),
    tags: doc.tags ?? [],
    topic: toTopicRef(topic),
    domain: toDomainRef(domain),
    accessTier: doc.accessTier,
    updatedAt: doc.updatedAt,
    ...(options.includeBack ? { back: lexicalToRichText(doc.back) } : {}),
  }
}

export const toFlashcardBack = (doc: Pick<Flashcard, 'id' | 'back'>): FlashcardBack => ({
  id: doc.id,
  back: lexicalToRichText(doc.back),
})

// ---------- papers ----------

export type PaperSummaryDoc = Pick<
  Paper,
  | 'id'
  | 'slug'
  | 'title'
  | 'authors'
  | 'journal'
  | 'year'
  | 'doi'
  | 'pubmedUrl'
  | 'citationCount'
  | 'leadAuthorHIndex'
  | 'clinicalRelevance'
  | 'domain'
  | 'accessTier'
  | 'updatedAt'
>

export const toPaperSummary = (doc: PaperSummaryDoc): PaperSummary => ({
  id: doc.id,
  slug: doc.slug,
  title: doc.title,
  authors: doc.authors ?? [],
  journal: doc.journal ?? null,
  year: doc.year ?? null,
  doi: doc.doi ?? null,
  pubmedUrl: doc.pubmedUrl ?? null,
  citationCount: doc.citationCount ?? null,
  leadAuthorHIndex: doc.leadAuthorHIndex ?? null,
  clinicalRelevance: doc.clinicalRelevance ?? null,
  domain: optionalDomainRef(doc.domain),
  accessTier: doc.accessTier,
  updatedAt: doc.updatedAt,
})

export const toPaper = (doc: Paper): PaperDto => ({
  ...toPaperSummary(doc),
  abstract: lexicalToRichText(doc.abstract),
  sparkNotes: lexicalToRichText(doc.sparkNotes),
})

// ---------- videos ----------

export type VideoSummaryDoc = Pick<
  Video,
  | 'id'
  | 'slug'
  | 'title'
  | 'provider'
  | 'providerVideoId'
  | 'embedUrl'
  | 'thumbnail'
  | 'domain'
  | 'durationSeconds'
  | 'reviewedAt'
  | 'accessTier'
  | 'updatedAt'
>

export function toVideoSummary(doc: VideoSummaryDoc): VideoSummary {
  const provider = doc.provider ?? 'other'
  const uploaded = toMedia(doc.thumbnail)
  const derived =
    doc.providerVideoId != null ? providerThumbnailUrl(provider, doc.providerVideoId) : null
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    provider,
    embedUrl: doc.embedUrl,
    thumbnailUrl: uploaded?.url ?? derived,
    domain: optionalDomainRef(doc.domain),
    durationSeconds: doc.durationSeconds ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    accessTier: doc.accessTier,
    updatedAt: doc.updatedAt,
  }
}

export const toVideo = (doc: Video): VideoDto => ({
  ...toVideoSummary(doc),
  description: lexicalToRichText(doc.description),
})
