/**
 * Phase 5 exit tests: the question bank and analytics endpoints against a real database, called
 * the way the mobile app calls them (Bearer tokens). Includes the required test that no GET
 * route ever leaks which answer is correct.
 */
import {
  AnalyticsResponseSchema,
  AnswerResponseSchema,
  NextQuestionResponseSchema,
  QuestionResponseSchema,
} from '@medipedia/shared'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as analyticsGET } from '@/app/api/v1/me/analytics/route'
import { GET as nextGET } from '@/app/api/v1/me/questions/next/route'
import { POST as answerPOST } from '@/app/api/v1/questions/[id]/answer/route'
import { GET as questionGET } from '@/app/api/v1/questions/[id]/route'
import { GET as statsGET } from '@/app/api/v1/questions/stats/route'
import type { Domain, Question, Topic } from '@/payload-types'
import { paragraphsToLexical } from '@/server/lexical'

import { creator, PASSWORD, startHarness, type Harness } from './harness'

const ORIGIN = 'http://localhost:3000'
const rich = (text: string) => paragraphsToLexical([text])
const quiet = { disableRevalidate: true }

let harness: Harness
let payload: Payload
let create: ReturnType<typeof creator>

let cardiology: Domain
let arrhythmias: Domain // a sub-domain of cardiology
let pharmacology: Domain
let acs: Topic
let afib: Topic
let kinetics: Topic

let acsQuestion: Question // correct: B
let afibQuestion: Question // correct: A
let kineticsQuestion: Question // correct: B
let draftQuestion: Question

type Tokens = { accessToken: string }
let ada: Tokens
let ben: Tokens
let admin: Tokens
let adaId: string

let counter = 0
const unique = (prefix: string) => `${prefix}-${++counter}`

const choice = (text: string, isCorrect: boolean) => ({
  text,
  isCorrect,
  explanation: rich(`Because ${text}`),
})

/** Choice A is right when `correct` is 'A', otherwise B. */
function questionData(topic: Topic, correct: 'A' | 'B', overrides: Record<string, unknown> = {}) {
  return {
    vignette: rich('A 58-year-old man with chest pain.'),
    stem: unique('Which one?'),
    choices: [choice('First option', correct === 'A'), choice('Second option', correct === 'B')],
    overallExplanation: rich('Overall explanation.'),
    citations: [{ label: 'Trial', url: 'https://example.com/trial' }],
    topic: topic.id,
    difficulty: 'medium' as const,
    accessTier: 'free' as const,
    _status: 'published' as const,
    ...overrides,
  }
}

const createQuestion = (topic: Topic, correct: 'A' | 'B', overrides = {}) =>
  create({ collection: 'questions', data: questionData(topic, correct, overrides), context: quiet })

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any

async function request<A extends unknown[]>(
  handler: (request: Request, ...args: A) => Promise<Response> | Response,
  method: string,
  path: string,
  options: {
    token?: Tokens
    body?: unknown
    headers?: Record<string, string>
    context?: A
  } = {},
) {
  const headers = new Headers(options.headers)
  if (options.token) headers.set('authorization', `Bearer ${options.token.accessToken}`)
  let body: string | undefined
  if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers.set('content-type', 'application/json')
  }
  const response = await handler(
    new Request(`${ORIGIN}${path}`, { method, headers, body }),
    ...((options.context ?? []) as A),
  )
  const text = await response.text()
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    text,
    json: (text ? JSON.parse(text) : null) as Json,
  }
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) })

const getQuestion = (id: string, token?: Tokens) =>
  request(questionGET, 'GET', `/api/v1/questions/${id}`, {
    ...(token ? { token } : {}),
    context: [idParams(id)],
  })

const nextQuestion = (query: string, token?: Tokens) =>
  request(nextGET, 'GET', `/api/v1/me/questions/next${query}`, token ? { token } : {})

