import { describe, expect, it } from 'vitest'

import { AGAIN_GAP, NEW_CARDS_PER_SESSION, planSession, requeue } from './session'
import {
  INITIAL_EASE,
  MIN_EASE,
  addDays,
  dayKey,
  daysBetween,
  formatInterval,
  isDue,
  previewIntervals,
  review,
  type ReviewState,
} from './sm2'
import { createMemoryStore } from './store'

const TODAY = '2026-11-23'

const state = (cardId: string, overrides: Partial<ReviewState> = {}): ReviewState => ({
  cardId,
  ease: INITIAL_EASE,
  intervalDays: 6,
  repetitions: 2,
  lapses: 0,
  due: TODAY,
  lastReviewed: '2026-11-17',
  ...overrides,
})

describe('days', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-11-23', '2026-11-30')).toBe(7)
    expect(daysBetween('2026-11-23', '2026-11-23')).toBe(0)
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3)
  })

  it('compares due days as strings', () => {
    expect(isDue(state('a', { due: '2026-11-22' }), TODAY)).toBe(true)
    expect(isDue(state('a', { due: TODAY }), TODAY)).toBe(true)
    expect(isDue(state('a', { due: '2026-11-24' }), TODAY)).toBe(false)
  })
})

describe('review (SM-2)', () => {
  it('schedules a first good answer for tomorrow, then six days, then by the ease', () => {
    const first = review('c', null, 'good', TODAY)
    expect(first).toMatchObject({ intervalDays: 1, repetitions: 1, due: '2026-11-24', lapses: 0 })
    expect(first.ease).toBeCloseTo(INITIAL_EASE)

    const second = review('c', first, 'good', '2026-11-24')
    expect(second).toMatchObject({ intervalDays: 6, repetitions: 2, due: '2026-11-30' })

    const third = review('c', second, 'good', '2026-11-30')
    expect(third.intervalDays).toBe(Math.round(6 * INITIAL_EASE))
    expect(third.repetitions).toBe(3)
  })

  it('raises the ease on easy and lowers it on hard', () => {
    expect(review('c', null, 'easy', TODAY).ease).toBeCloseTo(INITIAL_EASE + 0.1)
    expect(review('c', null, 'hard', TODAY).ease).toBeCloseTo(INITIAL_EASE - 0.14)
  })

  it('never lets the ease fall below the minimum', () => {
    let current: ReviewState | null = null
    for (let i = 0; i < 30; i += 1) current = review('c', current, 'hard', TODAY)
    expect(current?.ease).toBe(MIN_EASE)
  })

  it('restarts a missed card at one day, counts the lapse and keeps the ease', () => {
    const known = state('c', { ease: 2.1, intervalDays: 40, repetitions: 5 })
    const missed = review('c', known, 'again', TODAY)
    expect(missed).toMatchObject({
      intervalDays: 1,
      repetitions: 0,
      lapses: 1,
      due: '2026-11-24',
      ease: 2.1,
    })
  })

  it('does not change the state it was given', () => {
    const before = state('c')
    const snapshot = { ...before }
    review('c', before, 'good', TODAY)
    expect(before).toEqual(snapshot)
  })

  it('previews the interval of every answer without touching anything', () => {
    const intervals = previewIntervals(state('c', { intervalDays: 10, repetitions: 3 }), TODAY)
    expect(intervals.again).toBe(1)
    expect(intervals.easy).toBeGreaterThan(intervals.good)
    expect(intervals.good).toBeGreaterThan(intervals.hard)
  })

  it('writes intervals people can read', () => {
    expect(formatInterval(1)).toBe('1 day')
    expect(formatInterval(6)).toBe('6 days')
    expect(formatInterval(21)).toBe('3 weeks')
    expect(formatInterval(90)).toBe('3 months')
    expect(formatInterval(365)).toBe('1 year')
    expect(formatInterval(800)).toBe('2.2 years')
  })
})

describe('planSession', () => {
  const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }))

  it('puts due cards first, oldest first, then new cards in order', () => {
    const states = new Map([
      ['d', state('d', { due: '2026-11-20' })],
      ['b', state('b', { due: '2026-11-22' })],
      ['e', state('e', { due: '2026-12-25' })],
    ])
    const plan = planSession(cards, states, TODAY)
    expect(plan.queue.map((card) => card.id)).toEqual(['d', 'b', 'a', 'c'])
    expect(plan).toMatchObject({
      dueCount: 2,
      newCount: 2,
      newDeferred: 0,
      scheduledCount: 1,
      nextDue: '2026-12-25',
    })
  })

  it('keeps authoring order for cards due on the same day', () => {
    const states = new Map(cards.map((card) => [card.id, state(card.id, { due: '2026-11-22' })]))
    expect(planSession(cards, states, TODAY).queue.map((card) => card.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
  })

  it('limits new cards per session and reports the rest as deferred', () => {
    const many = Array.from({ length: NEW_CARDS_PER_SESSION + 5 }, (_, i) => ({ id: `n${i}` }))
    const plan = planSession(many, new Map(), TODAY)
    expect(plan.newCount).toBe(NEW_CARDS_PER_SESSION)
    expect(plan.newDeferred).toBe(5)
    expect(plan.queue).toHaveLength(NEW_CARDS_PER_SESSION)
  })

  it('never limits due reviews', () => {
    const states = new Map(cards.map((card) => [card.id, state(card.id)]))
    expect(planSession(cards, states, TODAY, 0).queue).toHaveLength(5)
  })

  it('is empty with nothing due and nothing new, and says when the next card comes', () => {
    const states = new Map(cards.map((card) => [card.id, state(card.id, { due: '2026-11-26' })]))
    const plan = planSession(cards, states, TODAY)
    expect(plan.queue).toEqual([])
    expect(plan).toMatchObject({ scheduledCount: 5, nextDue: '2026-11-26' })
  })

  it('has no next due day for an empty topic', () => {
    expect(planSession([], new Map(), TODAY)).toMatchObject({ queue: [], nextDue: null })
  })
})

describe('requeue', () => {
  it('shows a missed card again after a few others', () => {
    expect(AGAIN_GAP).toBe(4)
    expect(requeue(['b', 'c', 'd', 'e', 'f', 'g'], 'a')).toEqual([
      'b',
      'c',
      'd',
      'e',
      'a',
      'f',
      'g',
    ])
  })

  it('puts it last when fewer cards are left than the gap', () => {
    expect(requeue(['b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    expect(requeue([], 'a')).toEqual(['a'])
  })

  it('leaves the original queue alone', () => {
    const queue = ['b', 'c']
    requeue(queue, 'a')
    expect(queue).toEqual(['b', 'c'])
  })
})

describe('memory store', () => {
  it('stores, reads back and deletes review state by card id', async () => {
    const store = createMemoryStore()
    await store.put(state('a'))
    await store.put(state('b', { ease: 1.9 }))

    const found = await store.getMany(['a', 'b', 'missing'])
    expect([...found.keys()].sort()).toEqual(['a', 'b'])
    expect(found.get('b')?.ease).toBe(1.9)

    await store.deleteMany(['a'])
    expect([...(await store.getMany(['a', 'b'])).keys()]).toEqual(['b'])
  })

  it('does not hand out the stored object itself', async () => {
    const store = createMemoryStore()
    const original = state('a')
    await store.put(original)
    original.ease = 1.3
    expect((await store.getMany(['a'])).get('a')?.ease).toBe(INITIAL_EASE)
  })

  it('says whether progress survives a reload', () => {
    expect(createMemoryStore().persistent).toBe(false)
  })
})
