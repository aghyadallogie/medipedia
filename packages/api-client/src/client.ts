import {
  AckResponseSchema,
  AnalyticsResponseSchema,
  AnswerResponseSchema,
  ApiErrorBodySchema,
  DomainListResponseSchema,
  DomainResponseSchema,
  FlashcardBackResponseSchema,
  FlashcardListResponseSchema,
  HealthResponseSchema,
  LectureListResponseSchema,
  LectureResponseSchema,
  PaperListResponseSchema,
  NextQuestionResponseSchema,
  PaperResponseSchema,
  QuestionResponseSchema,
  QuestionStatsResponseSchema,
  RefreshSessionResponseSchema,
  SessionResponseSchema,
  TopicListResponseSchema,
  UserResponseSchema,
  VideoListResponseSchema,
  VideoResponseSchema,
  type Analytics,
  type AnswerResult,
  type ChoiceLabel,
  type ClientKind,
  type Domain,
  type Flashcard,
  type FlashcardBack,
  type ForgotPasswordBody,
  type GoogleMobileBody,
  type Lecture,
  type LectureSummary,
  type LoginBody,
  type NextQuestion,
  type NextQuestionQuery,
  type Paper,
  type PaperSummary,
  type Question,
  type QuestionStats,
  type RefreshSession,
  type RegisterBody,
  type ResetPasswordBody,
  type Session,
  type Topic,
  type User,
  type Video,
  type VideoSummary,
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
  /**
   * Called when an authenticated request is answered with 401, to get a new access token. On the
   * web, which keeps its tokens in cookies: `() => api.auth.refresh().then(() => true, () => false)`.
   * Return true to retry the request once. Concurrent 401s share one call, so a burst of requests
   * rotates the refresh token only once.
   */
  refresh?: () => Promise<boolean>
  /** Passed to `fetch`. A browser talking to another origin needs 'include' to send cookies. */
  credentials?: RequestCredentials
}

/** One page of a list endpoint. Pass `nextCursor` as `cursor` to get the next page. */
export type Page<T> = { items: T[]; nextCursor: string | null }

export type ListOptions = { cursor?: string; limit?: number }
export type DomainFilterOptions = ListOptions & { domain?: string }
export type FlashcardListOptions = DomainFilterOptions & { topic?: string; client?: ClientKind }

/** What to practise: slugs of domains (sub-domains included) and topics, and which questions. */
export type NextQuestionOptions = {
  domains?: readonly string[]
  topics?: readonly string[]
  /** Defaults to 'unused' on the server. */
  filter?: NextQuestionQuery['filter']
}

/** Sign-in input. `client` defaults to 'web' on the server. */
export type LoginInput = Omit<LoginBody, 'client'> & { client?: ClientKind }

