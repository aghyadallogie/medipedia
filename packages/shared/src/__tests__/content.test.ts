import { describe, expect, it } from 'vitest'

import {
  AnswerResultSchema,
  FlashcardSchema,
  QuestionSchema,
  SubmitAnswerBodySchema,
} from '../content'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ref = (n: number) => ({ id: id(n), name: `Name ${n}`, slug: `name-${n}` })
const now = '2026-11-22T12:00:00.000Z'

const question = () => ({
  id: id(1),
  vignette: { html: '<p>A 58-year-old man presents with chest pain.</p>' },
  stem: 'Which artery is most likely occluded?',
  choices: [
    { label: 'A', text: 'Left anterior descending' },
    { label: 'B', text: 'Right coronary' },
  ],
  topic: ref(2),
  domain: ref(3),
  difficulty: 'medium',
  accessTier: 'free',
  updatedAt: now,
})

describe('QuestionSchema (public, no correctness)', () => {
  it('accepts a well-formed question', () => {
    expect(QuestionSchema.safeParse(question()).success).toBe(true)
  })

  it('rejects a choice that carries isCorrect', () => {
    const q = question()
    const leaked = { ...q, choices: [{ ...q.choices[0], isCorrect: false }, q.choices[1]] }
    expect(QuestionSchema.safeParse(leaked).success).toBe(false)
  })

  it('rejects a choice that carries an explanation', () => {
    const q = question()
    const leaked = {
      ...q,
      choices: [{ ...q.choices[0], explanation: { html: '<p>why</p>' } }, q.choices[1]],
    }
    expect(QuestionSchema.safeParse(leaked).success).toBe(false)
  })

  it('rejects overallExplanation at the top level', () => {
    expect(
      QuestionSchema.safeParse({ ...question(), overallExplanation: { html: '<p>x</p>' } }).success,
    ).toBe(false)
  })

  it('enforces 2 to 6 choices', () => {
    const q = question()
    expect(QuestionSchema.safeParse({ ...q, choices: [q.choices[0]] }).success).toBe(false)
    const seven = Array.from({ length: 7 }, (_, i) => ({ label: 'A', text: String(i) }))
    expect(QuestionSchema.safeParse({ ...q, choices: seven }).success).toBe(false)
  })

  it('rejects a label outside A-F', () => {
    const q = question()
    expect(
      QuestionSchema.safeParse({ ...q, choices: [{ label: 'G', text: 'x' }, q.choices[1]] })
        .success,
    ).toBe(false)
  })
})

describe('SubmitAnswerBodySchema', () => {
  it('accepts A-F and rejects everything else', () => {
    expect(SubmitAnswerBodySchema.safeParse({ selectedLabel: 'C' }).success).toBe(true)
    expect(SubmitAnswerBodySchema.safeParse({ selectedLabel: 'c' }).success).toBe(false)
    expect(SubmitAnswerBodySchema.safeParse({ selectedLabel: 'AB' }).success).toBe(false)
    expect(SubmitAnswerBodySchema.safeParse({}).success).toBe(false)
  })
})

describe('AnswerResultSchema', () => {
  it('accepts a verdict with explanations', () => {
    expect(
      AnswerResultSchema.safeParse({
        questionId: id(1),
        selectedLabel: 'A',
        isCorrect: false,
        correctLabel: 'B',
        choices: [
          { label: 'A', isCorrect: false, explanation: { html: '<p>no</p>' } },
          { label: 'B', isCorrect: true, explanation: { html: '<p>yes</p>' } },
        ],
        overallExplanation: { html: '<p>because</p>' },
        citations: [{ label: 'Source', url: 'https://example.com' }],
      }).success,
    ).toBe(true)
  })
})

describe('FlashcardSchema', () => {
  const card = {
    id: id(1),
    front: 'Antidote for acetaminophen overdose?',
    frontImage: null,
    tags: [],
    topic: ref(2),
    domain: ref(3),
    accessTier: 'free',
    updatedAt: now,
  }

  it('accepts a card without a back (mobile / before reveal)', () => {
    expect(FlashcardSchema.safeParse(card).success).toBe(true)
  })

  it('accepts a card with a back', () => {
    expect(
      FlashcardSchema.safeParse({ ...card, back: { html: '<p>N-acetylcysteine</p>' } }).success,
    ).toBe(true)
  })

  it('requires id and updatedAt (review state is keyed by id)', () => {
    const { id: _id, ...noId } = card
    const { updatedAt: _u, ...noUpdated } = card
    expect(FlashcardSchema.safeParse(noId).success).toBe(false)
    expect(FlashcardSchema.safeParse(noUpdated).success).toBe(false)
  })
})
