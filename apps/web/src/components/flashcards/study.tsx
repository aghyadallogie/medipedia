'use client'

import type { Flashcard } from '@medipedia/shared'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ProgressNotice } from '@/components/flashcards/progress-notice'
import { pressable, sheen } from '@/components/motion'
import { RichText } from '@/components/rich-text'
import { planSession, requeue, type SessionPlan } from '@/lib/flashcards/session'
import {
  GRADES,
  dayKey,
  daysBetween,
  formatInterval,
  previewIntervals,
  review,
  type Grade,
  type ReviewState,
} from '@/lib/flashcards/sm2'
import { openReviewStore, type ReviewStore } from '@/lib/flashcards/store'
import { webApi } from '@/lib/web-api'

type Props = { topic: { slug: string; name: string; cardCount: number } }

type Loaded = {
  cards: Flashcard[]
  store: ReviewStore
  states: Map<string, ReviewState>
}

type Load = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & Loaded)

const FETCH_LIMIT = 100

const GRADE_LABEL: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

const GRADE_STYLE: Record<Grade, string> = {
  again:
    'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950',
  hard: 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950',
  good: 'border-brand-300 text-brand-800 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-200 dark:hover:bg-brand-950',
  easy: 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950',
}

/** Every published card of the topic, a page at a time through the typed API client. */
async function fetchAllCards(topic: string): Promise<Flashcard[]> {
  const api = webApi()
  const cards: Flashcard[] = []
  let cursor: string | undefined
  do {
    const page = await api.flashcards.list({
      topic,
      limit: FETCH_LIMIT,
      ...(cursor ? { cursor } : {}),
    })
    cards.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return cards
}

/**
 * Studies one topic. Cards come from the public API; the schedule lives in this browser only
 * (IndexedDB), keyed by card id, and is worked out with SM-2 (AGENTS.md §9).
 */
export function FlashcardStudy({ topic }: Props) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cards, store] = await Promise.all([fetchAllCards(topic.slug), openReviewStore()])
        const states = await store.getMany(cards.map((card) => card.id))
        if (!cancelled) setLoad({ status: 'ready', cards, store, states })
      } catch {
        if (!cancelled) setLoad({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [topic.slug, attempt])

  if (load.status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="space-y-4 pt-6"
        aria-label={`Loading ${topic.cardCount} flashcards`}
      >
        <div className="h-2 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        <span className="sr-only">Loading flashcards…</span>
      </div>
    )
  }

  if (load.status === 'error') {
    return (
      <div role="alert" className="space-y-3 pt-6">
        <p className="text-red-600 dark:text-red-400">
          Could not load the flashcards. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoad({ status: 'loading' })
            setAttempt((n) => n + 1)
          }}
          className={`rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${pressable}`}
        >
          Try again
        </button>
      </div>
    )
  }

  return <Session topicName={topic.name} loaded={load} />
}

function Session({ topicName, loaded }: { topicName: string; loaded: Loaded }) {
  const { cards, store, states } = loaded

  const [initialPlan] = useState(() => planSession(cards, states, dayKey(new Date())))
  const [plan, setPlan] = useState<SessionPlan<Flashcard>>(initialPlan)
  const [queue, setQueue] = useState<Flashcard[]>(initialPlan.queue)
  const [total, setTotal] = useState(initialPlan.queue.length)
  const [revealed, setRevealed] = useState(false)
  const [answered, setAnswered] = useState(0)
  const [missed, setMissed] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const current = queue[0]

  const startSession = useCallback(() => {
    const next = planSession(cards, states, dayKey(new Date()))
    setPlan(next)
    setQueue(next.queue)
    setTotal(next.queue.length)
    setAnswered(0)
    setMissed(0)
    setRevealed(false)
    setConfirmReset(false)
  }, [cards, states])

  const answer = useCallback(
    (grade: Grade) => {
      const card = queue[0]
      if (!card) return
      const next = review(card.id, states.get(card.id) ?? null, grade, dayKey(new Date()))
      states.set(card.id, next)
      store.put(next).catch(() => setSaveFailed(true))

      const rest = queue.slice(1)
      setQueue(grade === 'again' ? requeue(rest, card) : rest)
      setAnswered((n) => n + 1)
      if (grade === 'again') setMissed((n) => n + 1)
      setRevealed(false)
    },
    [queue, states, store],
  )

  async function resetProgress() {
    try {
      await store.deleteMany(cards.map((card) => card.id))
      states.clear()
      setSaveFailed(false)
      startSession()
    } catch {
      setSaveFailed(true)
      setConfirmReset(false)
    }
  }

  // Keyboard: Space or Enter shows the answer, 1 to 4 grades it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || !current) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))
      ) {
        return
      }
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        const grade = GRADES[Number(event.key) - 1]
        if (grade) answer(grade)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, revealed, answer])

  return (
    <div className="space-y-4 pb-4">
      <ProgressNotice />
      {!store.persistent ? (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          This browser is not letting the site store data, so your progress will be lost when you
          close this tab.
        </p>
      ) : null}
      {saveFailed ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          Your last answer could not be saved in this browser.
        </p>
      ) : null}

      {current ? (
        <StudyCard
          key={current.id}
          card={current}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onAnswer={answer}
          state={states.get(current.id) ?? null}
          done={total - queue.length}
          total={total}
          plan={plan}
        />
      ) : (
        <Finished
          topicName={topicName}
          cards={cards}
          states={states}
          answered={answered}
          reviewed={total}
          missed={missed}
          onStudyMore={startSession}
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-2 text-sm">
        <Link
          href="/flashcards"
          className="text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
        >
          ← All topics
        </Link>
        {confirmReset ? (
          <span className="flex items-center gap-3">
            <span className="text-slate-600 dark:text-slate-300">
              Erase progress for this topic?
            </span>
            <button
              type="button"
              onClick={resetProgress}
              className="font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Erase
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="text-slate-500 hover:underline dark:text-slate-400"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
          >
            Reset progress
          </button>
        )}
      </div>
    </div>
  )
}

