import {
  ApiErrorBodySchema,
  DomainListResponseSchema,
  DomainResponseSchema,
  FlashcardBackResponseSchema,
  FlashcardListResponseSchema,
  HealthResponseSchema,
  LectureListResponseSchema,
  LectureResponseSchema,
  PaperListResponseSchema,
  PaperResponseSchema,
  QuestionStatsResponseSchema,
  TopicListResponseSchema,
  VideoListResponseSchema,
  VideoResponseSchema,
  type ClientKind,
  type Domain,
  type Flashcard,
  type FlashcardBack,
  type Lecture,
  type LectureSummary,
  type Paper,
  type PaperSummary,
  type QuestionStats,
  type Topic,
  type Video,
} from '@medipedia/shared'

import { ApiClientError } from './errors'

export type ApiClientOptions = {
  /** Site origin, e.g. `https://medipedia.example`. `/api/v1` is added for you. */
  baseUrl: string
  /** Defaults to the global `fetch`. Pass your own for tests, React Native or server caching. */
  fetch?: typeof fetch
  /** Sent as `Authorization: Bearer ...` when it returns a token (authenticated endpoints). */
  getAccessToken?: () => string | null | Promise<string | null>
  /** Extra headers on every request. */
  headers?: Record<string, string>
}

/** One page of a list endpoint. Pass `nextCursor` as `cursor` to get the next page. */
export type Page<T> = { items: T[]; nextCursor: string | null }

export type ListOptions = { cursor?: string; limit?: number }
export type DomainFilterOptions = ListOptions & { domain?: string }
export type FlashcardListOptions = DomainFilterOptions & { topic?: string; client?: ClientKind }

type Schema<T> = { parse: (input: unknown) => T }
type Query = Record<string, string | number | undefined>

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const root = `${options.baseUrl.replace(/\/+$/, '')}/api/v1`

  async function get<T>(path: string, schema: Schema<T>, query: Query = {}): Promise<T> {
    const url = new URL(`${root}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    const token = await options.getAccessToken?.()
    if (token) headers.Authorization = `Bearer ${token}`

    let response: Response
    try {
      response = await doFetch(url.toString(), { method: 'GET', headers })
    } catch (cause) {
      throw new ApiClientError({
        code: 'network_error',
        message: 'Could not reach the server.',
        status: 0,
        cause,
      })
    }

    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new ApiClientError({
        code: 'invalid_response',
        message: 'The server returned a response that is not JSON.',
        status: response.status,
        cause,
      })
    }

    if (!response.ok) {
      const parsed = ApiErrorBodySchema.safeParse(body)
      if (parsed.success) {
        const { code, message, details } = parsed.data.error
        throw new ApiClientError({ code, message, status: response.status, details })
      }
      throw new ApiClientError({
        code: 'invalid_response',
        message: `Request failed with status ${response.status}.`,
        status: response.status,
      })
    }

    try {
      return schema.parse(body)
    } catch (cause) {
      throw new ApiClientError({
        code: 'invalid_response',
        message: 'The server response did not match the API contract.',
        status: response.status,
        cause,
      })
    }
  }

  async function page<T>(
    path: string,
    schema: Schema<{ data: T[]; nextCursor: string | null }>,
    query: Query,
  ): Promise<Page<T>> {
    const { data, nextCursor } = await get(path, schema, query)
    return { items: data, nextCursor }
  }

  const slug = (value: string) => encodeURIComponent(value)

  return {
    health: async () => (await get('/health', HealthResponseSchema)).data,

    domains: {
      list: async (): Promise<Domain[]> => (await get('/domains', DomainListResponseSchema)).data,
      get: async (domainSlug: string): Promise<Domain> =>
        (await get(`/domains/${slug(domainSlug)}`, DomainResponseSchema)).data,
    },

    topics: {
      list: async (query: { domain?: string } = {}): Promise<Topic[]> =>
        (await get('/topics', TopicListResponseSchema, query)).data,
    },

    lectures: {
      list: (query: DomainFilterOptions = {}): Promise<Page<LectureSummary>> =>
        page('/lectures', LectureListResponseSchema, query),
      get: async (lectureSlug: string): Promise<Lecture> =>
        (await get(`/lectures/${slug(lectureSlug)}`, LectureResponseSchema)).data,
    },

    papers: {
      list: (query: DomainFilterOptions = {}): Promise<Page<PaperSummary>> =>
        page('/papers', PaperListResponseSchema, query),
      get: async (paperSlug: string): Promise<Paper> =>
        (await get(`/papers/${slug(paperSlug)}`, PaperResponseSchema)).data,
    },

    videos: {
      list: (query: DomainFilterOptions = {}): Promise<Page<Video>> =>
        page('/videos', VideoListResponseSchema, query),
      get: async (videoSlug: string): Promise<Video> =>
        (await get(`/videos/${slug(videoSlug)}`, VideoResponseSchema)).data,
    },

    flashcards: {
      /** With `client: 'mobile'` cards come without `back`; fetch it per card with `back()`. */
      list: (query: FlashcardListOptions = {}): Promise<Page<Flashcard>> =>
        page('/flashcards', FlashcardListResponseSchema, query),
      back: async (id: string): Promise<FlashcardBack> =>
        (await get(`/flashcards/${slug(id)}/back`, FlashcardBackResponseSchema)).data,
    },

    questions: {
      /** Counts per domain and topic. The questions themselves need an account. */
      stats: async (): Promise<QuestionStats> =>
        (await get('/questions/stats', QuestionStatsResponseSchema)).data,
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

/**
 * Walks every page of a list endpoint:
 *
 *   for await (const lecture of paginate((cursor) => api.lectures.list({ cursor }))) { ... }
 */
export async function* paginate<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
): AsyncGenerator<T, void, undefined> {
  let cursor: string | undefined
  do {
    const { items, nextCursor } = await fetchPage(cursor)
    yield* items
    cursor = nextCursor ?? undefined
  } while (cursor !== undefined)
}
