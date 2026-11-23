import { describe, expect, it, vi } from 'vitest'

import { ApiClientError, createApiClient, paginate, type Page } from '../index'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NOW = '2026-11-22T12:00:00.000Z'
const domainRef = { id: id(1), name: 'Cardiology', slug: 'cardiology' }

const lectureSummary = (n: number) => ({
  id: id(n),
  slug: `lecture-${n}`,
  title: `Lecture ${n}`,
  summary: null,
  coverImage: null,
  domains: [domainRef],
  accessTier: 'free',
  publishedAt: NOW,
  lastReviewedAt: null,
  updatedAt: NOW,
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clientWith(
  respond: (url: URL, init: RequestInit) => Response | Promise<Response>,
  extra = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(new URL(String(input)), init ?? {}),
  )
  const api = createApiClient({ baseUrl: 'https://example.test', fetch: fetchMock, ...extra })
  return { api, fetchMock }
}

describe('requests', () => {
  it('calls /api/v1 on the base URL, tolerating trailing slashes', async () => {
    const { api, fetchMock } = clientWith(() => jsonResponse({ data: { status: 'ok' } }))
    const slashed = createApiClient({ baseUrl: 'https://example.test//', fetch: fetchMock })
    expect(await slashed.health()).toEqual({ status: 'ok' })
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe('/api/v1/health')
    expect(api).toBeDefined()
  })

  it('sends only the query parameters that are set', async () => {
    const { api, fetchMock } = clientWith(() => jsonResponse({ data: [], nextCursor: null }))
    await api.lectures.list({ domain: 'cardiology', limit: 5 })
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/api/v1/lectures')
    expect(Object.fromEntries(url.searchParams)).toEqual({ domain: 'cardiology', limit: '5' })
  })

  it('encodes slugs and ids into the path', async () => {
    const { api, fetchMock } = clientWith(() => jsonResponse({ data: null }, 404))
    await api.lectures.get('a/b c').catch(() => undefined)
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
      '/api/v1/lectures/a%2Fb%20c',
    )
  })

  it('asks for JSON and adds a bearer token only when one is available', async () => {
    const seen: Array<Record<string, string>> = []
    const respond = (_url: URL, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>)
      return jsonResponse({ data: { status: 'ok' } })
    }

    await clientWith(respond).api.health()
    await clientWith(respond, { getAccessToken: () => 'abc123' }).api.health()
    await clientWith(respond, { getAccessToken: async () => null }).api.health()

    expect(seen[0]).toEqual({ Accept: 'application/json' })
    expect(seen[1]).toMatchObject({ Authorization: 'Bearer abc123' })
    expect(seen[2]).not.toHaveProperty('Authorization')
  })

  it('merges custom headers', async () => {
    const seen: Array<Record<string, string>> = []
    const { api } = clientWith(
      (_url, init) => {
        seen.push(init.headers as Record<string, string>)
        return jsonResponse({ data: { status: 'ok' } })
      },
      { headers: { 'X-App': 'mobile' } },
    )
    await api.health()
    expect(seen[0]).toMatchObject({ 'X-App': 'mobile', Accept: 'application/json' })
  })
})

