import { AnswerResultSchema, QuestionSchema } from '@medipedia/shared'
import { describe, expect, it } from 'vitest'

import type { Domain, Question, Topic } from '@/payload-types'
import { paragraphsToLexical } from '@/server/lexical'

import { correctLabelOf, hasChoice, toAnswerResult, toQuestion } from './serializers'

const NOW = '2026-11-22T12:00:00.000Z'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const rich = (text: string) => paragraphsToLexical([text])

const domain = { id: id(1), name: 'Cardiology', slug: 'cardiology' } as Domain
const topic = { id: id(2), name: 'ACS', slug: 'acs' } as Topic

const question = (overrides: Partial<Question> = {}): Question => ({
  id: id(3),
  vignette: rich('A 58-year-old man with chest pain.'),
  stem: 'Which artery?',
  choices: [
    { label: 'A', text: 'LAD', isCorrect: false, explanation: rich('Not it.') },
    { label: 'B', text: 'RCA', isCorrect: true, explanation: rich('It is.') },
    { label: 'C', text: 'LCx', isCorrect: false, explanation: rich('No.') },
  ],
  overallExplanation: rich('Overall.'),
  citations: [{ label: 'Trial', url: 'https://example.com/t' }],
  topic,
  domain,
  difficulty: 'hard',
  accessTier: 'free',
  updatedAt: NOW,
  createdAt: NOW,
  _status: 'published',
  ...overrides,
})

describe('toQuestion', () => {
  it('matches the public contract and carries nothing from the answer key', () => {
    const dto = toQuestion(question())
    expect(QuestionSchema.parse(dto)).toEqual(dto)
    expect(Object.keys(dto).sort()).toEqual(
      [
        'accessTier',
        'choices',
        'difficulty',
        'domain',
        'id',
        'stem',
        'topic',
        'updatedAt',
        'vignette',
      ].sort(),
    )
    expect(dto.choices).toEqual([
      { label: 'A', text: 'LAD' },
      { label: 'B', text: 'RCA' },
      { label: 'C', text: 'LCx' },
    ])
    expect(JSON.stringify(dto)).not.toMatch(/isCorrect|explanation|citations|Not it|It is\./)
  })

  it('does not copy a field it does not know about', () => {
    const dto = toQuestion({ ...question(), secretNote: 'leak me' } as Question)
    expect(JSON.stringify(dto)).not.toContain('leak me')
  })

  it('labels choices by position when a row has no label', () => {
    const dto = toQuestion(
      question({
        choices: [
          { text: 'one', isCorrect: true, explanation: rich('a') },
          { text: 'two', isCorrect: false, explanation: rich('b') },
        ],
      }),
    )
    expect(dto.choices.map((c) => c.label)).toEqual(['A', 'B'])
  })

  it('reports an unpopulated relationship instead of inventing one', () => {
    expect(() => toQuestion(question({ topic: id(2) }))).toThrow(/question\.topic/)
  })
})

describe('correctLabelOf and hasChoice', () => {
  it('finds the correct label and the labels that exist', () => {
    const doc = question()
    expect(correctLabelOf(doc)).toBe('B')
    expect(hasChoice(doc, 'C')).toBe(true)
    expect(hasChoice(doc, 'D')).toBe(false)
  })

  it('returns null when no choice is marked correct', () => {
    const rows = question().choices?.map((row) => ({ ...row, isCorrect: false }))
    expect(correctLabelOf(question({ choices: rows }))).toBeNull()
  })
})

describe('toAnswerResult', () => {
  it('reports the verdict, every explanation and the citations', () => {
    const dto = toAnswerResult(question(), {
      selectedLabel: 'A',
      correctLabel: 'B',
      isFirstAttempt: true,
    })
    expect(AnswerResultSchema.parse(dto)).toEqual(dto)
    expect(dto.isCorrect).toBe(false)
    expect(dto.choices.map((c) => [c.label, c.isCorrect])).toEqual([
      ['A', false],
      ['B', true],
      ['C', false],
    ])
    expect(dto.choices[1]?.explanation.html).toContain('It is.')
    expect(dto.overallExplanation.html).toContain('Overall.')
    expect(dto.citations).toEqual([{ label: 'Trial', url: 'https://example.com/t' }])
  })

  it('says a right answer is right', () => {
    const dto = toAnswerResult(question(), {
      selectedLabel: 'B',
      correctLabel: 'B',
      isFirstAttempt: false,
    })
    expect(dto.isCorrect).toBe(true)
    expect(dto.isFirstAttempt).toBe(false)
  })
})
