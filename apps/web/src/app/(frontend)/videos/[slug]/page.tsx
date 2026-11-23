import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/json-ld'
import { RichText } from '@/components/rich-text'
import { Breadcrumbs, Container } from '@/components/site-chrome'
import { formatDate, formatDuration } from '@/lib/format'
import { breadcrumbJsonLd, pageMetadata, plainText, videoJsonLd } from '@/lib/seo'
import { assertCanRead } from '@/server/access-tier'
import { getVideo } from '@/server/public-queries'

export const revalidate = 3600

// Rendered on first request, then cached and refreshed when the video is published.
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const video = await getVideo((await params).slug)
  if (!video) return { title: 'Video not found' }
  return pageMetadata({
    title: video.title,
    description: plainText(video.description.html, 160),
    path: `/videos/${video.slug}`,
    image: video.thumbnailUrl,
    type: 'video.other',
  })
}

export default async function VideoPage({ params }: Props) {
  const video = await getVideo((await params).slug)
  if (!video) notFound()
  assertCanRead(null, video)

  return (
    <Container className="max-w-3xl">
      <Breadcrumbs items={[{ name: 'Videos', href: '/videos' }, { name: video.title }]} />
      <article className="space-y-6 pb-4 pt-6">
        <header className="space-y-3">
          {video.domain ? (
            <Link
              href={`/domains/${video.domain.slug}`}
              className="text-sm font-medium uppercase tracking-wide text-brand-700 hover:underline dark:text-brand-300"
            >
              {video.domain.name}
            </Link>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {video.title}
          </h1>
        </header>

        {/* Only YouTube and Vimeo embeds are ever stored (see the Videos collection). */}
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="absolute inset-0 size-full"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          />
        </div>

        <p className="flex flex-wrap gap-x-4 text-sm text-slate-500 dark:text-slate-400">
          {video.durationSeconds ? <span>{formatDuration(video.durationSeconds)}</span> : null}
          {video.reviewedAt ? (
            <span>
              Reviewed <time dateTime={video.reviewedAt}>{formatDate(video.reviewedAt)}</time>
            </span>
          ) : null}
        </p>

        <RichText content={video.description} />
      </article>

      <JsonLd data={videoJsonLd(video)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Videos', path: '/videos' },
          { name: video.title, path: `/videos/${video.slug}` },
        ])}
      />
    </Container>
  )
}
