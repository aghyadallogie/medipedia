/**
 * Phase 3 exit tests: the public read API behaves as specified against a real database, only
 * ever exposes published content, never leaks question content, and agrees with the typed client.
 */
import { createApiClient, paginate, ApiClientError } from '@medipedia/api-client'
import {
  DomainListResponseSchema,
  DomainResponseSchema,
  FlashcardBackResponseSchema,
  FlashcardListResponseSchema,
  LectureListResponseSchema,
  LectureResponseSchema,
  PaperListResponseSchema,
  PaperResponseSchema,
  QuestionStatsResponseSchema,
  TopicListResponseSchema,
  VideoListResponseSchema,
  VideoResponseSchema,
  ApiErrorBodySchema,
} from '@medipedia/shared'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// `unstable_cache` needs the Next.js runtime. Record what each query caches under and run it
// directly, so the tests can also check that cache tags and publish invalidation agree.
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; tags: string[] }>)
vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: (...args: never[]) => Promise<unknown>,
    keyParts: string[],
    options: { tags: string[] },
  ) => {
    cacheCalls.push({ keyParts, tags: options.tags })
    return fn
  },
  revalidateTag: vi.fn(),
}))

import { revalidateTag } from 'next/cache'

import { GET as domainGET } from '@/app/api/v1/domains/[slug]/route'
import { GET as domainsGET } from '@/app/api/v1/domains/route'
import { GET as flashcardBackGET } from '@/app/api/v1/flashcards/[id]/back/route'
import { GET as flashcardsGET } from '@/app/api/v1/flashcards/route'
import { GET as healthGET } from '@/app/api/v1/health/route'
import { GET as lectureGET } from '@/app/api/v1/lectures/[slug]/route'
import { GET as lecturesGET } from '@/app/api/v1/lectures/route'
import { GET as paperGET } from '@/app/api/v1/papers/[slug]/route'
import { GET as papersGET } from '@/app/api/v1/papers/route'
import { GET as statsGET } from '@/app/api/v1/questions/stats/route'
import { GET as topicsGET } from '@/app/api/v1/topics/route'
import { GET as videoGET } from '@/app/api/v1/videos/[slug]/route'
import { GET as videosGET } from '@/app/api/v1/videos/route'
import { CACHE_CONTROL } from '@/server/http'
import { paragraphsToLexical } from '@/server/lexical'
import {
  getFlashcardTopic,
  getLecture,
  getSitemapEntries,
  listFlashcardTopics,
  listLectures,
} from '@/server/public-queries'
import { seedSampleContent } from '@/scripts/seed-content'

import { creator, PASSWORD, startHarness, type Harness } from './harness'

// ---------- a tiny router so the client can talk to the route handlers directly ----------

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Response | Promise<Response>
const routes: Array<{ pattern: RegExp; keys: string[]; handler: Handler }> = [
  { pattern: /^\/api\/v1\/health$/, keys: [], handler: healthGET as Handler },
  { pattern: /^\/api\/v1\/domains$/, keys: [], handler: domainsGET as Handler },
  { pattern: /^\/api\/v1\/domains\/([^/]+)$/, keys: ['slug'], handler: domainGET as Handler },
  { pattern: /^\/api\/v1\/topics$/, keys: [], handler: topicsGET as Handler },
  { pattern: /^\/api\/v1\/lectures$/, keys: [], handler: lecturesGET as Handler },
  { pattern: /^\/api\/v1\/lectures\/([^/]+)$/, keys: ['slug'], handler: lectureGET as Handler },
  { pattern: /^\/api\/v1\/papers$/, keys: [], handler: papersGET as Handler },
  { pattern: /^\/api\/v1\/papers\/([^/]+)$/, keys: ['slug'], handler: paperGET as Handler },
  { pattern: /^\/api\/v1\/videos$/, keys: [], handler: videosGET as Handler },
  { pattern: /^\/api\/v1\/videos\/([^/]+)$/, keys: ['slug'], handler: videoGET as Handler },
  { pattern: /^\/api\/v1\/flashcards$/, keys: [], handler: flashcardsGET as Handler },
  {
    pattern: /^\/api\/v1\/flashcards\/([^/]+)\/back$/,
    keys: ['id'],
    handler: flashcardBackGET as Handler,
  },
  { pattern: /^\/api\/v1\/questions\/stats$/, keys: [], handler: statsGET as Handler },
]