const answer = (id: string, selectedLabel: unknown, token?: Tokens, headers = {}) =>
  request(answerPOST, 'POST', `/api/v1/questions/${id}/answer`, {
    body: { selectedLabel },
    headers,
    ...(token ? { token } : {}),
    context: [idParams(id)],
  })

const analytics = (token?: Tokens) =>
  request(analyticsGET, 'GET', '/api/v1/me/analytics', token ? { token } : {})

async function newLearner(name: string): Promise<{ tokens: Tokens; id: string }> {
  const address = `${name.toLowerCase()}-${++counter}@example.com`
  const user = await create({
    collection: 'users',
    data: { email: address, password: PASSWORD, name, _verified: true },
    disableVerificationEmail: true,
  })
  const login = await request(loginPOST, 'POST', '/api/v1/auth/login', {
    body: { email: address, password: PASSWORD, client: 'mobile' },
  })
  expect(login.status).toBe(200)
  return { tokens: login.json.data.tokens as Tokens, id: user.id }
}

async function events(userId: string) {
  const { docs } = await payload.find({
    collection: 'answer-events',
    where: { user: { equals: userId } },
    sort: 'answeredAt',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  return docs
}

beforeAll(async () => {
  harness = await startHarness()
  payload = harness.payload
  create = creator(payload)

  // The first account ever created becomes the admin.
  const adminUser = await create({
    collection: 'users',
    data: { email: 'admin@example.com', password: PASSWORD, name: 'Admin' },
  })
  expect(adminUser.role).toBe('admin')
  const adminLogin = await request(loginPOST, 'POST', '/api/v1/auth/login', {
    body: { email: 'admin@example.com', password: PASSWORD, client: 'mobile' },
  })
  admin = adminLogin.json.data.tokens as Tokens

  const a = await newLearner('Ada')
  ada = a.tokens
  adaId = a.id
  ben = (await newLearner('Ben')).tokens

  cardiology = await create({
    collection: 'domains',
    data: { name: 'Cardiology', order: 1 },
    context: quiet,
  })
  arrhythmias = await create({
    collection: 'domains',
    data: { name: 'Arrhythmias', order: 2, parent: cardiology.id },
    context: quiet,
  })
  pharmacology = await create({
    collection: 'domains',
    data: { name: 'Pharmacology', order: 3 },
    context: quiet,
  })
  const topic = (name: string, domain: Domain) =>
    create({ collection: 'topics', data: { name, domain: domain.id, order: 0 }, context: quiet })
  acs = await topic('Acute coronary syndrome', cardiology)
  afib = await topic('Atrial fibrillation', arrhythmias)
  kinetics = await topic('Pharmacokinetics', pharmacology)

  acsQuestion = await createQuestion(acs, 'B')
  afibQuestion = await createQuestion(afib, 'A')
  kineticsQuestion = await createQuestion(kinetics, 'B')
  draftQuestion = await create({
    collection: 'questions',
    data: { stem: 'Not published yet', topic: acs.id, _status: 'draft' },
    draft: true,
    context: quiet,
  })
})

afterAll(async () => {
  await harness?.stop()
})

// Keys that must never appear in a GET response: the answer key and everything that explains it.
const FORBIDDEN_KEYS = /"(isCorrect|explanation|overallExplanation|citations|correctLabel)"/

describe('GET routes never leak the answer key (Phase 5 exit test)', () => {
  const sweep = async (token: Tokens) => {
    const responses = [
      await getQuestion(acsQuestion.id, token),
      await getQuestion(afibQuestion.id, token),
      await nextQuestion('', token),
      await nextQuestion('?filter=all', token),
      await nextQuestion('?filter=incorrect', token),
      await nextQuestion('?domains=cardiology&topics=atrial-fibrillation&filter=all', token),
      await analytics(token),
      await request(statsGET, 'GET', '/api/v1/questions/stats'),
    ]
    for (const response of responses) {
      expect(response.status).toBe(200)
      expect(response.text).not.toMatch(FORBIDDEN_KEYS)
    }
    return responses
  }

  it('hides it from a learner, before and after they have answered', async () => {
    await sweep(ben)
    expect((await answer(acsQuestion.id, 'A', ben)).status).toBe(200)
    await sweep(ben)
  })

  it('hides it from an admin too: the GET shape is the same for everyone', async () => {
    await sweep(admin)
  })

  it('returns choices as label and text only', async () => {
    const { json } = await getQuestion(acsQuestion.id, ada)
    for (const row of json.data.choices) expect(Object.keys(row).sort()).toEqual(['label', 'text'])
  })
})

describe('authentication and caching', () => {
  it.each([
    ['GET /questions/:id', () => getQuestion(acsQuestion.id)],
    ['GET /me/questions/next', () => nextQuestion('')],
    ['POST /questions/:id/answer', () => answer(acsQuestion.id, 'A')],
    ['GET /me/analytics', () => analytics()],
  ])('%s needs a signed-in user', async (_name, call) => {
    const response = await call()
    expect(response.status).toBe(401)
    expect(response.json.error.code).toBe('unauthorized')
  })

  it('never lets a shared cache keep question or answer data', async () => {
    for (const response of [
      await getQuestion(acsQuestion.id, ada),
      await nextQuestion('?filter=all', ada),
      await answer(afibQuestion.id, 'A', await sibling()),
      await analytics(ada),
    ]) {
      expect(response.cacheControl).toBe('private, no-store')
    }
  })
})

/** A throwaway learner, so cache checks do not disturb the shared ones. */
async function sibling(): Promise<Tokens> {
  return (await newLearner('Temp')).tokens
}

describe('GET /questions/:id', () => {
  it('returns a question that matches the contract', async () => {
    const response = await getQuestion(acsQuestion.id, ada)
    const { data } = QuestionResponseSchema.parse(response.json)
    expect(data.id).toBe(acsQuestion.id)
    expect(data.choices.map((c) => c.label)).toEqual(['A', 'B'])
    expect(data.topic.slug).toBe('acute-coronary-syndrome')
    expect(data.domain.slug).toBe('cardiology')
    expect(data.vignette.html).toContain('chest pain')
  })

  it('answers 404, never 400, for a draft, an unknown id or a malformed one', async () => {
    for (const id of [
      draftQuestion.id,
      '00000000-0000-4000-8000-000000000000',
      'not-a-uuid',
      '1; DROP TABLE questions',
    ]) {
      expect((await getQuestion(id, ada)).status).toBe(404)
    }
  })
})

describe('GET /me/questions/next', () => {
  it('returns a valid question and how many match', async () => {
    const learner = (await newLearner('Nia')).tokens
    const { json } = await nextQuestion('?filter=all', learner)
    const { data } = NextQuestionResponseSchema.parse(json)
    expect(data.remaining).toBe(3)
    expect([acsQuestion.id, afibQuestion.id, kineticsQuestion.id]).toContain(data.question?.id)
  })

  it('never returns a draft', async () => {
    const learner = (await newLearner('Dee')).tokens
    for (let i = 0; i < 10; i++) {
      const { json } = await nextQuestion('?filter=all', learner)
      expect(json.data.question.id).not.toBe(draftQuestion.id)
    }
  })

  it('includes sub-domains when a domain is chosen', async () => {
    const learner = (await newLearner('Sub')).tokens
    const { json } = await nextQuestion('?domains=cardiology', learner)
    // The ACS question (cardiology) and the AF one (its sub-domain arrhythmias).
    expect(json.data.remaining).toBe(2)
    expect([acsQuestion.id, afibQuestion.id]).toContain(json.data.question.id)

    const narrow = await nextQuestion('?domains=arrhythmias', learner)
    expect(narrow.json.data.remaining).toBe(1)
    expect(narrow.json.data.question.id).toBe(afibQuestion.id)
  })

  it('filters by topic, and by domain and topic together', async () => {
    const learner = (await newLearner('Top')).tokens
    const byTopic = await nextQuestion('?topics=pharmacokinetics', learner)
    expect(byTopic.json.data.question.id).toBe(kineticsQuestion.id)

    const both = await nextQuestion('?domains=cardiology&topics=atrial-fibrillation', learner)
    expect(both.json.data.remaining).toBe(1)
    expect(both.json.data.question.id).toBe(afibQuestion.id)

    const disjoint = await nextQuestion('?domains=pharmacology&topics=atrial-fibrillation', learner)
    expect(disjoint.json.data).toEqual({ question: null, remaining: 0 })
  })

  it('matches nothing, not everything, for slugs that do not exist', async () => {
    const learner = (await newLearner('Ghost')).tokens
    for (const query of ['?domains=no-such-domain', '?topics=no-such-topic']) {
      expect((await nextQuestion(query, learner)).json.data).toEqual({
        question: null,
        remaining: 0,
      })
    }
  })

  it('rejects a malformed filter with 400', async () => {
    const learner = (await newLearner('Bad')).tokens
    for (const query of ['?filter=bogus', '?domains=Not A Slug', '?topics=ok,BAD!']) {
      const response = await nextQuestion(query, learner)
      expect(response.status).toBe(400)
      expect(response.json.error.code).toBe('validation_error')
    }
  })

  it('"unused" skips what the learner answered, and only theirs', async () => {
    const learner = (await newLearner('Una')).tokens
    const other = (await newLearner('Otto')).tokens
    expect((await answer(acsQuestion.id, 'B', learner)).status).toBe(200)
    expect((await answer(afibQuestion.id, 'A', other)).status).toBe(200)

    const mine = await nextQuestion('?filter=unused', learner)
    expect(mine.json.data.remaining).toBe(2)
    expect([afibQuestion.id, kineticsQuestion.id]).toContain(mine.json.data.question.id)

    // The default filter is "unused".
    expect((await nextQuestion('', learner)).json.data.remaining).toBe(2)
    // Otto answered a different question, so his pool is different.
    const theirs = await nextQuestion('?filter=unused', other)
    expect([acsQuestion.id, kineticsQuestion.id]).toContain(theirs.json.data.question.id)
  })

  it('runs out: null question once everything is answered', async () => {
    const learner = (await newLearner('Done')).tokens
    for (const q of [acsQuestion, afibQuestion, kineticsQuestion]) {
      await answer(q.id, 'A', learner)
    }
    expect((await nextQuestion('?filter=unused', learner)).json.data).toEqual({
      question: null,
      remaining: 0,
    })
    expect((await nextQuestion('?filter=all', learner)).json.data.remaining).toBe(3)
  })

  it('"incorrect" follows the latest answer to each question', async () => {
    const learner = (await newLearner('Redo')).tokens
    await answer(acsQuestion.id, 'A', learner) // wrong (B is correct)
    await answer(afibQuestion.id, 'A', learner) // right

    const wrong = await nextQuestion('?filter=incorrect', learner)
    expect(wrong.json.data.remaining).toBe(1)
    expect(wrong.json.data.question.id).toBe(acsQuestion.id)

    await answer(acsQuestion.id, 'B', learner) // now right
    expect((await nextQuestion('?filter=incorrect', learner)).json.data).toEqual({
      question: null,
      remaining: 0,
    })
  })
})

describe('POST /questions/:id/answer', () => {
  it('returns the verdict and every explanation', async () => {
    const learner = (await newLearner('Val')).tokens
    const wrong = AnswerResponseSchema.parse((await answer(acsQuestion.id, 'A', learner)).json).data
    expect(wrong).toMatchObject({
      questionId: acsQuestion.id,
      selectedLabel: 'A',
      correctLabel: 'B',
      isCorrect: false,
      isFirstAttempt: true,
    })
    expect(wrong.choices.map((c) => [c.label, c.isCorrect])).toEqual([
      ['A', false],
      ['B', true],
    ])
    expect(wrong.choices[0]?.explanation.html).toContain('Because First option')
    expect(wrong.overallExplanation.html).toContain('Overall explanation')
    expect(wrong.citations).toEqual([{ label: 'Trial', url: 'https://example.com/trial' }])

    const right = AnswerResponseSchema.parse((await answer(afibQuestion.id, 'A', learner)).json)
    expect(right.data.isCorrect).toBe(true)
    expect(right.data.correctLabel).toBe('A')
  })

  it('records the answer with the question domain and topic', async () => {
    const learner = await newLearner('Rec')
    await answer(afibQuestion.id, 'B', learner.tokens)
    const [row, ...rest] = await events(learner.id)
    expect(rest).toHaveLength(0)
    expect(row).toMatchObject({
      selectedLabel: 'B',
      isCorrect: false,
      isFirstAttempt: true,
    })
    expect([row?.question, row?.domain, row?.topic]).toEqual([
      afibQuestion.id,
      arrhythmias.id,
      afib.id,
    ])
  })

  it('marks only the first answer to a question as the first attempt', async () => {
    const learner = await newLearner('Rep')
    const first = await answer(acsQuestion.id, 'A', learner.tokens)
    const second = await answer(acsQuestion.id, 'B', learner.tokens)
    const third = await answer(acsQuestion.id, 'B', learner.tokens)
    expect([first, second, third].map((r) => r.json.data.isFirstAttempt)).toEqual([
      true,
      false,
      false,
    ])
    expect((await events(learner.id)).map((e) => e.isFirstAttempt)).toEqual([true, false, false])
    // The same question for a different learner is their own first attempt.
    expect((await answer(acsQuestion.id, 'A', ben)).json.data.isFirstAttempt).toBeDefined()
  })

  it('counts one first attempt when submissions race', async () => {
    const learner = await newLearner('Race')
    const responses = await Promise.all(
      [1, 2, 3, 4].map(() => answer(kineticsQuestion.id, 'B', learner.tokens)),
    )
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200])
    const rows = await events(learner.id)
    expect(rows).toHaveLength(4)
    expect(rows.filter((row) => row.isFirstAttempt)).toHaveLength(1)
    expect(responses.filter((r) => r.json.data.isFirstAttempt)).toHaveLength(1)
  })

  it('rejects a label the question does not have', async () => {
    const learner = await newLearner('Lab')
    for (const label of ['E', 'F']) {
      const response = await answer(acsQuestion.id, label, learner.tokens)
      expect(response.status).toBe(400)
      expect(response.json.error.code).toBe('validation_error')
    }
    for (const label of ['G', 'a', '', 1, null]) {
      expect((await answer(acsQuestion.id, label, learner.tokens)).status).toBe(400)
    }
    expect(await events(learner.id)).toHaveLength(0)
  })

  it('answers 404 for a draft, an unknown id or a malformed one', async () => {
    for (const id of [draftQuestion.id, '00000000-0000-4000-8000-000000000000', 'nope']) {
      expect((await answer(id, 'A', ben)).status).toBe(404)
    }
  })

  it('refuses a cross-site request and a body that is not JSON', async () => {
    const learner = await newLearner('Csrf')
    expect(
      (await answer(acsQuestion.id, 'A', learner.tokens, { 'sec-fetch-site': 'cross-site' }))
        .status,
    ).toBe(403)
    expect(
      (await answer(acsQuestion.id, 'A', learner.tokens, { origin: 'https://evil.example' }))
        .status,
    ).toBe(403)

    const response = await answerPOST(
      new Request(`${ORIGIN}/api/v1/questions/${acsQuestion.id}/answer`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${learner.tokens.accessToken}`,
          'content-type': 'text/plain',
        },
        body: JSON.stringify({ selectedLabel: 'A' }),
      }),
      idParams(acsQuestion.id),
    )
    expect(response.status).toBe(400)
    expect(await events(learner.id)).toHaveLength(0)
  })
})

describe('GET /me/analytics', () => {
  it('starts empty', async () => {
    const learner = (await newLearner('Zed')).tokens
    const { data } = AnalyticsResponseSchema.parse((await analytics(learner)).json)
    expect(data).toEqual({
      totals: { attempts: 0, answered: 0, correct: 0, accuracy: null },
      byDomain: [],
      weakest: [],
    })
  })

  it('counts first attempts only, and rolls sub-domains into their top-level domain', async () => {
    const learner = (await newLearner('Stat')).tokens
    await answer(acsQuestion.id, 'A', learner) // cardiology, wrong
    await answer(acsQuestion.id, 'B', learner) // a retry: right, but not a first attempt
    await answer(afibQuestion.id, 'A', learner) // arrhythmias -> cardiology, right
    await answer(kineticsQuestion.id, 'A', learner) // pharmacology, wrong

    const { data } = AnalyticsResponseSchema.parse((await analytics(learner)).json)
    expect(data.totals).toEqual({ attempts: 4, answered: 3, correct: 1, accuracy: 1 / 3 })
    expect(data.byDomain.map((d) => [d.slug, d.answered, d.correct, d.accuracy])).toEqual([
      ['cardiology', 2, 1, 0.5],
      ['pharmacology', 1, 0, 0],
    ])
    // The sub-domain is never listed on its own.
    expect(data.byDomain.map((d) => d.slug)).not.toContain('arrhythmias')
  })

  it('ranks the weakest domains, and only those with at least 10 first attempts', async () => {
    // Ten more pharmacology questions, so one domain can reach the minimum.
    const extra: Question[] = []
    for (let i = 0; i < 9; i++) extra.push(await createQuestion(kinetics, 'B'))

    const learner = (await newLearner('Weak')).tokens
    for (const q of [kineticsQuestion, ...extra]) await answer(q.id, 'A', learner) // 10 wrong
    await answer(acsQuestion.id, 'A', learner) // cardiology: 1 answer, too few to rank
    await answer(afibQuestion.id, 'B', learner)

    const { data } = AnalyticsResponseSchema.parse((await analytics(learner)).json)
    expect(data.totals.answered).toBe(12)
    expect(data.weakest.map((d) => d.slug)).toEqual(['pharmacology'])
    expect(data.weakest[0]).toMatchObject({ answered: 10, correct: 0, accuracy: 0 })
  })

  it("never includes another learner's answers", async () => {
    const mine = await newLearner('Mine')
    const theirs = await newLearner('Theirs')
    await answer(acsQuestion.id, 'B', theirs.tokens)
    expect((await analytics(mine.tokens)).json.data.totals.attempts).toBe(0)
    expect((await analytics(theirs.tokens)).json.data.totals.attempts).toBe(1)
  })

  it('is deleted with the account', async () => {
    const learner = await newLearner('Gone')
    await answer(acsQuestion.id, 'B', learner.tokens)
    expect(await events(learner.id)).toHaveLength(1)
    await payload.delete({ collection: 'users', id: learner.id, overrideAccess: true })
    expect(await events(learner.id)).toHaveLength(0)
  })
})

describe('answer rows cannot be forged through Payload', () => {
  it('has no public write access and hides the first-attempt key', async () => {
    await expect(
      payload.create({
        collection: 'answer-events',
        data: {
          user: adaId,
          question: acsQuestion.id,
          selectedLabel: 'B',
          isCorrect: true,
          isFirstAttempt: true,
          answeredAt: new Date().toISOString(),
        },
        overrideAccess: false,
        user: { id: adaId, collection: 'users', role: 'learner' },
      }),
    ).rejects.toThrow()

    const { docs } = await payload.find({
      collection: 'answer-events',
      overrideAccess: false,
      user: { id: adaId, collection: 'users', role: 'learner' },
    })
    for (const doc of docs) expect(doc).not.toHaveProperty('firstAttemptKey')
  })
})
