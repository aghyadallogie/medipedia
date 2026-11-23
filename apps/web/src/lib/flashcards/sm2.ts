/**
 * SM-2 spaced repetition, kept pure so it can be tested without a browser.
 *
 * Due dates are local calendar days ("2026-11-23"), not timestamps: a card reviewed at 3 pm with
 * a one-day interval is due tomorrow morning, not tomorrow at 3 pm. Day strings compare correctly
 * as plain strings.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy']

/** SM-2 rates recall 0 to 5. Four buttons map onto it the way most flashcard apps do. */
const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 }

export const INITIAL_EASE = 2.5
export const MIN_EASE = 1.3

/** What this browser remembers about one card. Keyed by the card's permanent id (AGENTS.md §9). */
export type ReviewState = {
  cardId: string
  /** The "E-factor": how much the interval grows after each successful review. */
  ease: number
  intervalDays: number
  /** Successful reviews in a row. A failed review resets it. */
  repetitions: number
  lapses: number
  /** Local day the card is next due, "YYYY-MM-DD". */
  due: string
  lastReviewed: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar day of `date`, "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `day` plus `days` calendar days. Uses UTC arithmetic, so daylight saving cannot shift it. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  const moved = new Date(Date.UTC(year, month - 1, date + days))
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const parse = (day: string) => {
    const [year, month, date] = day.split('-').map(Number) as [number, number, number]
    return Date.UTC(year, month - 1, date)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

export const isDue = (state: ReviewState, today: string): boolean => state.due <= today

/**
 * The state after answering `grade` on `today`. `previous` is null for a card seen for the first
 * time. A failed answer (`again`) restarts the card at a one-day interval and leaves the ease
 * alone, as SM-2 specifies; the study session shows it again straight away as well.
 */
export function review(
  cardId: string,
  previous: ReviewState | null,
  grade: Grade,
  today: string,
): ReviewState {
  const quality = QUALITY[grade]
  const ease = previous?.ease ?? INITIAL_EASE
  const repetitions = previous?.repetitions ?? 0
  const intervalDays = previous?.intervalDays ?? 0
  const lapses = previous?.lapses ?? 0

  if (quality < 3) {
    return {
      cardId,
      ease,
      intervalDays: 1,
      repetitions: 0,
      lapses: lapses + 1,
      due: addDays(today, 1),
      lastReviewed: today,
    }
  }

  const nextEase = Math.max(MIN_EASE, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  const nextInterval =
    repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(intervalDays * nextEase)

  return {
    cardId,
    ease: nextEase,
    intervalDays: nextInterval,
    repetitions: repetitions + 1,
    lapses,
    due: addDays(today, nextInterval),
    lastReviewed: today,
  }
}

/** The interval each answer would give, for the labels on the answer buttons. */
export function previewIntervals(
  previous: ReviewState | null,
  today: string,
): Record<Grade, number> {
  const result = {} as Record<Grade, number>
  for (const grade of GRADES) result[grade] = review('preview', previous, grade, today).intervalDays
  return result
}

/** "1 day", "6 days", "3 weeks", "2 months", "1.2 years". */
export function formatInterval(days: number): string {
  if (days < 14) return days === 1 ? '1 day' : `${days} days`
  if (days < 60) return `${Math.round(days / 7)} weeks`
  if (days < 365) return `${Math.round(days / 30)} months`
  const years = Math.round((days / 365) * 10) / 10
  return years === 1 ? '1 year' : `${years} years`
}