const BASE = 'http://test.local'

async function call(pathAndQuery: string): Promise<Response> {
  const request = new Request(`${BASE}${pathAndQuery}`)
  const { pathname } = new URL(request.url)
  for (const route of routes) {
    const match = route.pattern.exec(pathname)
    if (!match) continue
    const params = Object.fromEntries(
      route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1] ?? '')]),
    )
    return route.handler(request, { params: Promise.resolve(params) })
  }
  throw new Error(`No route for ${pathname}`)
}

const routeFetch: typeof fetch = async (input) => {
  const url = new URL(String(input))
  return call(url.pathname + url.search)
}
const api = createApiClient({ baseUrl: BASE, fetch: routeFetch })

async function json(
  pathAndQuery: string,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const response = await call(pathAndQuery)
  return { status: response.status, body: await response.json(), headers: response.headers }
}

// ---------- fixtures ----------

let harness: Harness
let payload: Payload
let create: ReturnType<typeof creator>
const rich = (text: string) => paragraphsToLexical([text])
const quiet = { disableRevalidate: true }

const LECTURE_SLUGS = [
  'sample-approach-to-acute-chest-pain',
  'sample-mechanisms-of-common-antihypertensive-classes',
]

beforeAll(async () => {
  harness = await startHarness()
  payload = harness.payload
  create = creator(payload)

  // The first user becomes the admin, who is then recorded as the video reviewer by the seed.
  await create({
    collection: 'users',
    data: { email: 'admin@example.com', password: PASSWORD },
  })
  await seedSampleContent(payload)

  const [cardiology, topics] = await Promise.all([
    payload.find({ collection: 'domains', where: { slug: { equals: 'cardiology' } }, limit: 1 }),
    payload.find({
      collection: 'topics',
      where: { slug: { equals: 'ischemic-heart-disease' } },
      limit: 1,
    }),
  ])
  const domain = cardiology.docs[0]
  const topic = topics.docs[0]
  if (!domain || !topic) throw new Error('Seed data is missing')

  // Unpublished work that must never appear.
  await create({
    collection: 'lectures',
    data: {
      title: 'Draft only lecture',
      domains: [domain.id],
      body: rich('Secret'),
      _status: 'draft',
    },
    draft: true,
    context: quiet,
  })
  await create({
    collection: 'papers',
    data: { title: 'Draft only paper', authors: ['X'], domain: domain.id, _status: 'draft' },
    draft: true,
    context: quiet,
  })
  await create({
    collection: 'videos',
    data: {
      title: 'Draft only video',
      embedUrl: 'https://youtu.be/jNQXAC9IVRw',
      domain: domain.id,
      _status: 'draft',
    },
    draft: true,
    context: quiet,
  })
  await create({
    collection: 'flashcards',
    data: { front: 'Draft only card', topic: topic.id, _status: 'draft' },
    draft: true,
    context: quiet,
  })
  await create({
    collection: 'questions',
    data: { stem: 'Draft only question', topic: topic.id, _status: 'draft' },
    draft: true,
    context: quiet,
  })
})

afterAll(async () => {
  await harness?.stop()
})

// ---------- tests ----------

describe('GET /api/v1/health', () => {
  it('reports ok', async () => {
    expect((await json('/api/v1/health')).body).toEqual({ data: { status: 'ok' } })
  })
})

