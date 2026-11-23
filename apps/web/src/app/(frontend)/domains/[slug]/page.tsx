import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CardGrid, LectureCard, PaperCard, VideoCard } from '@/components/cards'
import { JsonLd } from '@/components/json-ld'
import { LoadMore } from '@/components/load-more'
import { Breadcrumbs, Container, EmptyState, PageHeading, Section } from '@/components/site-chrome'
import { PAGE_SIZE } from '@/lib/constants'
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo'
import {
  getDomain,
  listDomains,
  listLectures,
  listPapers,
  listTopics,
  listVideos,
} from '@/server/public-queries'

export const revalidate = 3600

// Rendered on first request, then cached and refreshed when the domain or its content changes.
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const domain = await getDomain((await params).slug)
  if (!domain) return { title: 'Domain not found' }
  return pageMetadata({
    title: domain.name,
    description: domain.description ?? `Lectures, papers and videos on ${domain.name}.`,
    path: `/domains/${domain.slug}`,
  })
}

export default async function DomainPage({ params }: Props) {
  const { slug } = await params
  const domain = await getDomain(slug)
  if (!domain) notFound()

  const [allDomains, topics, lectures, papers, videos] = await Promise.all([
    listDomains(),
    listTopics({ domain: domain.slug }),
    listLectures({ domain: domain.slug, limit: PAGE_SIZE }),
    listPapers({ domain: domain.slug, limit: PAGE_SIZE }),
    listVideos({ domain: domain.slug, limit: PAGE_SIZE }),
  ])

  const parent = allDomains.find((candidate) => candidate.id === domain.parentId) ?? null
  const children = allDomains.filter((candidate) => candidate.parentId === domain.id)
  const empty =
    lectures.items.length === 0 && papers.items.length === 0 && videos.items.length === 0

  const crumbs = [
    { name: 'Domains', href: '/domains' },
    ...(parent ? [{ name: parent.name, href: `/domains/${parent.slug}` }] : []),
    { name: domain.name },
  ]

  return (
    <Container>
      <Breadcrumbs items={crumbs} />
      <PageHeading eyebrow="Domain" title={domain.name} description={domain.description} />

      {children.length > 0 ? (
        <nav aria-label="Sub-domains" className="flex flex-wrap gap-2 pb-2">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/domains/${child.slug}`}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-brand-400 dark:border-slate-700"
            >
              {child.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {topics.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 pb-2" aria-label="Topics">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {topic.name}
            </li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        <div className="pt-8">
          <EmptyState title={`Nothing published in ${domain.name} yet`} />
        </div>
      ) : null}

      {lectures.items.length > 0 ? (
        <Section title="Lectures">
          <CardGrid>
            {lectures.items.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} />
            ))}
          </CardGrid>
          <LoadMore
            kind="lectures"
            domain={domain.slug}
            initialCursor={lectures.nextCursor}
            pageSize={PAGE_SIZE}
          />
        </Section>
      ) : null}

      {papers.items.length > 0 ? (
        <Section title="Papers">
          <CardGrid>
            {papers.items.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </CardGrid>
          <LoadMore
            kind="papers"
            domain={domain.slug}
            initialCursor={papers.nextCursor}
            pageSize={PAGE_SIZE}
          />
        </Section>
      ) : null}

      {videos.items.length > 0 ? (
        <Section title="Videos">
          <CardGrid>
            {videos.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </CardGrid>
          <LoadMore
            kind="videos"
            domain={domain.slug}
            initialCursor={videos.nextCursor}
            pageSize={PAGE_SIZE}
          />
        </Section>
      ) : null}

      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Domains', path: '/domains' },
          ...(parent ? [{ name: parent.name, path: `/domains/${parent.slug}` }] : []),
          { name: domain.name, path: `/domains/${domain.slug}` },
        ])}
      />
    </Container>
  )
}
