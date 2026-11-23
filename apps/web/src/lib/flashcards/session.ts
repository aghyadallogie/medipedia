import { isDue, type ReviewState } from './sm2'

/** New cards introduced per study session, so a big topic does not bury a learner on day one. */
export const NEW_CARDS_PER_SESSION = 20

/** A card answered "again" comes back after this many other cards. */
export const AGAIN_GAP = 4

export type SessionPlan<T extends { id: string }> = {
  /** Cards to study now: due reviews first, oldest first, then new cards in authoring order. */
  queue: T[]
  dueCount: number
  newCount: number
  /** New cards left for another day because of the per-session limit. */
  newDeferred: number
  /** Cards that have been learned and are not due yet. */
  scheduledCount: number
  /** The earliest day a not-yet-due card comes round, or null when there is none. */
  nextDue: string | null
}

export function planSession<T extends { id: string }>(
  cards: readonly T[],
  states: ReadonlyMap<string, ReviewState>,
  today: string,
  newLimit: number = NEW_CARDS_PER_SESSION,
): SessionPlan<T> {
  const due: Array<{ card: T; state: ReviewState }> = []
  const fresh: T[] = []
  let scheduledCount = 0
  let nextDue: string | null = null

  for (const card of cards) {
    const state = states.get(card.id)
    if (!state) fresh.push(card)
    else if (isDue(state, today)) due.push({ card, state })
    else {
      scheduledCount += 1
      if (nextDue === null || state.due < nextDue) nextDue = state.due
    }
  }

  // Array.sort is stable, so cards due on the same day keep their authoring order.
  due.sort((a, b) => (a.state.due < b.state.due ? -1 : a.state.due > b.state.due ? 1 : 0))
  const introduced = fresh.slice(0, Math.max(0, newLimit))

  return {
    queue: [...due.map((entry) => entry.card), ...introduced],
    dueCount: due.length,
    newCount: introduced.length,
    newDeferred: fresh.length - introduced.length,
    scheduledCount,
    nextDue,
  }
}

/** Moves a missed card `gap` places further down the queue (or to the end, if it is shorter). */
export function requeue<T>(queue: readonly T[], card: T, gap: number = AGAIN_GAP): T[] {
  const next = [...queue]
  next.splice(Math.min(gap, next.length), 0, card)
  return next
}
