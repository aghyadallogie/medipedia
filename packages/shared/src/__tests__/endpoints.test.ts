import { describe, expect, it } from 'vitest'

import { PAGINATION } from '../constants'
import {
  ClientQuerySchema,
  FlashcardListQuerySchema,
  LectureListQuerySchema,
  QuestionStatsResponseSchema,
  TopicListQuerySchema,
} from '../endpoints'

describe('ClientQuerySchema', () => {
  it('defaults to the web shape', () => {
    expect(ClientQuerySchema.parse({})).toEqual({ client: 'web' })
    expect(ClientQuerySchema.parse({ client: 'mobile' })).toEqual({ client: 'mobile' })
  })

  it('rejects an unknown client', () => {
    expect(ClientQuerySchema.safeParse({ client: 'desktop' }).success).toBe(false)
  })
})

describe('list queries', () => {
  it('apply pagination defaults and accept a domain filter', () => {
    expect(LectureListQuerySchema.parse({})).toEqual({ limit: PAGINATION.defaultLimit })
    expect(LectureListQuerySchema.parse({ domain: 'cardiology', limit: '5' })).toEqual({
      domain: 'cardiology',
      limit: 5,
    })
  })

  it.each([{ domain: 'Not A Slug' }, { domain: '' }, { limit: '101' }, { cursor: '' }])(
    'reject %j',
    (query) => {
      expect(LectureListQuerySchema.safeParse(query).success).toBe(false)
    },
  )

  it('ignores parameters it does not know about', () => {
    expect(LectureListQuerySchema.parse({ unknown: 'x' })).toEqual({
      limit: PAGINATION.defaultLimit,
    })
  })

  it('flashcard queries combine filters, pagination and the client shape', () => {
    expect(FlashcardListQuerySchema.parse({ topic: 'acs', client: 'mobile', limit: '10' })).toEqual(
      {
        topic: 'acs',
        client: 'mobile',
        limit: 10,
      },
    )
    expect(FlashcardListQuerySchema.parse({})).toEqual({
      client: 'web',
      limit: PAGINATION.defaultLimit,
    })
  })

  it('topic queries filter by domain only', () => {
    expect(TopicListQuerySchema.parse({ domain: 'cardiology' })).toEqual({ domain: 'cardiology' })
    expect(TopicListQuerySchema.safeParse({ domain: 'BAD' }).success).toBe(false)
  })
})

describe('QuestionStatsResponseSchema', () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

  it('accepts counts per domain and per topic', () => {
    expect(
      QuestionStatsResponseSchema.safeParse({
        data: {
          total: 3,
          byDomain: [{ id: id(1), name: 'Cardiology', slug: 'cardiology', count: 3 }],
          byTopic: [{ id: id(2), name: 'ACS', slug: 'acs', domainId: id(1), count: 3 }],
        },
      }).success,
    ).toBe(true)
  })

  it('rejects negative counts', () => {
    expect(
      QuestionStatsResponseSchema.safeParse({ data: { total: -1, byDomain: [], byTopic: [] } })
        .success,
    ).toBe(false)
  })
})
