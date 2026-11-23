/**
 * Presentational cards for content DTOs. They hold no server-only code, so the server pages and
 * the client-side "load more" list render the same markup.
 */
import type { DomainRef, LectureSummary, PaperSummary, Video } from '@medipedia/shared'
import Image from 'next/image'
import Link from 'next/link'

import { formatAuthors, formatDate, formatDuration } from '@/lib/format'

const cardClass =
  'group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700'

function DomainLabels({ domains }: { domains: readonly DomainRef[] }) {
  if (domains.length === 0) return null
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
      {domains.map((domain) => domain.name).join(' · ')}
    </p>
  )
}

export function LectureCard({ lecture }: { lecture: LectureSummary }) {
  return (
    <Link href={`/lectures/${lecture.slug}`} className={cardClass}>
      {lecture.coverImage ? (
        <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-800">
          <Image
            src={lecture.coverImage.url}
            alt={lecture.coverImage.alt}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <DomainLabels domains={lecture.domains} />
        <h3 className="font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300">
          {lecture.title}
        </h3>
        {lecture.summary ? (
          <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
            {lecture.summary}
          </p>
        ) : null}
        <p className="mt-auto pt-2 text-xs text-slate-500 dark:text-slate-400">
          Updated {formatDate(lecture.lastReviewedAt ?? lecture.updatedAt)}
        </p>
      </div>
    </Link>
  )
}

export function RelevanceDots({ value }: { value: number }) {
  return (
    <span
      role="img"
      aria-label={`Clinical relevance ${value} out of 5`}
      className="inline-flex gap-0.5"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`size-1.5 rounded-full ${
            index < value ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        />
      ))}
    </span>
  )
}

export function PaperCard({ paper }: { paper: PaperSummary }) {
  const byline = [formatAuthors(paper.authors), paper.journal, paper.year]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link href={`/papers/${paper.slug}`} className={cardClass}>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {paper.domain ? <DomainLabels domains={[paper.domain]} /> : null}
        <h3 className="font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300">
          {paper.title}
        </h3>
        {byline ? <p className="text-sm text-slate-600 dark:text-slate-300">{byline}</p> : null}
        {paper.clinicalRelevance ? (
          <p className="mt-auto flex items-center gap-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
            Clinical relevance <RelevanceDots value={paper.clinicalRelevance} />
          </p>
        ) : null}
      </div>
    </Link>
  )
}

export function VideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/videos/${video.slug}`} className={cardClass}>
      <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
            className="object-cover"
            // Provider thumbnails come from other hosts. They are small and already optimized.
            unoptimized
          />
        ) : null}
        {video.durationSeconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {video.domain ? <DomainLabels domains={[video.domain]} /> : null}
        <h3 className="font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300">
          {video.title}
        </h3>
      </div>
    </Link>
  )
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}
