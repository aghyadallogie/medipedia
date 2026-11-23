import Link from 'next/link'

import { CardGrid, LectureCard, PaperCard, VideoCard } from '@/components/cards'
import { Container, EmptyState, Section } from '@/components/site-chrome'
import { SITE_DESCRIPTION } from '@/lib/seo'
import { listDomains, listLectures, listPapers, listVideos } from '@/server/public-queries'

export const revalidate = 3600

export default async function HomePage() {
  const [domains, lectures, papers, videos] = await Promise.all([
    listDomains(),
    listLectures({ limit: 3 }),
    listPapers({ limit: 3 }),
    listVideos({ limit: 3 }),
  ])
  const topLevel = domains.filter((domain) => domain.parentId === null)
  const empty =
    lectures.items.length === 0 && papers.items.length === 0 && videos.items.length === 0

  return (
    <Container>
      <section className="space-y-6 pb-4 pt-16 sm:pt-24">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Learn medicine from sources you can check.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">{SITE_DESCRIPTION}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/lectures"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Browse lectures
          </Link>
          <Link
            href="/domains"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Explore by domain
          </Link>
        </div>
      </section>

      {topLevel.length > 0 ? (
        <Section title="Domains" href="/domains">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topLevel.map((domain) => (
              <li key={domain.id}>
                <Link
                  href={`/domains/${domain.slug}`}
                  className="block h-full rounded-xl border border-slate-200 p-4 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700"
                >
                  <span className="font-semibold">{domain.name}</span>
                  {domain.description ? (
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                      {domain.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {lectures.items.length > 0 ? (
        <Section title="Recent lectures" href="/lectures">
          <CardGrid>
            {lectures.items.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} />
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {papers.items.length > 0 ? (
        <Section title="Landmark papers" href="/papers">
          <CardGrid>
            {papers.items.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {videos.items.length > 0 ? (
        <Section title="Vetted videos" href="/videos">
          <CardGrid>
            {videos.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {empty ? (
        <div className="pt-10">
          <EmptyState title="Nothing published yet">
            Content appears here as soon as it is published from the admin panel.
          </EmptyState>
        </div>
      ) : null}
    </Container>
  )
}