describe('domains and topics', () => {
  it('lists every domain in display order with the paginated envelope', async () => {
    const { status, body, headers } = await json('/api/v1/domains')
    expect(status).toBe(200)
    expect(headers.get('Cache-Control')).toBe(CACHE_CONTROL.public)
    const parsed = DomainListResponseSchema.parse(body)
    expect(parsed.nextCursor).toBeNull()
    // By `order`, then name: Arrhythmias and Cardiology tie on order 1, so the name decides.
    expect(parsed.data.map((domain) => domain.slug)).toEqual([
      'arrhythmias',
      'cardiology',
      'pharmacology',
      'pathology',
    ])
    const sub = parsed.data.find((domain) => domain.slug === 'arrhythmias')
    const parent = parsed.data.find((domain) => domain.slug === 'cardiology')
    expect(sub?.parentId).toBe(parent?.id)
    expect(parent?.parentId).toBeNull()
  })

  it('returns one domain by slug and 404s unknown or malformed slugs', async () => {
    const found = await json('/api/v1/domains/cardiology')
    expect(DomainResponseSchema.parse(found.body).data.name).toBe('Cardiology')

    for (const slug of ['nope', 'Not%20A%20Slug']) {
      const missing = await json(`/api/v1/domains/${slug}`)
      expect(missing.status).toBe(404)
      expect(ApiErrorBodySchema.parse(missing.body).error.code).toBe('not_found')
      expect(missing.headers.get('Cache-Control')).toBe(CACHE_CONTROL.private)
    }
  })

  it('lists topics, optionally for one domain', async () => {
    const all = TopicListResponseSchema.parse((await json('/api/v1/topics')).body)
    expect(all.data).toHaveLength(6)
    const cardiac = TopicListResponseSchema.parse(
      (await json('/api/v1/topics?domain=cardiology')).body,
    )
    expect(cardiac.data.map((topic) => topic.slug)).toEqual([
      'ischemic-heart-disease',
      'cardiac-emergencies',
    ])
    expect(cardiac.data.every((topic) => topic.domain.slug === 'cardiology')).toBe(true)
    expect((await json('/api/v1/topics?domain=nothing-here')).body).toMatchObject({ data: [] })
  })
})

describe('lectures', () => {
  it('lists published lectures without bodies, newest update first', async () => {
    const { body } = await json('/api/v1/lectures')
    const parsed = LectureListResponseSchema.parse(body)
    expect(parsed.data.map((lecture) => lecture.slug).sort()).toEqual(LECTURE_SLUGS)
    expect(parsed.nextCursor).toBeNull()
    for (const lecture of parsed.data) expect(lecture).not.toHaveProperty('body')
    const updated = parsed.data.map((lecture) => lecture.updatedAt)
    expect(updated).toEqual([...updated].sort().reverse())
  })

  it('never returns drafts, in lists or by slug', async () => {
    const list = JSON.stringify((await json('/api/v1/lectures')).body)
    expect(list).not.toContain('Draft only')
    expect((await json('/api/v1/lectures/draft-only-lecture')).status).toBe(404)
  })

  it('filters by domain', async () => {
    const pharmacology = LectureListResponseSchema.parse(
      (await json('/api/v1/lectures?domain=pharmacology')).body,
    )
    expect(pharmacology.data.map((lecture) => lecture.slug)).toEqual([
      'sample-mechanisms-of-common-antihypertensive-classes',
    ])
    const none = LectureListResponseSchema.parse(
      (await json('/api/v1/lectures?domain=pathology')).body,
    )
    expect(none.data).toEqual([])
  })

  it('pages with an opaque cursor without skipping or repeating items', async () => {
    const first = LectureListResponseSchema.parse((await json('/api/v1/lectures?limit=1')).body)
    expect(first.data).toHaveLength(1)
    expect(first.nextCursor).toEqual(expect.any(String))

    const second = LectureListResponseSchema.parse(
      (await json(`/api/v1/lectures?limit=1&cursor=${first.nextCursor}`)).body,
    )
    expect(second.data).toHaveLength(1)
    expect(second.nextCursor).toBeNull()

    expect([first.data[0]?.slug, second.data[0]?.slug].sort()).toEqual(LECTURE_SLUGS)
  })

  it('returns the full lecture with HTML body and citations', async () => {
    const { body, headers } = await json('/api/v1/lectures/sample-approach-to-acute-chest-pain')
    const { data } = LectureResponseSchema.parse(body)
    expect(headers.get('Cache-Control')).toBe(CACHE_CONTROL.public)
    expect(data.body.html).toContain('<p>Acute chest pain has a broad differential.')
    expect(data.domains.map((domain) => domain.slug)).toEqual(['cardiology'])
    expect(data.publishedAt).toEqual(expect.any(String))
  })

  it.each(['limit=0', 'limit=101', 'limit=abc', 'domain=Bad%20Slug', 'cursor=not-a-real-cursor'])(
    'rejects %s with a 400',
    async (query) => {
      const { status, body, headers } = await json(`/api/v1/lectures?${query}`)
      expect(status).toBe(400)
      expect(ApiErrorBodySchema.parse(body).error.code).toBe('validation_error')
      expect(headers.get('Cache-Control')).toBe(CACHE_CONTROL.private)
    },
  )

  it('rejects a cursor that was made for a different sort order', async () => {
    const wrongShape = Buffer.from(JSON.stringify({ v: 1, k: ['only-one-value'] })).toString(
      'base64url',
    )
    expect((await json(`/api/v1/lectures?cursor=${wrongShape}`)).status).toBe(400)
  })
})

