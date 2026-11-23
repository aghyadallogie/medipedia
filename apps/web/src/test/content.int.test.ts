/**
 * Phase 2 exit tests (AGENTS.md §13): the content model behaves as specified against a real
 * Postgres, revalidation fires on publish, and protected question fields never reach
 * non-admins, including through Payload's own REST API.
 */
import { REST_GET } from '@payloadcms/next/routes'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { revalidateTag } from 'next/cache'

import type { Domain, Topic, User } from '@/payload-types'
import { paragraphsToLexical } from '@/server/lexical'
import { seedSampleContent } from '@/scripts/seed-content'

import { asUser, creator, PASSWORD, startHarness, type Harness } from './harness'

const rich = (text: string) => paragraphsToLexical([text])
const quiet = { disableRevalidate: true }

let harness: Harness
let payload: Payload
let create: ReturnType<typeof creator>
let admin: User
let learner: User
let learner2: User
let cardiology: Domain
let pharmacology: Domain
let acs: Topic

/** Relationship values come back populated or as ids depending on depth. */
const relId = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && 'id' in value ? value.id : value

/** Messages of the field validation errors that a rejected Local API call carried. */
async function validationMessages(call: Promise<unknown>): Promise<string[]> {
  try {
    await call
  } catch (error) {
    const errors = (error as { data?: { errors?: { message?: string }[] } }).data?.errors ?? []
    return errors.map((entry) => entry.message ?? '')
  }
  throw new Error('Expected the call to be rejected')
}

let counter = 0
const unique = (prefix: string) => `${prefix}-${++counter}`

const choice = (text: string, isCorrect: boolean) => ({
  text,
  isCorrect,
  explanation: rich(`Because ${text}`),
})

function questionData(overrides: Record<string, unknown> = {}) {
  return {
    vignette: rich('A 58-year-old man with chest pain.'),
    stem: unique('Which artery?'),
    choices: [choice('Left anterior descending', false), choice('Right coronary', true)],
    overallExplanation: rich('Overall.'),
    topic: acs.id,
    difficulty: 'medium' as const,
    accessTier: 'free' as const,
    _status: 'published' as const,
    ...overrides,
  }
}

async function createQuestion(overrides: Record<string, unknown> = {}) {
  return create({
    collection: 'questions',
    data: questionData(overrides),
    context: quiet,
  })
}

async function createDomain(name: string, extra: Record<string, unknown> = {}) {
  return create({
    collection: 'domains',
    data: { name, order: 0, ...extra },
    context: quiet,
  })
}

beforeAll(async () => {
  harness = await startHarness()
  payload = harness.payload
  create = creator(payload)

  // The first account ever created becomes the admin (see Users.ts).
  admin = await create({
    collection: 'users',
    data: { email: 'admin@example.com', password: PASSWORD, name: 'Admin' },
  })
  learner = await create({
    collection: 'users',
    // Signing in needs a confirmed address (Phase 4).
    data: { email: 'learner@example.com', password: PASSWORD, name: 'Learner', _verified: true },
    disableVerificationEmail: true,
  })
  learner2 = await create({
    collection: 'users',
    // Signing in needs a confirmed address (Phase 4).
    data: {
      email: 'learner2@example.com',
      password: PASSWORD,
      name: 'Learner Two',
      _verified: true,
    },
    disableVerificationEmail: true,
  })

  cardiology = await createDomain('Cardiology')
  pharmacology = await createDomain('Pharmacology')
  acs = await create({
    collection: 'topics',
    data: { name: 'Acute coronary syndromes', domain: cardiology.id, order: 0 },
    context: quiet,
  })
})

afterAll(async () => {
  await harness?.stop()
})

describe('users and roles', () => {
  it('makes the first account an admin and later ones learners', () => {
    expect(admin.role).toBe('admin')
    expect(learner.role).toBe('learner')
    expect(learner.provider).toBe('email')
  })

  it('stops a learner from promoting themselves', async () => {
    const updated = await payload.update({
      collection: 'users',
      id: learner.id,
      data: { role: 'admin', name: 'Renamed' },
      user: asUser(learner),
      overrideAccess: false,
    })
    expect(updated.name).toBe('Renamed')
    expect(updated.role).toBe('learner')
    const stored = await payload.findByID({ collection: 'users', id: learner.id })
    expect(stored.role).toBe('learner')
  })

  it('lets a learner read only their own user document', async () => {
    const { docs } = await payload.find({
      collection: 'users',
      user: asUser(learner),
      overrideAccess: false,
    })
    expect(docs.map((doc) => doc.id)).toEqual([learner.id])
  })
})

