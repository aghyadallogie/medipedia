import { describe, expect, it } from 'vitest'

import { CONTENT_TAG, tagsFor } from './cache-tags'
import { idOf, idsOf } from './ids'
import { paragraphsToLexical } from './lexical'
import { assignChoiceLabels, validateChoices } from './question-choices'

describe('idOf / idsOf', () => {
  it('normalises ids and populated documents', () => {
    expect(idOf('abc')).toBe('abc')
    expect(idOf({ id: 'abc', name: 'x' })).toBe('abc')
    expect(idOf(null)).toBeNull()
    expect(idOf(undefined)).toBeNull()
    expect(idOf('')).toBeNull()
    expect(idOf({ id: 5 })).toBeNull()
    expect(idOf({})).toBeNull()
  })

  it('maps arrays and ignores everything else', () => {
    expect(idsOf(['a', { id: 'b' }, null, {}])).toEqual(['a', 'b'])
    expect(idsOf('a')).toEqual([])
    expect(idsOf(undefined)).toEqual([])
  })
})

describe('tagsFor', () => {
  it('tags a lecture with item, collection, content and domains', () => {
    expect(
      tagsFor('lectures', { slug: 'chest-pain', domainSlugs: ['cardiology', 'emergency'] }).sort(),
    ).toEqual(
      [
        CONTENT_TAG,
        'lectures',
        'lecture:chest-pain',
        'domain:cardiology',
        'domain:emergency',
      ].sort(),
    )
  })

  it('keys flashcards by id, not slug, and adds topic and domain', () => {
    expect(
      tagsFor('flashcards', {
        id: 'u1',
        slug: 'ignored',
        topicSlug: 'acs',
        domainSlugs: ['cardiology'],
      }).sort(),
    ).toEqual([CONTENT_TAG, 'flashcards', 'flashcard:u1', 'topic:acs', 'domain:cardiology'].sort())
  })

  it('gives questions no item tag (they have no public pages)', () => {
    const tags = tagsFor('questions', {
      id: 'q1',
      slug: 'x',
      domainSlugs: ['cardiology'],
      topicSlug: 'acs',
    })
    expect(tags).toContain('questions')
    expect(tags.some((tag) => tag.startsWith('question:'))).toBe(false)
  })

  it('uses domain: and topic: item tags for taxonomy', () => {
    expect(tagsFor('domains', { slug: 'cardiology' })).toContain('domain:cardiology')
    expect(tagsFor('topics', { slug: 'acs' })).toContain('topic:acs')
  })

  it('omits an item tag when the key is missing and never duplicates', () => {
    const tags = tagsFor('lectures', { slug: null, domainSlugs: ['a', 'a'] })
    expect(tags).toEqual([CONTENT_TAG, 'lectures', 'domain:a'])
  })
})

describe('validateChoices', () => {
  const row = (isCorrect: boolean) => ({ text: 't', isCorrect })

  it('accepts 2 to 6 choices with exactly one correct', () => {
    expect(validateChoices([row(true), row(false)])).toBe(true)
    expect(
      validateChoices([row(false), row(false), row(false), row(false), row(false), row(true)]),
    ).toBe(true)
  })

  it.each([
    ['not an array', undefined],
    ['empty', []],
    ['one choice', [row(true)]],
    ['seven choices', [row(true), ...Array.from({ length: 6 }, () => row(false))]],
    ['none correct', [row(false), row(false)]],
    ['two correct', [row(true), row(true), row(false)]],
  ])('rejects %s', (_name, value) => {
    expect(validateChoices(value)).not.toBe(true)
    expect(typeof validateChoices(value)).toBe('string')
  })

  it('treats a missing or non-boolean isCorrect as not correct', () => {
    expect(validateChoices([{ text: 'a' }, { text: 'b', isCorrect: 'true' }])).not.toBe(true)
  })
})

describe('assignChoiceLabels', () => {
  it('labels by position and keeps other fields', () => {
    expect(
      assignChoiceLabels([{ text: 'x', id: '1' }, { text: 'y', label: 'Z' }, { text: 'w' }]),
    ).toEqual([
      { text: 'x', id: '1', label: 'A' },
      { text: 'y', label: 'B' },
      { text: 'w', label: 'C' },
    ])
  })
})

describe('paragraphsToLexical', () => {
  it('builds a root with one paragraph per string', () => {
    const state = paragraphsToLexical(['one', 'two'])
    expect(state.root.type).toBe('root')
    expect(state.root.children).toHaveLength(2)
    expect(state.root.children[1]?.children[0]?.text).toBe('two')
  })
})