type Schema<T> = { parse: (input: unknown) => T }
type Query = Record<string, string | number | undefined>
type RequestOptions = { query?: Query; body?: unknown; retried?: boolean }

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const root = `${options.baseUrl.replace(/\/+$/, '')}/api/v1`

  let refreshing: Promise<boolean> | null = null
  const refreshOnce = (): Promise<boolean> => {
    refreshing ??= (options.refresh?.() ?? Promise.resolve(false))
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  async function send<T>(
    method: string,
    path: string,
    schema: Schema<T>,
    { query = {}, body, retried = false }: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(`${root}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = await options.getAccessToken?.()
    if (token) headers.Authorization = `Bearer ${token}`

    let response: Response
    try {
      response = await doFetch(url.toString(), {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(options.credentials ? { credentials: options.credentials } : {}),
      })
    } catch (cause) {
      throw new ApiClientError({
        code: 'network_error',
        message: 'Could not reach the server.',
        status: 0,
        cause,
      })
    }

    // An expired access token: refresh once and replay. Never for the auth endpoints themselves,
    // where a 401 means the credentials were wrong.
    if (response.status === 401 && options.refresh && !retried && !path.startsWith('/auth/')) {
      if (await refreshOnce()) {
        return send(method, path, schema, { query, body, retried: true })
      }
    }

    let parsedBody: unknown
    try {
      parsedBody = await response.json()
    } catch (cause) {
      throw new ApiClientError({
        code: 'invalid_response',
        message: 'The server returned a response that is not JSON.',
        status: response.status,
        cause,
      })
    }

    if (!response.ok) {
      const parsed = ApiErrorBodySchema.safeParse(parsedBody)
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
      return schema.parse(parsedBody)
    } catch (cause) {
      throw new ApiClientError({
        code: 'invalid_response',
        message: 'The server response did not match the API contract.',
        status: response.status,
        cause,
      })
    }
  }

  const get = <T>(path: string, schema: Schema<T>, query: Query = {}) =>
    send('GET', path, schema, { query })
  const post = <T>(path: string, schema: Schema<T>, body: unknown = {}) =>
    send('POST', path, schema, { body })

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
      list: (query: DomainFilterOptions = {}): Promise<Page<VideoSummary>> =>
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

    auth: {
      /**
       * Creates an account and emails a confirmation link. The answer is the same whether or not
       * the address already has an account.
       */
      register: async (body: RegisterBody): Promise<void> => {
        await post('/auth/register', AckResponseSchema, body)
      },
      verifyEmail: async (token: string): Promise<void> => {
        await post('/auth/verify-email', AckResponseSchema, { token })
      },
      /**
       * Web (default): the server sets httpOnly cookies and `tokens` is absent. With
       * `client: 'mobile'` the tokens come back in the body: keep the refresh token in the
       * secure store and pass the access token through `getAccessToken`.
       */
      login: async (body: LoginInput): Promise<Session> =>
        (await post('/auth/login', SessionResponseSchema, body)).data,
      /**
       * Web: call with no argument (the refresh cookie is sent for you). Mobile: pass the stored
       * refresh token. A duplicate refresh within seconds returns an access token without a new
       * refresh token: keep the one you have.
       */
      refresh: async (refreshToken?: string): Promise<RefreshSession> =>
        (
          await post(
            '/auth/refresh',
            RefreshSessionResponseSchema,
            refreshToken ? { refreshToken } : {},
          )
        ).data,
      logout: async (refreshToken?: string): Promise<void> => {
        await post('/auth/logout', AckResponseSchema, refreshToken ? { refreshToken } : {})
      },
      forgotPassword: async (body: ForgotPasswordBody): Promise<void> => {
        await post('/auth/forgot-password', AckResponseSchema, body)
      },
      resetPassword: async (body: ResetPasswordBody): Promise<void> => {
        await post('/auth/reset-password', AckResponseSchema, body)
      },
      /** Mobile: exchange the ID token the Google SDK produced for our tokens. */
      googleMobile: async (body: GoogleMobileBody): Promise<Session> =>
        (await post('/auth/google/mobile', SessionResponseSchema, body)).data,
      /** Web: where to send the browser to start "Sign in with Google". */
      googleSignInUrl: (returnTo?: string): string => {
        const url = new URL(`${root}/auth/google`)
        if (returnTo) url.searchParams.set('returnTo', returnTo)
        return url.toString()
      },
    },

    me: {
      get: async (): Promise<User> => (await get('/me', UserResponseSchema)).data,
      update: async (body: { name: string }): Promise<User> =>
        (await send('PATCH', '/me', UserResponseSchema, { body })).data,
      /** Accounts with a password must send it to confirm. */
      delete: async (body: { password?: string } = {}): Promise<void> => {
        await send('DELETE', '/me', AckResponseSchema, { body })
      },
      /**
       * A random question for tutor mode, without its answer key. `question` is null when nothing
       * matches or everything has been answered; `remaining` counts what matches.
       */
      nextQuestion: async (options: NextQuestionOptions = {}): Promise<NextQuestion> =>
        (
          await get('/me/questions/next', NextQuestionResponseSchema, {
            domains: options.domains?.join(','),
            topics: options.topics?.join(','),
            filter: options.filter,
          })
        ).data,
      /** Your accuracy by domain, from first attempts only. */
      analytics: async (): Promise<Analytics> =>
        (await get('/me/analytics', AnalyticsResponseSchema)).data,
    },

    questions: {
      /** Counts per domain and topic. The questions themselves need an account. */
      stats: async (): Promise<QuestionStats> =>
        (await get('/questions/stats', QuestionStatsResponseSchema)).data,
      /** One question without its answer key. Needs an account. */
      get: async (id: string): Promise<Question> =>
        (await get(`/questions/${slug(id)}`, QuestionResponseSchema)).data,
      /** Submits an answer and gets the verdict with every explanation. */
      answer: async (id: string, selectedLabel: ChoiceLabel): Promise<AnswerResult> =>
        (await post(`/questions/${slug(id)}/answer`, AnswerResponseSchema, { selectedLabel })).data,
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