describe('responses', () => {
  it('returns a page with items and the next cursor', async () => {
    const { api } = clientWith(() =>
      jsonResponse({ data: [lectureSummary(1), lectureSummary(2)], nextCursor: 'abc' }),
    )
    const page = await api.lectures.list()
    expect(page.items.map((lecture) => lecture.slug)).toEqual(['lecture-1', 'lecture-2'])
    expect(page.nextCursor).toBe('abc')
  })

  it('returns plain arrays for the unpaginated lists', async () => {
    const { api } = clientWith(() =>
      jsonResponse({
        data: [{ ...domainRef, description: null, parentId: null, order: 0, updatedAt: NOW }],
        nextCursor: null,
      }),
    )
    expect(await api.domains.list()).toHaveLength(1)
  })

  it('asks for the mobile shape and accepts cards without a back', async () => {
    const card = {
      id: id(9),
      front: 'Front',
      frontImage: null,
      tags: [],
      topic: { id: id(2), name: 'ACS', slug: 'acs' },
      domain: domainRef,
      accessTier: 'free',
      updatedAt: NOW,
    }
    const { api, fetchMock } = clientWith(() => jsonResponse({ data: [card], nextCursor: null }))
    const page = await api.flashcards.list({ client: 'mobile', topic: 'acs' })
    expect(page.items[0]).not.toHaveProperty('back')
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('client')).toBe('mobile')
    expect(url.searchParams.get('topic')).toBe('acs')
  })

  it('reads a flashcard back', async () => {
    const { api } = clientWith(() =>
      jsonResponse({ data: { id: id(9), back: { html: '<p>Answer</p>' } } }),
    )
    expect(await api.flashcards.back(id(9))).toEqual({ id: id(9), back: { html: '<p>Answer</p>' } })
  })
})

describe('errors', () => {
  it('maps an API error body to an ApiClientError', async () => {
    const { api } = clientWith(() =>
      jsonResponse({ error: { code: 'not_found', message: 'Lecture not found.' } }, 404),
    )
    const error = await api.lectures.get('missing').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({ code: 'not_found', status: 404, message: 'Lecture not found.' })
    expect((error as ApiClientError).isNotFound).toBe(true)
  })

  it('keeps validation details', async () => {
    const { api } = clientWith(() =>
      jsonResponse(
        {
          error: {
            code: 'validation_error',
            message: 'Invalid request.',
            details: [{ path: ['limit'] }],
          },
        },
        400,
      ),
    )
    const error = (await api.lectures.list().catch((e: unknown) => e)) as ApiClientError
    expect(error.code).toBe('validation_error')
    expect(error.details).toEqual([{ path: ['limit'] }])
  })

  it('reports a network failure with status 0', async () => {
    const { api } = clientWith(() => {
      throw new TypeError('fetch failed')
    })
    const error = (await api.health().catch((e: unknown) => e)) as ApiClientError
    expect(error).toMatchObject({ code: 'network_error', status: 0 })
    expect(error.cause).toBeInstanceOf(TypeError)
  })

  it('reports a non-JSON response', async () => {
    const { api } = clientWith(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await api.health().catch((e: unknown) => e)).toMatchObject({
      code: 'invalid_response',
      status: 502,
    })
  })

  it('reports an error status with a body we do not recognise', async () => {
    const { api } = clientWith(() => jsonResponse({ oops: true }, 500))
    expect(await api.health().catch((e: unknown) => e)).toMatchObject({
      code: 'invalid_response',
      status: 500,
    })
  })

  it('rejects a success response that breaks the contract', async () => {
    const { api } = clientWith(() =>
      jsonResponse({ data: [{ id: 'not-a-uuid' }], nextCursor: null }),
    )
    expect(await api.lectures.list().catch((e: unknown) => e)).toMatchObject({
      code: 'invalid_response',
      status: 200,
    })
  })
})

describe('paginate', () => {
  it('walks every page, passing each cursor to the next request', async () => {
    const pages: Record<string, Page<number>> = {
      start: { items: [1, 2], nextCursor: 'b' },
      b: { items: [3, 4], nextCursor: 'c' },
      c: { items: [5], nextCursor: null },
    }
    const requested: Array<string | undefined> = []
    const seen: number[] = []
    for await (const item of paginate(async (cursor) => {
      requested.push(cursor)
      return pages[cursor ?? 'start'] as Page<number>
    })) {
      seen.push(item)
    }
    expect(seen).toEqual([1, 2, 3, 4, 5])
    expect(requested).toEqual([undefined, 'b', 'c'])
  })

  it('handles an empty first page', async () => {
    const seen: number[] = []
    for await (const item of paginate<number>(async () => ({ items: [], nextCursor: null }))) {
      seen.push(item)
    }
    expect(seen).toEqual([])
  })
})
