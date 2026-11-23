import type { DomainPerformance } from '@medipedia/shared'
import { describe, expect, it } from 'vitest'

import { accuracyTone, describeCorrect, formatPercent, sortByWeakest } from './analytics'

const domain = (name: string, answered: number, correct: number): DomainPerformance => ({
  id: `00000000-0000-4000-8000-${String(name.charCodeAt(0)).padStart(12, '0')}`,
  name,
  slug: name.toLowerCase(),
  answered,
  correct,
  accuracy: correct / answered,
})

describe('formatPercent', () => {
  it('rounds to a whole percent and shows a dash for no data', () => {
    expect(formatPercent(0.8333)).toBe('83%')
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.005)).toBe('1%')
    expect(formatPercent(null)).toBe('–')
  })
})

describe('accuracyTone', () => {
  it.each([
    [0, 'low'],
    [0.59, 'low'],
    [0.6, 'mid'],
    [0.79, 'mid'],
    [0.8, 'high'],
    [1, 'high'],
  ] as const)('puts %s in the %s band', (accuracy, tone) => {
    expect(accuracyTone(accuracy)).toBe(tone)
  })
})

describe('sortByWeakest', () => {
  it('orders by accuracy, then more answers, then name, without changing the input', () => {
    const input = [
      domain('Pathology', 10, 9),
      domain('Cardiology', 4, 2),
      domain('Anatomy', 10, 5),
      domain('Biochem', 2, 1),
    ]
    const sorted = sortByWeakest(input)
    // Anatomy, Biochem and Cardiology are all at 50%: Anatomy answered most, then Cardiology,
    // then Biochem.
    expect(sorted.map((d) => d.name)).toEqual(['Anatomy', 'Cardiology', 'Biochem', 'Pathology'])
    expect(input.map((d) => d.name)).toEqual(['Pathology', 'Cardiology', 'Anatomy', 'Biochem'])
  })
})

describe('describeCorrect', () => {
  it('reads naturally', () => {
    expect(describeCorrect(7, 10)).toBe('7 of 10 correct')
    expect(describeCorrect(1, 1)).toBe('1 of 1 correct')
  })
})
