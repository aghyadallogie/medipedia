import { describe, expect, it, vi } from 'vitest'

import { ApiClientError, createApiClient } from '../index'

const id = '00000000-0000-4000-8000-000000000003'
const ref = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  name: `Name ${n}`,
  slug: `name-${n}`,
})
const QUESTION = {
  id,
  vignette: { html: '<p>Vignette</p>' },
  stem: 'Which one?',
  choices: [
    { label: 'A', text: 'First' },
    { label: 'B', text: 'Second' },
  ],
  topic: ref(1),
  domain: ref(2),
  difficulty: 'medium',
  accessTier: 'free',
  updatedAt: '2026-11-22T12:00:00.000Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function clientWith(respond: (url: URL, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(new URL(String(input)), init ?? {}),
  )
  return { api: createApiClient({ baseUrl: 'https://example.test', fetch: fetchMock }), fetchMock }
}

describe('questions', () => {
  it('gets one question', async () => {
    const { api, fetchMock } = clientWith(() => json({ data: QUESTION }))
    expect((await api.questions.get(id)).choices).toHaveLength(2)
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(`/api/v1/questions/${id}`)
  })

  it('refuses a question that leaks the answer key', async () => {
    const leaky = {
      ...QUESTION,
      choices: [{ label: 'A', text: 'First', isCorrect: true }, QUESTION.choices[1]],
    }
    const { api } = clientWith(() => json({ data: leaky }))
    await expect(api.questions.get(id)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('posts the chosen label and parses the verdict', async () => {
    const result = {
      questionId: id,
      selectedLabel: 'B',
      isCorrect: true,
      correctLabel: 'B',
      isFirstAttempt: true,
      choices: [
        { label: 'A', isCorrect: false, explanation: { html: '<p>no</p>' } },
        { label: 'B', isCorrect: true, explanation: { html: '<p>yes</p>' } },
      ],
      overallExplanation: { html: '<p>because</p>' },
      citations: [],
    }
    const { api, fetchMock } = clientWith(() => json({ data: result }))
    const answer = await api.questions.answer(id, 'B')
    expect(answer.isCorrect).toBe(true)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(new URL(String(url)).pathname).toBe(`/api/v1/questions/${id}/answer`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ selectedLabel: 'B' })
  })

  it('asks for the next question with the filters as a query string', async () => {
    const { api, fetchMock } = clientWith(() =>
      json({ data: { question: QUESTION, remaining: 7 } }),
    )
    const next = await api.me.nextQuestion({
      domains: ['cardiology', 'pharmacology'],
      topics: ['acs'],
      filter: 'incorrect',
    })
    expect(next.remaining).toBe(7)

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/api/v1/me/questions/next')
    expect(url.searchParams.get('domains')).toBe('cardiology,pharmacology')
    expect(url.searchParams.get('topics')).toBe('acs')
    expect(url.searchParams.get('filter')).toBe('incorrect')
  })

  it('sends no query parameters when nothing is chosen, and accepts "no question"', async () => {
    const { api, fetchMock } = clientWith(() => json({ data: { question: null, remaining: 0 } }))
    expect(await api.me.nextQuestion()).toEqual({ question: null, remaining: 0 })
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).search).toBe('')
  })

  it('gets the analytics', async () => {
    const empty = {
      totals: { attempts: 0, answered: 0, correct: 0, accuracy: null },
      byDomain: [],
      weakest: [],
    }
    const { api } = clientWith(() => json({ data: empty }))
    expect(await api.me.analytics()).toEqual(empty)
  })

  it('surfaces a 401 as an ApiClientError', async () => {
    const { api } = clientWith(() =>
      json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, 401),
    )
    await expect(api.me.analytics()).rejects.toBeInstanceOf(ApiClientError)
  })
})
