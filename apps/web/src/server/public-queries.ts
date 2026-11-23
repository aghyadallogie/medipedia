/**
 * Public content reads, shared by the web pages and the /api/v1 read endpoints (AGENTS.md §6, §7).
 *
 * - Reads go through the Local API with `overrideAccess: false` and no user, so the collection
 *   access rules (published content only) apply here as well, not just at the HTTP edge.
 * - Every exported query is cached with tags that the publish hooks invalidate.
 * - Results are DTOs from packages/shared, ready to serialize.
 */
import {
  IdSchema,
  SlugSchema,
  type AccessTier,
  type Domain as DomainDto,
  type FlashcardBack,
  type Flashcard as FlashcardDto,
  type Lecture as LectureDto,
  type LectureSummary,
  type Paper as PaperDto,
  type PaperSummary,
  type QuestionStats,
  type Topic as TopicDto,
  type Video as VideoDto,
  type VideoSummary,
} from '@medipedia/shared'
import { getPayload, type DataFromCollectionSlug, type Where } from 'payload'

import config from '@/payload.config'
import { cachedQuery } from '@/server/cache'
import { CONTENT_TAG, tag } from '@/server/cache-tags'
import {
  cursorLength,
  decodeCursor,
  keysetWhere,
  payloadSort,
  toPage,
  type Page,
  type SortSpec,
} from '@/server/cursor'
import { ApiError } from '@/server/http'
import {
  toDomain,
  toDomainRef,
  toFlashcard,
  toFlashcardBack,
  toLecture,
  toLectureSummary,
  toPaper,
  toPaperSummary,
  toTopic,
  toVideo,
  toVideoSummary,
} from '@/server/serializers'

export type { Page } from '@/server/cursor'

const getClient = () => getPayload({ config })

/** What every public read applies on top of the collection access rules. */
const PUBLIC = { overrideAccess: false, draft: false } as const

type PagedCollection = 'lectures' | 'papers' | 'videos' | 'flashcards'

const SORT = {
  lectures: [{ field: 'updatedAt', direction: 'desc' }],
  papers: [{ field: 'title', direction: 'asc' }],
  videos: [{ field: 'updatedAt', direction: 'desc' }],
  flashcards: [{ field: 'createdAt', direction: 'asc' }],
} as const satisfies Record<PagedCollection, readonly SortSpec[]>

type ListArgs = { cursor?: string; limit: number }

/** Reject a bad cursor before touching the cache, so errors are never cached. */
function assertCursor(cursor: string | undefined, sort: readonly SortSpec[]): void {
  if (cursor !== undefined && decodeCursor(cursor, cursorLength(sort)) === null) {
    throw new ApiError('validation_error', 'Invalid cursor.')
  }
}

async function findPage<C extends PagedCollection>(args: {
  collection: C
  where: Where[]
  cursor: string | null
  limit: number
  depth: number
  select?: Record<string, true>
}): Promise<Page<DataFromCollectionSlug<C>>> {
  const sort: readonly SortSpec[] = SORT[args.collection]
  const filters = [...args.where]
  if (args.cursor !== null) {
    const values = decodeCursor(args.cursor, cursorLength(sort))
    if (values === null) throw new ApiError('validation_error', 'Invalid cursor.')
    filters.push(keysetWhere(sort, values))
  }

  const payload = await getClient()
  // The Local API's per-collection overloads cannot express "any paged collection", so the
  // options are passed untyped here. Callers are typed by the return type.
  const result = await payload.find({
    collection: args.collection,
    where: filters.length > 0 ? { and: filters } : undefined,
    sort: payloadSort(sort),
    // One extra row tells us whether another page exists.
    limit: args.limit + 1,
    pagination: false,
    depth: args.depth,
    select: args.select,
    ...PUBLIC,
  } as never)

  return toPage(result.docs as unknown as Array<DataFromCollectionSlug<C>>, args.limit, sort)
}

const listTags = (collection: string, domain: string | null) => [
  CONTENT_TAG,
  collection,
  // List items embed domain names, so a renamed domain must refresh them.
  'domains',
  ...(domain ? [tag.domain(domain)] : []),
]

// ---------- domains and topics ----------

const domainsQuery = cachedQuery(
  'domains:list',
  async (): Promise<DomainDto[]> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'domains',
      sort: ['order', 'name'],
      pagination: false,
      depth: 0,
      ...PUBLIC,
    })
    return docs.map(toDomain)
  },
  () => [CONTENT_TAG, 'domains'],
)

/** All domains, top-level and sub-domains, in display order. */
export const listDomains = (): Promise<DomainDto[]> => domainsQuery()

const domainQuery = cachedQuery(
  'domains:get',
  async (slug: string): Promise<DomainDto | null> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'domains',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...PUBLIC,
    })
    const doc = docs[0]
    return doc ? toDomain(doc) : null
  },
  (slug) => [CONTENT_TAG, 'domains', tag.domain(slug)],
)

export async function getDomain(slug: string): Promise<DomainDto | null> {
  return SlugSchema.safeParse(slug).success ? domainQuery(slug) : null
}