type StudyCardProps = {
  card: Flashcard
  revealed: boolean
  onReveal: () => void
  onAnswer: (grade: Grade) => void
  state: ReviewState | null
  done: number
  total: number
  plan: SessionPlan<Flashcard>
}

function StudyCard({
  card,
  revealed,
  onReveal,
  onAnswer,
  state,
  done,
  total,
  plan,
}: StudyCardProps) {
  const answerRef = useRef<HTMLDivElement>(null)
  const intervals = previewIntervals(state, dayKey(new Date()))

  // Keep the revealed answer in view on a small screen, and tell screen readers about it.
  useEffect(() => {
    if (revealed) answerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [revealed])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {done} of {total} done
          </span>
          <span>
            {plan.dueCount > 0 ? `${plan.dueCount} due` : null}
            {plan.dueCount > 0 && plan.newCount > 0 ? ' · ' : null}
            {plan.newCount > 0 ? `${plan.newCount} new` : null}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
            style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
          />
        </div>
      </div>

      <article
        aria-label="Flashcard"
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Question
          </p>
          <p className="whitespace-pre-wrap break-words text-lg leading-relaxed sm:text-xl">
            {card.front}
          </p>
          {card.frontImage ? (
            <Image
              src={card.frontImage.url}
              alt={card.frontImage.alt}
              width={card.frontImage.width ?? 800}
              height={card.frontImage.height ?? 600}
              sizes="(min-width: 640px) 640px, 100vw"
              className="mt-4 h-auto max-h-72 w-auto max-w-full rounded-lg"
            />
          ) : null}
        </div>

        {revealed ? (
          <div
            ref={answerRef}
            className="border-t border-slate-200 pt-5 animate-fade-in dark:border-slate-800"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Answer
            </p>
            {card.back ? (
              <RichText content={card.back} />
            ) : (
              <p className="text-slate-500 dark:text-slate-400">This card has no answer yet.</p>
            )}
          </div>
        ) : null}
      </article>

      {revealed ? (
        <div
          role="group"
          aria-label="How well did you remember it?"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {GRADES.map((grade, index) => (
            <button
              key={grade}
              type="button"
              onClick={() => onAnswer(grade)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-sm font-medium ${GRADE_STYLE[grade]} ${pressable}`}
            >
              <span>
                {GRADE_LABEL[grade]}{' '}
                <kbd className="hidden text-xs font-normal opacity-60 sm:inline">{index + 1}</kbd>
              </span>
              <span className="text-xs font-normal opacity-75">
                {grade === 'again' ? 'soon' : formatInterval(intervals[grade])}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className={`w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 ${pressable} ${sheen}`}
        >
          Show answer{' '}
          <kbd className="ml-1 hidden text-xs font-normal opacity-70 sm:inline">Space</kbd>
        </button>
      )}
    </div>
  )
}

function Finished({
  topicName,
  cards,
  states,
  answered,
  reviewed,
  missed,
  onStudyMore,
}: {
  topicName: string
  cards: Flashcard[]
  states: Map<string, ReviewState>
  /** Answers given, including repeats of missed cards. */
  answered: number
  /** Different cards in the session. */
  reviewed: number
  missed: number
  onStudyMore: () => void
}) {
  const today = dayKey(new Date())
  const upcoming = planSession(cards, states, today)
  const moreAvailable = upcoming.queue.length
  const nextInDays = upcoming.nextDue ? daysBetween(today, upcoming.nextDue) : null

  return (
    <section
      role="status"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center animate-fade-in sm:p-10 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-xl font-semibold tracking-tight">
        {answered > 0 ? 'Session complete' : 'You are all caught up'}
      </h2>
      <p className="text-slate-600 dark:text-slate-300">
        {answered > 0
          ? `You reviewed ${reviewed} ${reviewed === 1 ? 'card' : 'cards'} in ${topicName}${
              missed > 0 ? `, and missed ${missed} ${missed === 1 ? 'time' : 'times'}` : ''
            }.`
          : `Nothing in ${topicName} is due right now.`}
      </p>
      {nextInDays !== null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {upcoming.scheduledCount} {upcoming.scheduledCount === 1 ? 'card is' : 'cards are'}{' '}
          scheduled. The next one is due{' '}
          {nextInDays <= 1 ? 'tomorrow' : `in ${formatInterval(nextInDays)}`}.
        </p>
      ) : null}
      {moreAvailable > 0 ? (
        <button
          type="button"
          onClick={onStudyMore}
          className={`rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 ${pressable} ${sheen}`}
        >
          Study {moreAvailable} more {moreAvailable === 1 ? 'card' : 'cards'}
        </button>
      ) : null}
    </section>
  )
}
