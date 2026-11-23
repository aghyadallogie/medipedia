import type { Domain, QuestionStats } from '@medipedia/shared'
import { describe, expect, it } from 'vitest'

import {
  buildPracticeOptions,
  choiceForKey,
  isHttpUrl,
  pruneTopics,
  topicsFor,
  type PracticeOptions,
} from './practice'

const NOW = '2026-11-23T12:00:00.000Z'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const domain = (n: number, slug: string, parentId: string | null = null): Domain => ({
  id: id(n),
  name: slug.toUpperCase(),
  slug,
  description: null,
  parentId,
  order: n,
  updatedAt: NOW,
})

const domains = [
  domain(1, 'cardiology'),
  domain(2, 'electrophysiology', id(1)),
  domain(3, 'pharmacology'),
  domain(4, 'empty'),
]

const stats: QuestionStats = {
  total: 7,
  byDomain: [
    { id: id(1), name: 'CARDIOLOGY', slug: 'cardiology', count: 3 },
    { id: id(2), name: 'ELECTROPHYSIOLOGY', slug: 'electrophysiology', count: 2 },
    { id: id(3), name: 'PHARMACOLOGY', slug: 'pharmacology', count: 2 },
    { id: id(4), name: 'EMPTY', slug: 'empty', count: 0 },
  ],
  byTopic: [
    { id: id(11), name: 'ACS', slug: 'acs', domainId: id(1), count: 3 },
    { id: id(12), name: 'Arrhythmias', slug: 'arrhythmias', domainId: id(2), count: 2 },
    { id: id(13), name: 'Antihypertensives', slug: 'antihypertensives', domainId: id(3), count: 2 },
    { id: id(14), name: 'Nothing yet', slug: 'nothing-yet', domainId: id(3), count: 0 },
  ],
}

describe('buildPracticeOptions', () => {
  const options = buildPracticeOptions(domains, stats)

  it('lists top-level domains that have questions, with sub-domains rolled in', () => {
    expect(options.domains).toEqual([
      { slug: 'cardiology', name: 'CARDIOLOGY', count: 5 },
      { slug: 'pharmacology', name: 'PHARMACOLOGY', count: 2 },
    ])
  })

  it('files a topic under its top-level domain and hides topics without questions', () => {
    expect(options.topics).toEqual([
      { slug: 'acs', name: 'ACS', domainSlug: 'cardiology', count: 3 },
      { slug: 'arrhythmias', name: 'Arrhythmias', domainSlug: 'cardiology', count: 2 },
      {
        slug: 'antihypertensives',
        name: 'Antihypertensives',
        domainSlug: 'pharmacology',
        count: 2,
      },
    ])
  })

  it('offers nothing when no question is published', () => {
    expect(buildPracticeOptions(domains, { total: 0, byDomain: [], byTopic: [] })).toEqual({
      domains: [],
      topics: [],
    })
  })

  it('survives a topic whose domain is unknown', () => {
    const odd: QuestionStats = {
      total: 1,
      byDomain: [],
      byTopic: [{ id: id(20), name: 'Lost', slug: 'lost', domainId: id(99), count: 1 }],
    }
    expect(buildPracticeOptions(domains, odd).topics).toEqual([])
  })
})

describe('topicsFor and pruneTopics', () => {
  const options: PracticeOptions = buildPracticeOptions(domains, stats)

  it('offers every topic when no domain is chosen, and only matching ones otherwise', () => {
    expect(topicsFor(options, [])).toHaveLength(3)
    expect(topicsFor(options, ['pharmacology']).map((topic) => topic.slug)).toEqual([
      'antihypertensives',
    ])
    expect(topicsFor(options, ['cardiology', 'pharmacology'])).toHaveLength(3)
  })

  it('drops chosen topics that fall outside the chosen domains', () => {
    expect(pruneTopics(options, ['cardiology'], ['acs', 'antihypertensives'])).toEqual(['acs'])
    expect(pruneTopics(options, [], ['acs', 'antihypertensives'])).toEqual([
      'acs',
      'antihypertensives',
    ])
    expect(pruneTopics(options, ['cardiology'], ['unknown'])).toEqual([])
  })
})

describe('isHttpUrl', () => {
  it('accepts web links only', () => {
    expect(isHttpUrl('https://example.com/paper')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,hi')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
  })
})

describe('choiceForKey', () => {
  it('maps a key to the choice with that label, ignoring case', () => {
    expect(choiceForKey('a', ['A', 'B', 'C'])).toBe('A')
    expect(choiceForKey('C', ['A', 'B', 'C'])).toBe('C')
  })

  it('ignores keys with no matching choice and named keys', () => {
    expect(choiceForKey('d', ['A', 'B', 'C'])).toBeNull()
    expect(choiceForKey('Enter', ['A', 'B'])).toBeNull()
    expect(choiceForKey('1', ['A', 'B'])).toBeNull()
  })
})
