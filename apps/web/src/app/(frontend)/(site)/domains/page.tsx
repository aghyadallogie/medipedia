import type { Domain, Topic } from '@medipedia/shared'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, EmptyState, PageHeading } from '@/components/site-chrome'
import { pageMetadata } from '@/lib/seo'
import { listDomains, listTopics } from '@/server/public-queries'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Domains and topics',
  description: 'Browse everything by medical domain and topic.',
  path: '/domains',
})

function TopicList({ topics }: { topics: readonly Topic[] }) {
  if (topics.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
      {topics.map((topic) => (
        <li
          key={topic.id}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {topic.name}
        </li>
      ))}
    </ul>
  )
}

export default async function DomainsPage() {
  const [domains, topics] = await Promise.all([listDomains(), listTopics()])

  const topicsByDomain = new Map<string, Topic[]>()
  for (const topic of topics) {
    const list = topicsByDomain.get(topic.domain.id) ?? []
    list.push(topic)
    topicsByDomain.set(topic.domain.id, list)
  }

  const childrenByParent = new Map<string, Domain[]>()
  for (const domain of domains) {
    if (domain.parentId === null) continue
    const list = childrenByParent.get(domain.parentId) ?? []
    list.push(domain)
    childrenByParent.set(domain.parentId, list)
  }
  const topLevel = domains.filter((domain) => domain.parentId === null)

  return (
    <Container>
      <PageHeading
        eyebrow="Browse"
        title="Domains and topics"
        description="Everything on the site is organised by domain. Topics are the finer subjects inside each one."
      />
      {topLevel.length === 0 ? (
        <EmptyState title="No domains yet">Domains appear here once they are created.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {topLevel.map((domain) => (
            <li
              key={domain.id}
              className="space-y-3 rounded-xl border border-slate-200 p-5 dark:border-slate-800"
            >
              <h2 className="text-lg font-semibold">
                <Link
                  href={`/domains/${domain.slug}`}
                  className="hover:text-brand-700 hover:underline dark:hover:text-brand-300"
                >
                  {domain.name}
                </Link>
              </h2>
              {domain.description ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">{domain.description}</p>
              ) : null}
              <TopicList topics={topicsByDomain.get(domain.id) ?? []} />

              {(childrenByParent.get(domain.id) ?? []).map((child) => (
                <div
                  key={child.id}
                  className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800"
                >
                  <h3 className="text-sm font-semibold">
                    <Link
                      href={`/domains/${child.slug}`}
                      className="hover:text-brand-700 hover:underline dark:hover:text-brand-300"
                    >
                      {child.name}
                    </Link>
                  </h3>
                  <TopicList topics={topicsByDomain.get(child.id) ?? []} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}