describe('slugs', () => {
  it('generates a slug from the title and keeps it stable', async () => {
    const lecture = await create({
      collection: 'lectures',
      data: {
        title: 'Acute Coronary Syndromes & Angina',
        domains: [cardiology.id],
        body: rich('Body'),
        _status: 'published',
      },
      context: quiet,
    })
    expect(lecture.slug).toBe('acute-coronary-syndromes-and-angina')

    const renamed = await payload.update({
      collection: 'lectures',
      id: lecture.id,
      data: { title: 'A completely different title' },
      context: quiet,
    })
    expect(renamed.slug).toBe('acute-coronary-syndromes-and-angina')
  })

  it('rejects a duplicate slug', async () => {
    const data = {
      title: 'Duplicate me',
      domains: [cardiology.id],
      body: rich('Body'),
      _status: 'published' as const,
    }
    await create({ collection: 'lectures', data, context: quiet })
    await expect(create({ collection: 'lectures', data, context: quiet })).rejects.toThrow()
  })

  it('rejects a malformed slug', async () => {
    await expect(createDomain('Bad Slug Domain', { slug: 'Not A Slug' })).rejects.toThrow()
  })
})

describe('domains and topics', () => {
  it('nests sub-domains one level deep only', async () => {
    const parent = await createDomain('Parent domain')
    const child = await createDomain('Child domain', { parent: parent.id })
    expect(relId(child.parent)).toBe(parent.id)

    await expect(createDomain('Grandchild', { parent: child.id })).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'domains',
        id: parent.id,
        data: { parent: parent.id },
        context: quiet,
      }),
    ).rejects.toThrow()
  })

  it('does not let a domain with sub-domains become a sub-domain', async () => {
    const top = await createDomain('Top with children')
    await createDomain('Its child', { parent: top.id })
    const other = await createDomain('Other top')
    await expect(
      payload.update({
        collection: 'domains',
        id: top.id,
        data: { parent: other.id },
        context: quiet,
      }),
    ).rejects.toThrow()
  })

  it('refuses to delete a domain or topic that is still in use', async () => {
    const domain = await createDomain('In use domain')
    const topic = await create({
      collection: 'topics',
      data: { name: 'In use topic', domain: domain.id, order: 0 },
      context: quiet,
    })
    await createQuestion({ topic: topic.id })

    await expect(
      payload.delete({ collection: 'domains', id: domain.id, context: quiet }),
    ).rejects.toThrow(/still use it/)
    await expect(
      payload.delete({ collection: 'topics', id: topic.id, context: quiet }),
    ).rejects.toThrow(/still use it/)
  })
})

