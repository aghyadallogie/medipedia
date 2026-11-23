import type { DomainPerformance } from '@medipedia/shared'

/** 0.8333 becomes "83%". Null (nothing answered yet) becomes an en dash. */
export function formatPercent(accuracy: number | null): string {
  return accuracy === null ? '–' : `${Math.round(accuracy * 100)}%`
}

export type AccuracyTone = 'low' | 'mid' | 'high'

/** Bands for colouring a bar: under 60% needs work, 80% and over is solid. */
export function accuracyTone(accuracy: number): AccuracyTone {
  if (accuracy < 0.6) return 'low'
  if (accuracy < 0.8) return 'mid'
  return 'high'
}

/** Weakest first, so the domains to work on lead the list. Ties: more answers first, then name. */
export function sortByWeakest(domains: readonly DomainPerformance[]): DomainPerformance[] {
  return [...domains].sort(
    (a, b) => a.accuracy - b.accuracy || b.answered - a.answered || a.name.localeCompare(b.name),
  )
}

/** "7 of 10 correct", "1 of 1 correct". */
export const describeCorrect = (correct: number, answered: number): string =>
  `${correct} of ${answered} correct`
