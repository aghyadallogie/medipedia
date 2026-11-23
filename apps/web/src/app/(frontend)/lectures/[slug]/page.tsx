import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/json-ld'
import { RichText } from '@/components/rich-text'
import { Breadcrumbs, Container, DetailTitle } from '@/components/site-chrome'
import { formatDate } from '@/lib/format'
import { breadcrumbJsonLd, lectureJsonLd, pageMetadata, plainText } from '@/lib/seo'
import { assertCanRead } from '@/server/access-tier'
import { getLecture } from '@/server/public-queries'

export const revalidate = 3600

// Rendered on first request, then cached and refreshed when the lecture is published.
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lecture = await getLecture((await params).slug)
  if (!lecture) return { title: 'Lecture not found' }
  return pageMetadata({
    title: lecture.metaTitle ?? lecture.title,
    description: lecture.metaDescription ?? lecture.summary ?? plainText(lecture.body.html, 160),
    path: `/lectures/${lecture.slug}`,
    image: lecture.coverImage?.url,
    type: 'article',
  })
}

export default async function LecturePage({ params }: Props) {
  const lecture = await getLecture((await params).slug)
  if (!lecture) notFound()
  assertCanRead(null, lecture)

  const reviewed = lecture.lastReviewedAt ?? lecture.updatedAt

  return (
    <Container className="max-w-3xl">
      <Breadcrumbs items={[{ name: 'Lectures', href: '/lectures' }, { name: lecture.title }]} />
      <article className="pb-4 pt-6">
        <header className="space-y-4 pb-8">
          {lecture.domains.length > 0 ? (
            <p className="flex flex-wrap gap-x-3 text-sm font-medium uppercase tracking-wide">
              {lecture.domains.map((domain) => (
                <Link
                  key={domain.id}
                  href={`/domains/${domain.slug}`}
                  className="text-brand-700 hover:underline dark:text-brand-300"
                >
                  {domain.name}
                </Link>
              ))}
            </p>
          ) : null}
          <DetailTitle>{lecture.title}</DetailTitle>
          {lecture.summary ? (
            <p className="text-base text-slate-600 sm:text-lg dark:text-slate-300">
              {lecture.summary}
            </p>
          ) : null}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {lecture.lastReviewedAt ? 'Last reviewed' : 'Updated'}{' '}
            <time dateTime={reviewed}>{formatDate(reviewed)}</time>
          </p>
        </header>

        {lecture.coverImage ? (
          <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            <Image
              src={lecture.coverImage.url}
              alt={lecture.coverImage.alt}
              fill
              priority
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        <RichText content={lecture.body} />

        {lecture.citations.length > 0 ? (
          <section
            aria-labelledby="sources"
            className="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800"
          >
            <h2 id="sources" className="text-lg font-semibold">
              Sources
            </h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {lecture.citations.map((citation) => (
                <li key={`${citation.url}-${citation.label}`}>
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 underline underline-offset-2 dark:text-brand-300"
                  >
                    {citation.label}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>

      <JsonLd data={lectureJsonLd(lecture)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Lectures', path: '/lectures' },
          { name: lecture.title, path: `/lectures/${lecture.slug}` },
        ])}
      />
    </Container>
  )
}