const topicsQuery = cachedQuery(
  'topics:list',
  async (domain: string | null): Promise<TopicDto[]> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'topics',
      where: domain ? { 'domain.slug': { equals: domain } } : undefined,
      sort: ['order', 'name'],
      pagination: false,
      depth: 1,
      ...PUBLIC,
    })
    return docs.map(toTopic)
  },
  (domain) => [CONTENT_TAG, 'topics', 'domains', ...(domain ? [tag.domain(domain)] : [])],
)

export const listTopics = (query: { domain?: string } = {}): Promise<TopicDto[]> =>
  topicsQuery(query.domain ?? null)

// ---------- lectures ----------

const lectureListSelect = {
  title: true,
  slug: true,
  summary: true,
  coverImage: true,
  domains: true,
  accessTier: true,
  publishedAt: true,
  lastReviewedAt: true,
  updatedAt: true,
} as const

const lecturesQuery = cachedQuery(
  'lectures:list',
  async (
    domain: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<Page<LectureSummary>> => {
    const page = await findPage({
      collection: 'lectures',
      where: domain ? [{ 'domains.slug': { equals: domain } }] : [],
      cursor,
      limit,
      depth: 1,
      select: lectureListSelect,
    })
    return { items: page.items.map(toLectureSummary), nextCursor: page.nextCursor }
  },
  (domain) => listTags('lectures', domain),
)

export function listLectures(query: ListArgs & { domain?: string }): Promise<Page<LectureSummary>> {
  assertCursor(query.cursor, SORT.lectures)
  return lecturesQuery(query.domain ?? null, query.cursor ?? null, query.limit)
}

const lectureQuery = cachedQuery(
  'lectures:get',
  async (slug: string): Promise<LectureDto | null> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'lectures',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      ...PUBLIC,
    })
    const doc = docs[0]
    return doc ? toLecture(doc) : null
  },
  (slug) => [CONTENT_TAG, 'lectures', 'domains', tag.lecture(slug)],
)

export async function getLecture(slug: string): Promise<LectureDto | null> {
  return SlugSchema.safeParse(slug).success ? lectureQuery(slug) : null
}

// ---------- papers ----------

const paperListSelect = {
  title: true,
  slug: true,
  authors: true,
  journal: true,
  year: true,
  doi: true,
  pubmedUrl: true,
  citationCount: true,
  leadAuthorHIndex: true,
  clinicalRelevance: true,
  domain: true,
  accessTier: true,
  updatedAt: true,
} as const

const papersQuery = cachedQuery(
  'papers:list',
  async (
    domain: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<Page<PaperSummary>> => {
    const page = await findPage({
      collection: 'papers',
      where: domain ? [{ 'domain.slug': { equals: domain } }] : [],
      cursor,
      limit,
      depth: 1,
      select: paperListSelect,
    })
    return { items: page.items.map(toPaperSummary), nextCursor: page.nextCursor }
  },
  (domain) => listTags('papers', domain),
)

export function listPapers(query: ListArgs & { domain?: string }): Promise<Page<PaperSummary>> {
  assertCursor(query.cursor, SORT.papers)
  return papersQuery(query.domain ?? null, query.cursor ?? null, query.limit)
}

const paperQuery = cachedQuery(
  'papers:get',
  async (slug: string): Promise<PaperDto | null> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'papers',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      ...PUBLIC,
    })
    const doc = docs[0]
    return doc ? toPaper(doc) : null
  },
  (slug) => [CONTENT_TAG, 'papers', 'domains', tag.paper(slug)],
)

export async function getPaper(slug: string): Promise<PaperDto | null> {
  return SlugSchema.safeParse(slug).success ? paperQuery(slug) : null
}

// ---------- videos ----------

const videoListSelect = {
  title: true,
  slug: true,
  provider: true,
  providerVideoId: true,
  embedUrl: true,
  thumbnail: true,
  domain: true,
  durationSeconds: true,
  reviewedAt: true,
  accessTier: true,
  updatedAt: true,
} as const

const videosQuery = cachedQuery(
  'videos:list',
  async (
    domain: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<Page<VideoSummary>> => {
    const page = await findPage({
      collection: 'videos',
      where: domain ? [{ 'domain.slug': { equals: domain } }] : [],
      cursor,
      limit,
      depth: 1,
      select: videoListSelect,
    })
    return { items: page.items.map(toVideoSummary), nextCursor: page.nextCursor }
  },
  (domain) => listTags('videos', domain),
)

export function listVideos(query: ListArgs & { domain?: string }): Promise<Page<VideoSummary>> {
  assertCursor(query.cursor, SORT.videos)
  return videosQuery(query.domain ?? null, query.cursor ?? null, query.limit)
}

const videoQuery = cachedQuery(
  'videos:get',
  async (slug: string): Promise<VideoDto | null> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'videos',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      ...PUBLIC,
    })
    const doc = docs[0]
    return doc ? toVideo(doc) : null
  },
  (slug) => [CONTENT_TAG, 'videos', 'domains', tag.video(slug)],
)

export async function getVideo(slug: string): Promise<VideoDto | null> {
  return SlugSchema.safeParse(slug).success ? videoQuery(slug) : null
}

