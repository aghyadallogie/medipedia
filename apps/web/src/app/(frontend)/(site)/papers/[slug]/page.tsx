import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RelevanceDots } from '@/components/cards'
import { JsonLd } from '@/components/json-ld'
import { RichText } from '@/components/rich-text'
import { Breadcrumbs, Container, DetailTitle } from '@/components/site-chrome'
import { breadcrumbJsonLd, pageMetadata, paperJsonLd, plainText } from '@/lib/seo'
import { assertCanRead } from '@/server/access-tier'
import { getPaper } from '@/server/public-queries'

export const revalidate = 3600

// Rendered on first request, then cached and refreshed when the paper is published.
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = await getPaper((await params).slug)
  if (!paper) return { title: 'Paper not found' }
  return pageMetadata({
    title: paper.title,
    description: plainText(paper.sparkNotes.html, 160) || plainText(paper.abstract.html, 160),
    path: `/papers/${paper.slug}`,
    type: 'article',
  })
}

function Fact({
  label,
  wide = false,
  children,
}: {
  label: string
  /** Spans both columns. For values that can be long: authors, DOIs, links. */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

const externalLink = 'text-brand-700 underline underline-offset-2 dark:text-brand-300'

export default async function PaperPage({ params }: Props) {
  const paper = await getPaper((await params).slug)
  if (!paper) notFound()
  assertCanRead(null, paper)

  return (
    <Container className="max-w-3xl">
      <Breadcrumbs items={[{ name: 'Papers', href: '/papers' }, { name: paper.title }]} />
      <article className="space-y-10 pb-4 pt-6">
        <header className="space-y-4">
          {paper.domain ? (
            <Link
              href={`/domains/${paper.domain.slug}`}
              className="text-sm font-medium uppercase tracking-wide text-brand-700 hover:underline dark:text-brand-300"
            >
              {paper.domain.name}
            </Link>
          ) : null}
          <DetailTitle>{paper.title}</DetailTitle>

          {/* Two columns on every screen: short facts pair up, long ones span both. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 p-4 sm:gap-x-8 dark:border-slate-800">
            <Fact label="Authors" wide>
              {paper.authors.join(', ')}
            </Fact>
            {paper.journal ? <Fact label="Journal">{paper.journal}</Fact> : null}
            {paper.year ? <Fact label="Year">{paper.year}</Fact> : null}
            {paper.clinicalRelevance ? (
              <Fact label="Clinical relevance">
                <RelevanceDots value={paper.clinicalRelevance} />
              </Fact>
            ) : null}
            {paper.citationCount !== null ? (
              <Fact label="Citations">{paper.citationCount.toLocaleString('en')}</Fact>
            ) : null}
            {paper.leadAuthorHIndex !== null ? (
              <Fact label="Lead author h-index">{paper.leadAuthorHIndex}</Fact>
            ) : null}
            {paper.doi ? (
              <Fact label="DOI" wide>
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLink}
                >
                  {paper.doi}
                </a>
              </Fact>
            ) : null}
            {paper.pubmedUrl ? (
              <Fact label="PubMed" wide>
                <a
                  href={paper.pubmedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLink}
                >
                  View on PubMed
                </a>
              </Fact>
            ) : null}
          </dl>
        </header>

        <section aria-labelledby="spark-notes" className="space-y-3">
          <h2 id="spark-notes" className="text-xl font-semibold tracking-tight">
            Spark notes
          </h2>
          <RichText content={paper.sparkNotes} />
        </section>

        <section aria-labelledby="abstract" className="space-y-3">
          <h2 id="abstract" className="text-xl font-semibold tracking-tight">
            Abstract
          </h2>
          <RichText content={paper.abstract} />
        </section>
      </article>

      <JsonLd data={paperJsonLd(paper)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Papers', path: '/papers' },
          { name: paper.title, path: `/papers/${paper.slug}` },
        ])}
      />
    </Container>
  )
}
