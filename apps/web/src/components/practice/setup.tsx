'use client'

import type { QuestionFilter } from '@medipedia/shared'
import { useState } from 'react'

import { pressable, sheen } from '@/components/motion'
import { pruneTopics, topicsFor, type PracticeOptions } from '@/lib/practice'

export type PracticeChoice = {
  domains: string[]
  topics: string[]
  filter: QuestionFilter
}

const FILTERS: ReadonlyArray<{ value: QuestionFilter; label: string; hint: string }> = [
  { value: 'unused', label: 'Unused', hint: 'Questions you have not answered yet' },
  { value: 'incorrect', label: 'Incorrect', hint: 'Questions you got wrong last time' },
  { value: 'all', label: 'All', hint: 'Everything, including ones you have answered' },
]

const toggle = (list: readonly string[], value: string): string[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

function Chip({
  selected,
  onClick,
  children,
  count,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  count: number
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors duration-150 sm:py-1.5 ${
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-950'
      }`}
    >
      {children}
      <span
        className={`text-xs ${selected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {count}
      </span>
    </button>
  )
}

/** Choose what to practise. Nothing chosen means everything. */
export function PracticeSetup({
  options,
  initial,
  busy,
  onStart,
}: {
  options: PracticeOptions
  initial: PracticeChoice
  busy: boolean
  onStart: (choice: PracticeChoice) => void
}) {
  const [domains, setDomains] = useState(initial.domains)
  const [topics, setTopics] = useState(initial.topics)
  const [filter, setFilter] = useState(initial.filter)

  const offeredTopics = topicsFor(options, domains)

  function toggleDomain(slug: string) {
    const next = toggle(domains, slug)
    setDomains(next)
    // A topic of a domain that was just deselected must go too (the API wants both to match).
    setTopics((current) => pruneTopics(options, next, current))
  }

  return (
    <form
      className="space-y-8 pb-4"
      onSubmit={(event) => {
        event.preventDefault()
        onStart({ domains, topics, filter })
      }}
    >
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold tracking-tight">Domains</legend>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Pick one or more, or leave all unselected to practise everything.
        </p>
        <div className="flex flex-wrap gap-2">
          {options.domains.map((domain) => (
            <Chip
              key={domain.slug}
              selected={domains.includes(domain.slug)}
              count={domain.count}
              onClick={() => toggleDomain(domain.slug)}
            >
              {domain.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold tracking-tight">Topics</legend>
        <div className="flex flex-wrap gap-2">
          {offeredTopics.map((topic) => (
            <Chip
              key={topic.slug}
              selected={topics.includes(topic.slug)}
              count={topic.count}
              onClick={() => setTopics((current) => toggle(current, topic.slug))}
            >
              {topic.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold tracking-tight">Which questions</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {FILTERS.map((item) => (
            <label
              key={item.value}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
                filter === item.value
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                  : 'border-slate-200 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700'
              }`}
            >
              <input
                type="radio"
                name="filter"
                value={item.value}
                checked={filter === item.value}
                onChange={() => setFilter(item.value)}
                className="sr-only"
              />
              <span className="font-medium">{item.label}</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">{item.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        className={`w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-8 ${pressable} ${sheen}`}
      >
        {busy ? 'Finding a question…' : 'Start practising'}
      </button>
    </form>
  )
}
