import type { Metadata } from 'next'
import Link from 'next/link'

import { ProgressNotice } from '@/components/flashcards/progress-notice'
import { liftOnHover } from '@/components/motion'
import { Container, EmptyState, PageHeading } from '@/components/site-chrome'
import { pageMetadata } from '@/lib/seo'
import { listDomains, listFlashcardTopics, type FlashcardTopic } from '@/server/public-queries'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Flashcards',
  description:
    'Spaced-repetition flashcards for medical learners, organised by topic. Progress is saved in your browser.',
  path: '/flashcards',
})

export default async function FlashcardsPage() {
  const [topics, domains] = await Promise.all([listFlashcardTopics(), listDomains()])

  // Domains in their display order; topics keep their own order inside each one.
  const groups = domains
    .map((domain) => ({
      domain,
      topics: topics.filter((topic) => topic.domain.id === domain.id),
    }))
    .filter((group) => group.topics.length > 0)

  return (
    <Container>
      <PageHeading
        eyebrow="Flashcards"
        title="Study with spaced repetition"
        description="Pick a topic. Cards you find hard come back sooner; cards you know come back less and less often."
      />
      <ProgressNotice />

      {groups.length === 0 ? (
        <div className="pt-8">
          <EmptyState title="No flashcards yet">Published flashcards will appear here.</EmptyState>
        </div>
      ) : (
        groups.map(({ domain, topics: domainTopics }) => (
          <section key={domain.id} className="space-y-3 pt-8 sm:pt-10">
            <h2 className="text-xl font-semibold tracking-tight">{domain.name}</h2>
            <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {domainTopics.map((topic) => (
                <li key={topic.id}>
                  <TopicLink topic={topic} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Container>
  )
}

function TopicLink({ topic }: { topic: FlashcardTopic }) {
  return (
    <Link
      href={`/flashcards/${topic.slug}`}
      className={`flex h-full flex-col gap-1 rounded-xl border border-slate-200 p-4 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700 ${liftOnHover}`}
    >
      <span className="font-semibold">{topic.name}</span>
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {topic.cardCount} {topic.cardCount === 1 ? 'card' : 'cards'}
      </span>
    </Link>
  )
}