describe('papers', () => {
  it('lists summaries alphabetically without abstract or spark notes', async () => {
    const parsed = PaperListResponseSchema.parse((await json('/api/v1/papers')).body)
    expect(parsed.data).toHaveLength(2)
    const titles = parsed.data.map((paper) => paper.title)
    expect(titles).toEqual([...titles].sort())
    for (const paper of parsed.data) {
      expect(paper).not.toHaveProperty('abstract')
      expect(paper).not.toHaveProperty('sparkNotes')
      expect(paper.domain?.slug).toBe('cardiology')
    }
    expect(JSON.stringify(parsed)).not.toContain('Draft only')
  })

  it('returns a full paper with spark notes', async () => {
    const list = PaperListResponseSchema.parse((await json('/api/v1/papers?limit=1')).body)
    const slug = list.data[0]?.slug ?? ''
    const { data } = PaperResponseSchema.parse((await json(`/api/v1/papers/${slug}`)).body)
    expect(data.sparkNotes.html).toContain('Sample content for development')
    expect(data.abstract.html).toMatch(/^<p>/)
    expect((await json('/api/v1/papers/draft-only-paper')).status).toBe(404)
  })
})

describe('videos', () => {
  it('lists videos with normalized embeds and a derived thumbnail', async () => {
    const parsed = VideoListResponseSchema.parse((await json('/api/v1/videos')).body)
    expect(parsed.data).toHaveLength(2)
    const youtube = parsed.data.find((video) => video.provider === 'youtube')
    expect(youtube?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/jNQXAC9IVRw')
    expect(youtube?.thumbnailUrl).toBe('https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg')
    const vimeo = parsed.data.find((video) => video.provider === 'vimeo')
    expect(vimeo?.thumbnailUrl).toBeNull()
    expect(JSON.stringify(parsed)).not.toContain('Draft only')
  })

  it('returns one video and 404s a draft', async () => {
    const { data } = VideoResponseSchema.parse(
      (await json('/api/v1/videos/sample-placeholder-video-youtube')).body,
    )
    expect(data.reviewedAt).toEqual(expect.any(String))
    expect((await json('/api/v1/videos/draft-only-video')).status).toBe(404)
  })
})

describe('flashcards', () => {
  it('includes the back for the web shape and omits it for mobile', async () => {
    const web = FlashcardListResponseSchema.parse((await json('/api/v1/flashcards')).body)
    expect(web.data).toHaveLength(5)
    expect(web.data.every((card) => card.back?.html.startsWith('<p>'))).toBe(true)

    const mobile = FlashcardListResponseSchema.parse(
      (await json('/api/v1/flashcards?client=mobile')).body,
    )
    expect(mobile.data).toHaveLength(5)
    for (const card of mobile.data) expect(card).not.toHaveProperty('back')
    expect(JSON.stringify(mobile)).not.toContain('Hypotension')
  })

  it('always carries the stable id and updatedAt that device review state is keyed by', async () => {
    const { data } = FlashcardListResponseSchema.parse(
      (await json('/api/v1/flashcards?client=mobile')).body,
    )
    for (const card of data) {
      expect(card.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(Date.parse(card.updatedAt)).not.toBeNaN()
    }
  })

  it('filters by topic and domain', async () => {
    const topic = FlashcardListResponseSchema.parse(
      (await json('/api/v1/flashcards?topic=cardiac-emergencies')).body,
    )
    expect(topic.data.map((card) => card.topic.slug)).toEqual(['cardiac-emergencies'])
    const domain = FlashcardListResponseSchema.parse(
      (await json('/api/v1/flashcards?domain=pharmacology')).body,
    )
    expect(domain.data).toHaveLength(2)
    expect(domain.data.every((card) => card.domain.slug === 'pharmacology')).toBe(true)
  })

  it('pages through every card exactly once', async () => {
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page = FlashcardListResponseSchema.parse(
        (await json(`/api/v1/flashcards?limit=2${cursor ? `&cursor=${cursor}` : ''}`)).body,
      )
      seen.push(...page.data.map((card) => card.id))
      cursor = page.nextCursor
    } while (cursor)
    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
  })

  it('reveals the back of one card and 404s drafts, unknown and malformed ids', async () => {
    const list = FlashcardListResponseSchema.parse(
      (await json('/api/v1/flashcards?client=mobile&limit=1')).body,
    )
    const id = list.data[0]?.id ?? ''
    const { data } = FlashcardBackResponseSchema.parse(
      (await json(`/api/v1/flashcards/${id}/back`)).body,
    )
    expect(data.id).toBe(id)
    expect(data.back.html).toMatch(/^<p>/)

    const draft = await payload.find({
      collection: 'flashcards',
      where: { front: { equals: 'Draft only card' } },
      draft: true,
    })
    const draftId = draft.docs[0]?.id ?? 'missing'
    expect((await json(`/api/v1/flashcards/${draftId}/back`)).status).toBe(404)
    expect(
      (await json('/api/v1/flashcards/00000000-0000-4000-8000-000000000000/back')).status,
    ).toBe(404)
    expect((await json('/api/v1/flashcards/not-a-uuid/back')).status).toBe(404)
  })

  it('rejects an unknown client shape', async () => {
    expect((await json('/api/v1/flashcards?client=desktop')).status).toBe(400)
  })
})

describe('flashcard topics', () => {
  it('lists only topics with published cards, counting published cards only', async () => {
    const topics = await listFlashcardTopics()
    expect(topics.map((topic) => topic.slug).sort()).toEqual([
      'antihypertensives',
      'cardiac-emergencies',
      'endocrine-drugs',
      'hemodynamics-and-thrombosis',
      'ischemic-heart-disease',
    ])
    // Ischemic heart disease also has a draft-only card, which must not be counted.
    expect(topics.every((topic) => topic.cardCount === 1)).toBe(true)
    expect(topics.find((topic) => topic.slug === 'ischemic-heart-disease')?.domain.slug).toBe(
      'cardiology',
    )
  })

  it('finds one topic by slug, and nothing for a topic without cards or a bad slug', async () => {
    expect((await getFlashcardTopic('cardiac-emergencies'))?.name).toBe('Cardiac emergencies')
    expect(await getFlashcardTopic('hematopathology')).toBeNull()
    expect(await getFlashcardTopic('no-such-topic')).toBeNull()
    expect(await getFlashcardTopic('Not A Slug!')).toBeNull()
  })
})

describe('question statistics', () => {
  it('counts only published questions, per domain and topic', async () => {
    const { data } = QuestionStatsResponseSchema.parse((await json('/api/v1/questions/stats')).body)
    expect(data.total).toBe(3) // the draft question is not counted
    const byDomain = Object.fromEntries(data.byDomain.map((entry) => [entry.slug, entry.count]))
    expect(byDomain).toEqual({ cardiology: 1, arrhythmias: 0, pharmacology: 1, pathology: 1 })
    expect(data.byTopic.find((entry) => entry.slug === 'ischemic-heart-disease')?.count).toBe(1)
    expect(data.byTopic.find((entry) => entry.slug === 'cardiac-emergencies')?.count).toBe(0)
  })

  it('is public but exposes counts only, never question content', async () => {
    const { headers, body } = await json('/api/v1/questions/stats')
    expect(headers.get('Cache-Control')).toBe(CACHE_CONTROL.public)
    const text = JSON.stringify(body)
    for (const leak of [
      'isCorrect',
      'explanation',
      'overallExplanation',
      'vignette',
      'stem',
      'choices',
      'Occlusion',
      'Draft only',
    ]) {
      expect(text).not.toContain(leak)
    }
  })
})

describe('no public route returns question content', () => {
  it('has no questions endpoint besides the counts', async () => {
    // A list or detail route for questions needs sign-in and arrives with the learner API.
    await expect(call('/api/v1/questions')).rejects.toThrow(/No route/)
  })
})

describe('the typed API client over the real handlers', () => {
  it('parses every endpoint against the shared contract', async () => {
    expect(await api.health()).toEqual({ status: 'ok' })
    expect((await api.domains.list()).length).toBe(4)
    expect((await api.domains.get('cardiology')).name).toBe('Cardiology')
    expect((await api.topics.list({ domain: 'pharmacology' })).length).toBe(2)
    expect((await api.lectures.get('sample-approach-to-acute-chest-pain')).title).toContain(
      'chest pain',
    )
    expect((await api.papers.list()).items).toHaveLength(2)
    expect((await api.videos.list()).items).toHaveLength(2)
    expect((await api.questions.stats()).total).toBe(3)
    const cards = await api.flashcards.list({ client: 'mobile' })
    expect(cards.items[0]).not.toHaveProperty('back')
    expect((await api.flashcards.back(cards.items[0]?.id ?? '')).back.html).toMatch(/^<p>/)
  })

  it('walks all pages with paginate()', async () => {
    const slugs: string[] = []
    for await (const lecture of paginate((cursor) => api.lectures.list({ limit: 1, cursor }))) {
      slugs.push(lecture.slug)
    }
    expect(slugs.sort()).toEqual(LECTURE_SLUGS)
  })

  it('turns API errors into ApiClientError', async () => {
    const error = await api.lectures.get('draft-only-lecture').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({ code: 'not_found', status: 404 })
    const bad = await api.lectures.list({ limit: 500 }).catch((e: unknown) => e)
    expect(bad).toMatchObject({ code: 'validation_error', status: 400 })
  })
})

describe('sitemap data', () => {
  it('lists published documents only, with their modified dates', async () => {
    const entries = await getSitemapEntries()
    expect(entries.lectures.map((entry) => entry.slug).sort()).toEqual(LECTURE_SLUGS)
    expect(entries.domains).toHaveLength(4)
    expect(entries.papers).toHaveLength(2)
    expect(entries.videos).toHaveLength(2)
    expect(entries.flashcardTopics).toHaveLength(5)
    const text = JSON.stringify(entries)
    expect(text).not.toContain('draft-only')
    for (const entry of entries.lectures) expect(Date.parse(entry.updatedAt)).not.toBeNaN()
  })
})

describe('cache tags and publish invalidation agree', () => {
  beforeEach(() => {
    cacheCalls.length = 0
    vi.mocked(revalidateTag).mockClear()
  })

  const tagsOf = (name: string) =>
    cacheCalls.filter((call) => call.keyParts[0] === name).flatMap((call) => call.tags)

  it('publishing a lecture invalidates exactly the tags its detail and list queries use', async () => {
    const domain = await payload.find({
      collection: 'domains',
      where: { slug: { equals: 'cardiology' } },
      limit: 1,
    })
    const created = await create({
      collection: 'lectures',
      data: {
        title: 'Cache Agreement Lecture',
        domains: [domain.docs[0]?.id],
        body: rich('Body'),
        _status: 'published',
      },
    })
    expect(created.slug).toBe('cache-agreement-lecture')
    const invalidated = new Set(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag))

    cacheCalls.length = 0
    await getLecture('cache-agreement-lecture')
    await listLectures({ limit: 5 })
    await listLectures({ limit: 5, domain: 'cardiology' })

    expect(tagsOf('lectures:get')).toContain('lecture:cache-agreement-lecture')
    expect(tagsOf('lectures:list')).toContain('lectures')
    expect(tagsOf('lectures:list')).toContain('domain:cardiology')
    for (const tag of [
      'lecture:cache-agreement-lecture',
      'lectures',
      'content',
      'domain:cardiology',
    ]) {
      expect(invalidated.has(tag)).toBe(true)
      expect([...tagsOf('lectures:get'), ...tagsOf('lectures:list')]).toContain(tag)
    }
  })

  it('serves the new lecture to readers as soon as it is published', async () => {
    const list = LectureListResponseSchema.parse((await json('/api/v1/lectures')).body)
    expect(list.data.map((lecture) => lecture.slug)).toContain('cache-agreement-lecture')
  })
})