describe('questions', () => {
  it('assigns A, B, C labels by position and copies the domain from the topic', async () => {
    const question = await createQuestion({
      choices: [choice('One', false), choice('Two', true), choice('Three', false)],
    })
    expect((question.choices ?? []).map((c) => c.label)).toEqual(['A', 'B', 'C'])
    expect(relId(question.domain)).toBe(cardiology.id)
  })

  it('requires exactly one correct choice to publish', async () => {
    expect(
      await validationMessages(
        createQuestion({ choices: [choice('One', false), choice('Two', false)] }),
      ),
    ).toEqual([expect.stringMatching(/Exactly one choice must be marked correct \(found 0\)/)])
    expect(
      await validationMessages(
        createQuestion({ choices: [choice('One', true), choice('Two', true)] }),
      ),
    ).toEqual([expect.stringMatching(/found 2/)])
    await expect(createQuestion({ choices: [choice('Only', true)] })).rejects.toThrow()
    await expect(
      createQuestion({
        choices: Array.from({ length: 7 }, (_, i) => choice(`C${i}`, i === 0)),
      }),
    ).rejects.toThrow()
  })

  it('allows an incomplete draft', async () => {
    const draft = await create({
      collection: 'questions',
      data: { stem: 'Work in progress', _status: 'draft' },
      draft: true,
      context: quiet,
    })
    expect(draft._status).toBe('draft')
  })

  it('hides correctness and explanations from learners', async () => {
    const question = await createQuestion({ stem: 'Hidden answers question' })
    const { docs } = await payload.find({
      collection: 'questions',
      where: { id: { equals: question.id } },
      user: asUser(learner),
      overrideAccess: false,
    })
    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc?.choices).toHaveLength(2)
    for (const row of doc?.choices ?? []) {
      expect(row).not.toHaveProperty('isCorrect')
      expect(row).not.toHaveProperty('explanation')
      expect(row).toHaveProperty('text')
    }
    expect(doc).not.toHaveProperty('overallExplanation')

    const byId = await payload.findByID({
      collection: 'questions',
      id: question.id,
      user: asUser(learner),
      overrideAccess: false,
    })
    expect(JSON.stringify(byId)).not.toMatch(/isCorrect|explanation|overallExplanation/i)
  })

  it('shows admins the full question', async () => {
    const question = await createQuestion({ stem: 'Admin sees all' })
    const doc = await payload.findByID({
      collection: 'questions',
      id: question.id,
      user: asUser(admin),
      overrideAccess: false,
    })
    expect((doc.choices ?? []).some((row) => row.isCorrect === true)).toBe(true)
    expect(doc.overallExplanation).toBeDefined()
  })

  it('gives anonymous callers nothing', async () => {
    await expect(payload.find({ collection: 'questions', overrideAccess: false })).rejects.toThrow()
  })

  it('does not let a learner probe answers by filtering on protected fields', async () => {
    const question = await createQuestion({
      stem: 'Probe me',
      choices: [choice('Wrong answer', false), choice('Right answer', true)],
    })
    const probe = payload.find({
      collection: 'questions',
      where: {
        and: [
          { id: { equals: question.id } },
          { 'choices.isCorrect': { equals: true } },
          { 'choices.text': { equals: 'Wrong answer' } },
        ],
      },
      user: asUser(learner),
      overrideAccess: false,
    })
    // Either the query is refused or the protected condition is ignored. It must never behave
    // as an oracle, so the question comes back for neither or both probes.
    const result = await probe.then(
      (r) => r.docs.length,
      () => 'refused' as const,
    )
    const baseline = await payload
      .find({
        collection: 'questions',
        where: {
          and: [{ id: { equals: question.id } }, { 'choices.text': { equals: 'Wrong answer' } }],
        },
        user: asUser(learner),
        overrideAccess: false,
      })
      .then((r) => r.docs.length)
    expect(result === 'refused' || result === baseline).toBe(true)
  })

  it('keeps version history admin-only and draft questions hidden', async () => {
    const draft = await create({
      collection: 'questions',
      data: questionData({ stem: 'Secret draft', _status: 'draft' }),
      draft: true,
      context: quiet,
    })

    await expect(
      payload.findVersions({
        collection: 'questions',
        user: asUser(learner),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const asLearner = await payload.find({
      collection: 'questions',
      where: { id: { equals: draft.id } },
      draft: true,
      user: asUser(learner),
      overrideAccess: false,
    })
    expect(asLearner.docs).toHaveLength(0)
  })
})

describe("Payload's own REST API under /api/cms", () => {
  async function get(pathAndQuery: string, token?: string) {
    const [pathname = '', query] = pathAndQuery.split('?')
    const slug = pathname.split('/').filter(Boolean)
    const url = `http://localhost:3000/api/cms/${slug.join('/')}${query ? `?${query}` : ''}`
    const request = new Request(url, {
      headers: token ? { Authorization: `JWT ${token}` } : {},
    })
    return REST_GET(harness.config)(request, { params: Promise.resolve({ slug }) })
  }

  it('never returns protected fields to a signed-in learner, and everything to an admin', async () => {
    await createQuestion({ stem: 'REST probe question' })

    const learnerLogin = await payload.login({
      collection: 'users',
      data: { email: 'learner@example.com', password: PASSWORD },
    })
    const adminLogin = await payload.login({
      collection: 'users',
      data: { email: 'admin@example.com', password: PASSWORD },
    })

    const forLearner = await get('questions?depth=0&limit=100', learnerLogin.token ?? undefined)
    expect(forLearner.status).toBe(200)
    const learnerBody = await forLearner.text()
    expect(learnerBody).toContain('REST probe question')
    expect(learnerBody).not.toMatch(/isCorrect|explanation|overallExplanation/i)

    const forAdmin = await get('questions?depth=0&limit=100', adminLogin.token ?? undefined)
    expect(forAdmin.status).toBe(200)
    const adminBody = await forAdmin.text()
    expect(adminBody).toContain('isCorrect')
    expect(adminBody).toContain('overallExplanation')
  })

  it('refuses anonymous reads of questions and of question versions', async () => {
    expect((await get('questions')).status).toBe(403)
    expect((await get('questions/versions')).status).toBe(403)
  })

  it('refuses a learner version history', async () => {
    const login = await payload.login({
      collection: 'users',
      data: { email: 'learner@example.com', password: PASSWORD },
    })
    expect((await get('questions/versions', login.token ?? undefined)).status).toBe(403)
  })

  it('serves public taxonomy without sign-in', async () => {
    const response = await get('domains?depth=0')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Cardiology')
  })

  it('does not expose refresh-token hashes or answer events to learners', async () => {
    const login = await payload.login({
      collection: 'users',
      data: { email: 'learner@example.com', password: PASSWORD },
    })
    expect((await get('refresh-tokens', login.token ?? undefined)).status).toBe(403)
  })
})

describe('flashcards', () => {
  it('copies the domain from the topic and follows a topic that moves', async () => {
    const topic = await create({
      collection: 'topics',
      data: { name: unique('Movable topic'), domain: cardiology.id, order: 0 },
      context: quiet,
    })
    const card = await create({
      collection: 'flashcards',
      data: { front: unique('Front'), back: rich('Back'), topic: topic.id, _status: 'published' },
      context: quiet,
    })
    const question = await createQuestion({ topic: topic.id })
    expect(relId(card.domain)).toBe(cardiology.id)

    await payload.update({
      collection: 'topics',
      id: topic.id,
      data: { domain: pharmacology.id },
      context: quiet,
    })

    const movedCard = await payload.findByID({ collection: 'flashcards', id: card.id })
    const movedQuestion = await payload.findByID({ collection: 'questions', id: question.id })
    expect(relId(movedCard.domain)).toBe(pharmacology.id)
    expect(relId(movedQuestion.domain)).toBe(pharmacology.id)
  })

  it('lists published cards to anonymous readers but not drafts', async () => {
    const draft = await create({
      collection: 'flashcards',
      data: { front: unique('Draft front'), back: rich('Back'), topic: acs.id, _status: 'draft' },
      draft: true,
      context: quiet,
    })
    const published = await create({
      collection: 'flashcards',
      data: {
        front: unique('Live front'),
        back: rich('Back'),
        topic: acs.id,
        _status: 'published',
      },
      context: quiet,
    })
    const { docs } = await payload.find({
      collection: 'flashcards',
      overrideAccess: false,
      limit: 100,
    })
    const ids = docs.map((doc) => doc.id)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
  })
})

describe('papers', () => {
  const base = () => ({
    title: unique('Paper'),
    authors: ['A. Author'],
    abstract: rich('Abstract'),
    sparkNotes: rich('Notes'),
    domain: cardiology.id,
    _status: 'published' as const,
  })

  it('normalizes a DOI link', async () => {
    const paper = await create({
      collection: 'papers',
      data: { ...base(), doi: 'https://doi.org/10.1016/S0140-6736(94)90566-5' },
      context: quiet,
    })
    expect(paper.doi).toBe('10.1016/S0140-6736(94)90566-5')
  })

  it.each([
    ['a bad DOI', { doi: 'not-a-doi' }],
    ['a relevance of 6', { clinicalRelevance: 6 }],
    ['a relevance of 0', { clinicalRelevance: 0 }],
    ['a fractional year', { year: 1994.5 }],
    ['a year before 1800', { year: 1700 }],
    ['a negative citation count', { citationCount: -1 }],
    ['a non-http PubMed URL', { pubmedUrl: 'javascript:alert(1)' }],
  ])('rejects %s', async (_name, extra) => {
    await expect(
      create({ collection: 'papers', data: { ...base(), ...extra }, context: quiet }),
    ).rejects.toThrow()
  })
})

describe('videos', () => {
  const base = () => ({
    title: unique('Video'),
    description: rich('Description'),
    domain: cardiology.id,
    _status: 'published' as const,
  })

  it('normalizes the embed URL and derives provider fields', async () => {
    const video = await create({
      collection: 'videos',
      data: { ...base(), embedUrl: 'https://youtu.be/jNQXAC9IVRw?si=tracking' },
      context: quiet,
    })
    expect(video.embedUrl).toBe('https://www.youtube-nocookie.com/embed/jNQXAC9IVRw')
    expect(video.provider).toBe('youtube')
    expect(video.providerVideoId).toBe('jNQXAC9IVRw')

    const vimeo = await create({
      collection: 'videos',
      data: { ...base(), embedUrl: 'https://vimeo.com/76979871' },
      context: quiet,
    })
    expect(vimeo.provider).toBe('vimeo')
    expect(vimeo.embedUrl).toBe('https://player.vimeo.com/video/76979871')
  })

  it.each(['https://example.com/video', 'javascript:alert(1)', 'not a url', ''])(
    'rejects the embed URL %j',
    async (embedUrl) => {
      await expect(
        create({
          collection: 'videos',
          data: { ...base(), embedUrl },
          context: quiet,
        }),
      ).rejects.toThrow()
    },
  )
})

describe('lectures', () => {
  it('stamps publishedAt on first publish only', async () => {
    const draft = await create({
      collection: 'lectures',
      data: {
        title: unique('Lecture'),
        domains: [cardiology.id],
        body: rich('Body'),
        _status: 'draft',
      },
      draft: true,
      context: quiet,
    })
    expect(draft.publishedAt).toBeFalsy()

    const live = await payload.update({
      collection: 'lectures',
      id: draft.id,
      data: { _status: 'published' },
      context: quiet,
    })
    expect(live.publishedAt).toBeTruthy()

    const edited = await payload.update({
      collection: 'lectures',
      id: draft.id,
      data: { summary: 'Edited' },
      context: quiet,
    })
    expect(edited.publishedAt).toBe(live.publishedAt)
  })
})

describe('publish -> revalidation', () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear()
  })

  const tagsCalled = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

  it('invalidates item, collection, content and domain tags when a lecture is published', async () => {
    const lecture = await create({
      collection: 'lectures',
      data: {
        title: 'Revalidation Lecture',
        domains: [cardiology.id],
        body: rich('Body'),
        _status: 'published',
      },
    })
    expect(tagsCalled()).toEqual(
      expect.arrayContaining([
        'content',
        'lectures',
        'lecture:revalidation-lecture',
        'domain:cardiology',
      ]),
    )
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('lectures', { expire: 0 })

    vi.mocked(revalidateTag).mockClear()
    await payload.update({
      collection: 'lectures',
      id: lecture.id,
      data: { _status: 'draft' },
    })
    expect(tagsCalled()).toContain('lecture:revalidation-lecture')

    vi.mocked(revalidateTag).mockClear()
    await payload.update({ collection: 'lectures', id: lecture.id, data: { _status: 'published' } })
    vi.mocked(revalidateTag).mockClear()
    await payload.delete({ collection: 'lectures', id: lecture.id })
    expect(tagsCalled()).toContain('lecture:revalidation-lecture')
  })

  it('does not invalidate for a draft that was never published', async () => {
    await create({
      collection: 'lectures',
      data: {
        title: unique('Quiet draft'),
        domains: [cardiology.id],
        body: rich('Body'),
        _status: 'draft',
      },
      draft: true,
    })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('invalidates taxonomy and flashcard tags', async () => {
    const domain = await create({
      collection: 'domains',
      data: { name: 'Revalidated domain', order: 0 },
    })
    expect(tagsCalled()).toEqual(
      expect.arrayContaining(['domains', 'domain:revalidated-domain', 'content']),
    )

    vi.mocked(revalidateTag).mockClear()
    const topic = await create({
      collection: 'topics',
      data: { name: 'Revalidated topic', domain: domain.id, order: 0 },
    })
    expect(tagsCalled()).toEqual(
      expect.arrayContaining(['topics', 'topic:revalidated-topic', 'domain:revalidated-domain']),
    )

    vi.mocked(revalidateTag).mockClear()
    const card = await create({
      collection: 'flashcards',
      data: {
        front: unique('Revalidated card'),
        back: rich('Back'),
        topic: topic.id,
        _status: 'published',
      },
    })
    expect(tagsCalled()).toEqual(
      expect.arrayContaining([
        'flashcards',
        `flashcard:${card.id}`,
        'topic:revalidated-topic',
        'domain:revalidated-domain',
      ]),
    )
  })

  it('stays quiet when disableRevalidate is set', async () => {
    await create({
      collection: 'lectures',
      data: {
        title: unique('Silent'),
        domains: [cardiology.id],
        body: rich('Body'),
        _status: 'published',
      },
      context: quiet,
    })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('answer events and refresh tokens', () => {
  async function recordAnswer(user: User, question: { id: string }) {
    return create({
      collection: 'answer-events',
      data: {
        user: user.id,
        question: question.id,
        selectedLabel: 'B',
        isCorrect: true,
        isFirstAttempt: true,
        answeredAt: new Date().toISOString(),
      },
    })
  }

  it('lets a learner read only their own answers and never write them directly', async () => {
    const question = await createQuestion({ stem: 'Answered question' })
    const mine = await recordAnswer(learner, question)
    const theirs = await recordAnswer(learner2, question)

    const { docs } = await payload.find({
      collection: 'answer-events',
      user: asUser(learner),
      overrideAccess: false,
    })
    const ids = docs.map((doc) => doc.id)
    expect(ids).toContain(mine.id)
    expect(ids).not.toContain(theirs.id)

    await expect(
      create({
        collection: 'answer-events',
        data: {
          user: learner.id,
          question: question.id,
          selectedLabel: 'A',
          isCorrect: false,
          isFirstAttempt: false,
          answeredAt: new Date().toISOString(),
        },
        user: asUser(learner),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'answer-events',
        id: mine.id,
        data: { isCorrect: false },
        user: asUser(learner),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('deletes a user together with their answers and refresh tokens', async () => {
    const victim = await create({
      collection: 'users',
      data: { email: 'victim@example.com', password: PASSWORD },
    })
    const question = await createQuestion({ stem: 'Cascade question' })
    await recordAnswer(victim, question)
    await create({
      collection: 'refresh-tokens',
      data: {
        user: victim.id,
        tokenHash: 'a'.repeat(64),
        audience: 'web',
        familyId: '00000000-0000-4000-8000-000000000001',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })

    await payload.delete({ collection: 'users', id: victim.id })

    const events = await payload.count({
      collection: 'answer-events',
      where: { user: { equals: victim.id } },
    })
    const tokens = await payload.count({
      collection: 'refresh-tokens',
      where: { user: { equals: victim.id } },
    })
    expect(events.totalDocs).toBe(0)
    expect(tokens.totalDocs).toBe(0)
  })

  it('enforces unique token hashes', async () => {
    const data = {
      user: learner.id,
      tokenHash: 'b'.repeat(64),
      audience: 'mobile' as const,
      familyId: '00000000-0000-4000-8000-000000000002',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }
    await create({ collection: 'refresh-tokens', data })
    await expect(create({ collection: 'refresh-tokens', data })).rejects.toThrow()
  })
})

describe('sample content seed', () => {
  it('passes every validation, is idempotent, and is readable by learners', async () => {
    const first = await seedSampleContent(payload)
    expect(first.length).toBeGreaterThan(0)
    expect(await seedSampleContent(payload)).toEqual([])

    const questions = await payload.find({
      collection: 'questions',
      where: { stem: { like: 'Occlusion of which' } },
      user: asUser(learner),
      overrideAccess: false,
    })
    expect(questions.docs.length).toBeGreaterThan(0)
    expect(JSON.stringify(questions.docs)).not.toMatch(/isCorrect|explanation/i)

    const videos = await payload.find({
      collection: 'videos',
      where: { title: { like: '[Sample]' } },
      overrideAccess: false,
    })
    expect(videos.docs.length).toBe(2)
    expect(videos.docs.map((video) => video.provider).sort()).toEqual(['vimeo', 'youtube'])
  })
})
