import { WEAKEST_DOMAIN_MIN_ANSWERS, type DomainPerformance } from '@medipedia/shared'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { pressable, sheen } from '@/components/motion'
import { Breadcrumbs, Container, EmptyState, PageHeading } from '@/components/site-chrome'
import {
  accuracyTone,
  describeCorrect,
  formatPercent,
  sortByWeakest,
  type AccuracyTone,
} from '@/lib/analytics'
import { authenticateHeaders } from '@/server/auth/session'
import { getAnalytics } from '@/server/questions/analytics'

export const metadata: Metadata = {
  title: 'Your performance',
  robots: { index: false },
}

const BAR: Record<AccuracyTone, string> = {
  low: 'bg-red-500 dark:bg-red-400',
  mid: 'bg-amber-500 dark:bg-amber-400',
  high: 'bg-emerald-500 dark:bg-emerald-400',
}

export default async function AnalyticsPage() {
  // proxy.ts has already renewed an expired session (this path is under /practice).
  const user = await authenticateHeaders(await headers())
  if (!user) redirect('/sign-in?next=/practice/analytics')

  const { totals, byDomain, weakest } = await getAnalytics(user)
  const domains = sortByWeakest(byDomain)

  return (
    <Container>
      <Breadcrumbs
        items={[{ name: 'Practice', href: '/practice' }, { name: 'Your performance' }]}
      />
      <PageHeading
        eyebrow="Practice"
        title="Your performance"
        description="How you are doing by domain. Only your first answer to each question counts, so reading an explanation and trying again cannot inflate it."
      />

      {totals.attempts === 0 ? (
        <div className="space-y-4">
          <EmptyState title="Nothing answered yet">
            Answer a few practice questions and your results will appear here.
          </EmptyState>
          <PracticeLink>Start practising</PracticeLink>
        </div>
      ) : (
        <div className="space-y-10 pb-4">
          <dl className="stagger grid gap-3 sm:grid-cols-3">
            <Stat label="Accuracy" value={formatPercent(totals.accuracy)}>
              {describeCorrect(totals.correct, totals.answered)}
            </Stat>
            <Stat label="Questions answered" value={String(totals.answered)}>
              Different questions, first attempts
            </Stat>
            <Stat label="Total answers" value={String(totals.attempts)}>
              Including repeats
            </Stat>
          </dl>

          <section className="space-y-3" aria-labelledby="weakest">
            <h2 id="weakest" className="text-xl font-semibold tracking-tight">
              Where to focus
            </h2>
            {weakest.length > 0 ? (
              <ul className="stagger grid gap-3 sm:grid-cols-3">
                {weakest.map((domain) => (
                  <li
                    key={domain.id}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <p className="font-semibold">{domain.name}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatPercent(domain.accuracy)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {describeCorrect(domain.correct, domain.answered)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Once you have answered {WEAKEST_DOMAIN_MIN_ANSWERS} different questions in a domain,
                your lowest-scoring ones are listed here.
              </p>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="by-domain">
            <h2 id="by-domain" className="text-xl font-semibold tracking-tight">
              By domain
            </h2>
            <ul className="space-y-3">
              {domains.map((domain) => (
                <DomainRow key={domain.id} domain={domain} />
              ))}
            </ul>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sub-domains are counted in their parent domain.
            </p>
          </section>

          <PracticeLink>Keep practising</PracticeLink>
        </div>
      )}
    </Container>
  )
}

function Stat({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-sm text-slate-500 dark:text-slate-400">{children}</dd>
    </div>
  )
}

function DomainRow({ domain }: { domain: DomainPerformance }) {
  const percent = formatPercent(domain.accuracy)
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{domain.name}</span>
        <span className="shrink-0 text-sm text-slate-500 tabular-nums dark:text-slate-400">
          {percent} · {describeCorrect(domain.correct, domain.answered)}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${domain.name}: ${percent}, ${describeCorrect(domain.correct, domain.answered)}`}
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={`h-full rounded-full ${BAR[accuracyTone(domain.accuracy)]}`}
          style={{ width: `${Math.max(domain.accuracy * 100, 2)}%` }}
        />
      </div>
    </li>
  )
}

function PracticeLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="/practice"
      prefetch={false}
      className={`inline-block rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 sm:py-2.5 ${pressable} ${sheen}`}
    >
      {children}
    </Link>
  )
}
