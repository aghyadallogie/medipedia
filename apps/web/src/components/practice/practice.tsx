'use client'

import { ApiClientError } from '@medipedia/api-client'
import type { AnswerResult, ChoiceLabel, Question } from '@medipedia/shared'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { Message } from '@/components/auth/ui'
import { pressable } from '@/components/motion'
import { PracticeSetup, type PracticeChoice } from '@/components/practice/setup'
import { QuestionView } from '@/components/practice/question-view'
import { EmptyState } from '@/components/site-chrome'
import type { PracticeOptions } from '@/lib/practice'
import { webApi } from '@/lib/web-api'

type View =
  | { kind: 'setup'; error: string | null }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | {
      kind: 'question'
      question: Question
      remaining: number
      selected: ChoiceLabel | null
      result: AnswerResult | null
      submitting: boolean
      error: string | null
    }

const DEFAULT_CHOICE: PracticeChoice = { domains: [], topics: [], filter: 'unused' }

function describe(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'network_error') {
      return 'Could not reach the server. Check your connection and try again.'
    }
    if (error.status === 429) return 'You are going too fast. Wait a moment and try again.'
  }
  return 'Something went wrong. Please try again.'
}

const SIGN_IN = '/sign-in?next=/practice'

/** The session has ended (signed out elsewhere, or the account is gone). */
const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiClientError && error.status === 401

/**
 * Tutor-mode practice (AGENTS.md §15): choose domains, topics and a filter, then answer one
 * question at a time and read the explanations straight away. Every call goes through the typed
 * API client, which renews an expired session once before giving up.
 */
export function Practice({ options }: { options: PracticeOptions }) {
  const router = useRouter()
  const [view, setView] = useState<View>({ kind: 'setup', error: null })
  const [choice, setChoice] = useState<PracticeChoice>(DEFAULT_CHOICE)
  const [tally, setTally] = useState({ answered: 0, correct: 0 })

  const fetchNext = useCallback(
    async (next: PracticeChoice) => {
      setChoice(next)
      setView({ kind: 'loading' })
      try {
        const found = await webApi().me.nextQuestion({
          ...(next.domains.length > 0 ? { domains: next.domains } : {}),
          ...(next.topics.length > 0 ? { topics: next.topics } : {}),
          filter: next.filter,
        })
        if (found.question === null) {
          setView({ kind: 'empty' })
          return
        }
        setView({
          kind: 'question',
          question: found.question,
          remaining: found.remaining,
          selected: null,
          result: null,
          submitting: false,
          error: null,
        })
      } catch (caught) {
        if (isUnauthorized(caught)) return router.push(SIGN_IN)
        setView({ kind: 'setup', error: describe(caught) })
      }
    },
    [router],
  )

  const select = useCallback((label: ChoiceLabel) => {
    setView((current) =>
      current.kind === 'question' && !current.result && !current.submitting
        ? { ...current, selected: label, error: null }
        : current,
    )
  }, [])

  const submit = useCallback(async () => {
    if (view.kind !== 'question' || !view.selected || view.result || view.submitting) return
    const { question, selected } = view
    setView({ ...view, submitting: true, error: null })
    try {
      const result = await webApi().questions.answer(question.id, selected)
      setTally((current) => ({
        answered: current.answered + 1,
        correct: current.correct + (result.isCorrect ? 1 : 0),
      }))
      setView((current) =>
        current.kind === 'question' && current.question.id === question.id
          ? { ...current, result, submitting: false }
          : current,
      )
    } catch (caught) {
      if (isUnauthorized(caught)) return router.push(SIGN_IN)
      setView((current) =>
        current.kind === 'question'
          ? { ...current, submitting: false, error: describe(caught) }
          : current,
      )
    }
  }, [view, router])

  const next = useCallback(() => void fetchNext(choice), [choice, fetchNext])
  const backToSetup = () => setView({ kind: 'setup', error: null })

  if (options.domains.length === 0) {
    return <EmptyState title="No questions yet">Published questions will appear here.</EmptyState>
  }

  return (
    <div className="space-y-5 pb-4">
      {view.kind === 'setup' || view.kind === 'loading' ? (
        <>
          {view.kind === 'setup' && view.error ? (
            <Message tone="error">{view.error}</Message>
          ) : null}
          <PracticeSetup
            options={options}
            initial={choice}
            busy={view.kind === 'loading'}
            onStart={(picked) => void fetchNext(picked)}
          />
        </>
      ) : null}

      {view.kind === 'empty' ? (
        <div className="space-y-4">
          <EmptyState title="No questions match">
            {choice.filter === 'unused'
              ? 'You have answered everything here. Try the Incorrect or All filter, or pick other domains.'
              : choice.filter === 'incorrect'
                ? 'Nothing here is marked incorrect. Pick other domains or try another filter.'
                : 'Try other domains or topics.'}
          </EmptyState>
          <button
            type="button"
            onClick={backToSetup}
            className={`rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${pressable}`}
          >
            Change what I practise
          </button>
        </div>
      ) : null}

      {view.kind === 'question' ? (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={backToSetup}
              className="text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
            >
              ← Change filters
            </button>
            <p className="text-slate-500 dark:text-slate-400" aria-live="polite">
              This session: {tally.correct} of {tally.answered} correct
            </p>
          </div>
          <QuestionView
            key={view.question.id}
            question={view.question}
            remaining={view.remaining}
            selected={view.selected}
            result={view.result}
            submitting={view.submitting}
            error={view.error}
            onSelect={select}
            onSubmit={() => void submit()}
            onNext={next}
          />
        </>
      ) : null}
    </div>
  )
}