// ---------- flashcards ----------

const flashcardsQuery = cachedQuery(
  'flashcards:list',
  async (
    domain: string | null,
    topic: string | null,
    includeBack: boolean,
    cursor: string | null,
    limit: number,
  ): Promise<Page<FlashcardDto>> => {
    const where: Where[] = []
    if (domain) where.push({ 'domain.slug': { equals: domain } })
    if (topic) where.push({ 'topic.slug': { equals: topic } })
    const page = await findPage({ collection: 'flashcards', where, cursor, limit, depth: 2 })
    return {
      items: page.items.map((doc) => toFlashcard(doc, { includeBack })),
      nextCursor: page.nextCursor,
    }
  },
  (domain, topic) => [
    ...listTags('flashcards', domain),
    'topics',
    ...(topic ? [tag.topic(topic)] : []),
  ],
)

export function listFlashcards(
  query: ListArgs & { domain?: string; topic?: string; includeBack: boolean },
): Promise<Page<FlashcardDto>> {
  assertCursor(query.cursor, SORT.flashcards)
  return flashcardsQuery(
    query.domain ?? null,
    query.topic ?? null,
    query.includeBack,
    query.cursor ?? null,
    query.limit,
  )
}

const flashcardBackQuery = cachedQuery(
  'flashcards:back',
  async (id: string): Promise<{ back: FlashcardBack; accessTier: AccessTier } | null> => {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'flashcards',
      where: { id: { equals: id } },
      limit: 1,
      depth: 2,
      ...PUBLIC,
    })
    const doc = docs[0]
    return doc ? { back: toFlashcardBack(doc), accessTier: doc.accessTier } : null
  },
  (id) => [CONTENT_TAG, 'flashcards', tag.flashcard(id)],
)

export async function getFlashcardBack(
  id: string,
): Promise<{ back: FlashcardBack; accessTier: AccessTier } | null> {
  return IdSchema.safeParse(id).success ? flashcardBackQuery(id) : null
}

// ---------- question statistics ----------

const questionStatsQuery = cachedQuery(
  'questions:stats',
  async (): Promise<QuestionStats> => {
    const payload = await getClient()

    // Questions need a signed-in reader, so this one query bypasses access. It selects only
    // the two relationship ids and the response carries counts, never question content.
    const { docs: questions } = await payload.find({
      collection: 'questions',
      where: { _status: { equals: 'published' } },
      select: { domain: true, topic: true },
      pagination: false,
      depth: 0,
      draft: false,
      overrideAccess: true,
    })

    const [domains, topics] = await Promise.all([
      payload.find({
        collection: 'domains',
        sort: ['order', 'name'],
        pagination: false,
        depth: 0,
        ...PUBLIC,
      }),
      payload.find({
        collection: 'topics',
        sort: ['order', 'name'],
        pagination: false,
        depth: 0,
        ...PUBLIC,
      }),
    ])

    const byDomain = new Map<string, number>()
    const byTopic = new Map<string, number>()
    for (const question of questions) {
      const domainId = typeof question.domain === 'string' ? question.domain : null
      const topicId = typeof question.topic === 'string' ? question.topic : null
      if (domainId) byDomain.set(domainId, (byDomain.get(domainId) ?? 0) + 1)
      if (topicId) byTopic.set(topicId, (byTopic.get(topicId) ?? 0) + 1)
    }

    return {
      total: questions.length,
      byDomain: domains.docs.map((doc) => ({
        ...toDomainRef(doc),
        count: byDomain.get(doc.id) ?? 0,
      })),
      byTopic: topics.docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        slug: doc.slug,
        domainId: typeof doc.domain === 'string' ? doc.domain : doc.domain.id,
        count: byTopic.get(doc.id) ?? 0,
      })),
    }
  },
  () => [CONTENT_TAG, 'questions', 'domains', 'topics'],
)

export const getQuestionStats = (): Promise<QuestionStats> => questionStatsQuery()

// ---------- sitemap ----------

type SitemapEntry = { slug: string; updatedAt: string }
export type SitemapEntries = {
  domains: SitemapEntry[]
  lectures: SitemapEntry[]
  papers: SitemapEntry[]
  videos: SitemapEntry[]
}

async function entries(collection: 'domains' | 'lectures' | 'papers' | 'videos') {
  const payload = await getClient()
  const { docs } = await payload.find({
    collection,
    select: { slug: true, updatedAt: true },
    pagination: false,
    depth: 0,
    ...PUBLIC,
  } as never)
  return (docs as unknown as SitemapEntry[]).map(({ slug, updatedAt }) => ({ slug, updatedAt }))
}

const sitemapQuery = cachedQuery(
  'sitemap',
  async (): Promise<SitemapEntries> => {
    const [domains, lectures, papers, videos] = await Promise.all([
      entries('domains'),
      entries('lectures'),
      entries('papers'),
      entries('videos'),
    ])
    return { domains, lectures, papers, videos }
  },
  () => [CONTENT_TAG, 'domains', 'lectures', 'papers', 'videos'],
)

export const getSitemapEntries = (): Promise<SitemapEntries> => sitemapQuery()
