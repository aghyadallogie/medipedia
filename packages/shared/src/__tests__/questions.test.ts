import { describe, expect, it } from 'vitest'

import { AnalyticsSchema, NextQuestionQuerySchema } from '../questions'

describe('NextQuestionQuerySchema', () => {
  it('defaults the filter to unused and leaves the lists unset', () => {
    expect(NextQuestionQuerySchema.parse({})).toEqual({ filter: 'unused' })
  })

  it('splits comma-separated slugs and ignores blanks and spaces', () => {
    const query = NextQuestionQuerySchema.parse({
      domains: 'cardiology, pharmacology,,',
      topics: 'acute-coronary-syndrome',
      filter: 'incorrect',
    })
    expect(query).toEqual({
      domains: ['cardiology', 'pharmacology'],
      topics: ['acute-coronary-syndrome'],
      filter: 'incorrect',
    })
  })

  it('treats an empty list as no filter', () => {
    expect(NextQuestionQuerySchema.parse({ domains: '' }).domains).toEqual([])
  })

  it.each([
    { filter: 'everything' },
    { domains: 'Not A Slug' },
    { topics: 'fine,BAD!' },
    { domains: Array.from({ length: 51 }, (_, i) => `d-${i}`).join(',') },
  ])('rejects %j', (query) => {
    expect(NextQuestionQuerySchema.safeParse(query).success).toBe(false)
  })
})

describe('AnalyticsSchema', () => {
  const domain = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Cardiology',
    slug: 'cardiology',
    answered: 10,
    correct: 4,
    accuracy: 0.4,
  }

  it('accepts a populated result and an empty one', () => {
    expect(
      AnalyticsSchema.safeParse({
        totals: { attempts: 12, answered: 10, correct: 4, accuracy: 0.4 },
        byDomain: [domain],
        weakest: [domain],
      }).success,
    ).toBe(true)
    expect(
      AnalyticsSchema.safeParse({
        totals: { attempts: 0, answered: 0, correct: 0, accuracy: null },
        byDomain: [],
        weakest: [],
      }).success,
    ).toBe(true)
  })

  it('rejects an accuracy outside 0 to 1 and more than three weakest domains', () => {
    const totals = { attempts: 1, answered: 1, correct: 1, accuracy: 1 }
    expect(
      AnalyticsSchema.safeParse({ totals, byDomain: [{ ...domain, accuracy: 1.5 }], weakest: [] })
        .success,
    ).toBe(false)
    expect(
      AnalyticsSchema.safeParse({ totals, byDomain: [], weakest: [domain, domain, domain, domain] })
        .success,
    ).toBe(false)
  })
})
