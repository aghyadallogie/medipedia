'use client'

import type { AnswerResult, ChoiceLabel, Question } from '@medipedia/shared'
import { useEffect, useRef } from 'react'

import { Message, Spinner } from '@/components/auth/ui'
import { pressable, sheen } from '@/components/motion'
import { RichText } from '@/components/rich-text'
import { choiceForKey, isHttpUrl } from '@/lib/practice'

type Props = {
  question: Question
  remaining: number
  selected: ChoiceLabel | null
  result: AnswerResult | null
  submitting: boolean
  error: string | null
  onSelect: (label: ChoiceLabel) => void
  onSubmit: () => void
  onNext: () => void
}

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const

/** One question: the choices, then (after answering) the verdict and every explanation. */
export function QuestionView({
  question,
  remaining,
  selected,
  result,
  submitting,
  error,
  onSelect,
  onSubmit,
  onNext,
}: Props) {
  const resultRef = useRef<HTMLDivElement>(null)
  const labels = question.choices.map((choice) => choice.label)
  const answered = result !== null

  // Bring the verdict into view on a small screen, where the explanations start below the fold.
  useEffect(() => {
    if (answered) resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [answered])

  // Keyboard: a letter picks that choice, Enter submits, then Enter moves on.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))
      ) {
        return
      }
      if (answered) {
        if (event.key === 'Enter') {
          event.preventDefault()
          onNext()
        }
        return
      }
      const choice = choiceForKey(event.key, labels)
      if (choice) onSelect(choice)
      else if (event.key === 'Enter' && selected && !submitting) {
        event.preventDefault()
        onSubmit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [answered, labels, onNext, onSelect, onSubmit, selected, submitting])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <p className="font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {question.domain.name} · {question.topic.name} · {DIFFICULTY_LABEL[question.difficulty]}
        </p>
        <p>
          {remaining} {remaining === 1 ? 'question' : 'questions'} in this set
        </p>
      </div>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <RichText content={question.vignette} />
        <p id="question-stem" className="text-lg font-semibold leading-snug">
          {question.stem}
        </p>

        <div
          role="radiogroup"
          aria-labelledby="question-stem"
          className="space-y-2"
          aria-disabled={answered}
        >
          {question.choices.map((choice) => {
            const verdict = result?.choices.find((entry) => entry.label === choice.label)
            const picked = selected === choice.label
            const state = !verdict
              ? picked
                ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-slate-800/60'
              : verdict.isCorrect
                ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                : picked
                  ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/40'
                  : 'border-slate-200 opacity-80 dark:border-slate-800'

            return (
              <div key={choice.label} className="space-y-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={answered}
                  onClick={() => onSelect(choice.label)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-150 disabled:cursor-default ${state}`}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full border border-current text-sm font-semibold"
                  >
                    {choice.label}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 break-words">{choice.text}</span>
                  {verdict ? (
                    <span className="shrink-0 pt-0.5 text-sm font-medium">
                      {verdict.isCorrect ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          ✓ Correct answer
                        </span>
                      ) : picked ? (
                        <span className="text-red-700 dark:text-red-300">✗ Your answer</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
                {verdict && verdict.explanation.html.trim() !== '' ? (
                  <div className="ml-10 text-sm text-slate-700 dark:text-slate-300">
                    <RichText content={verdict.explanation} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </article>

      {error ? <Message tone="error">{error}</Message> : null}

      {result ? (
        <div ref={resultRef} className="scroll-mt-20 space-y-5 animate-fade-in">
          <Message tone={result.isCorrect ? 'success' : 'error'}>
            {result.isCorrect
              ? 'Correct.'
              : `Incorrect. The correct answer is ${result.correctLabel}.`}
            {!result.isFirstAttempt
              ? ' You have answered this before, so it does not change your accuracy.'
              : ''}
          </Message>

          {result.overallExplanation.html.trim() !== '' ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Explanation</h2>
              <RichText content={result.overallExplanation} />
            </section>
          ) : null}

          {result.citations.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Sources</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {result.citations.map((citation) => (
                  <li key={`${citation.url}-${citation.label}`}>
                    {isHttpUrl(citation.url) ? (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 underline underline-offset-2 dark:text-brand-300"
                      >
                        {citation.label}
                      </a>
                    ) : (
                      citation.label
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <button
            type="button"
            onClick={onNext}
            className={`w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 sm:w-auto sm:px-8 ${pressable} ${sheen}`}
          >
            Next question{' '}
            <kbd className="ml-1 hidden text-xs font-normal opacity-70 sm:inline">Enter</kbd>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selected || submitting}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 sm:w-auto sm:px-8 ${pressable} ${sheen}`}
        >
          {submitting ? <Spinner /> : null}
          {submitting ? 'Checking…' : 'Submit answer'}
          {!submitting ? (
            <kbd className="ml-1 hidden text-xs font-normal opacity-70 sm:inline">Enter</kbd>
          ) : null}
        </button>
      )}
    </div>
  )
}
