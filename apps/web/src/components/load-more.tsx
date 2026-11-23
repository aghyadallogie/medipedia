'use client'

import { createApiClient } from '@medipedia/api-client'
import type { LectureSummary, PaperSummary, Video } from '@medipedia/shared'
import { useState } from 'react'

import { CardGrid, LectureCard, PaperCard, VideoCard } from '@/components/cards'

type Loaded =
  | { kind: 'lectures'; item: LectureSummary }
  | { kind: 'papers'; item: PaperSummary }
  | { kind: 'videos'; item: Video }

type Props = {
  kind: Loaded['kind']
  /** Cursor from the server-rendered first page. Nothing is shown when there is no next page. */
  initialCursor: string | null
  domain?: string
  pageSize: number
}

/**
 * Pages beyond the first load in the browser through the typed API client, so the first page can
 * stay static and cacheable while long lists still work.
 */
export function LoadMore({ kind, initialCursor, domain, pageSize }: Props) {
  const [loaded, setLoaded] = useState<Loaded[]>([])
  const [cursor, setCursor] = useState(initialCursor)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function loadNext() {
    if (cursor === null || status === 'loading') return
    setStatus('loading')
    try {
      const api = createApiClient({ baseUrl: window.location.origin })
      const query = { cursor, limit: pageSize, ...(domain ? { domain } : {}) }
      let next: Loaded[]
      let nextCursor: string | null
      if (kind === 'lectures') {
        const page = await api.lectures.list(query)
        next = page.items.map((item) => ({ kind, item }))
        nextCursor = page.nextCursor
      } else if (kind === 'papers') {
        const page = await api.papers.list(query)
        next = page.items.map((item) => ({ kind, item }))
        nextCursor = page.nextCursor
      } else {
        const page = await api.videos.list(query)
        next = page.items.map((item) => ({ kind, item }))
        nextCursor = page.nextCursor
      }
      setLoaded((current) => [...current, ...next])
      setCursor(nextCursor)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  if (initialCursor === null) return null

  return (
    <div className="space-y-6 pt-4">
      {loaded.length > 0 ? (
        <CardGrid>
          {loaded.map((entry) =>
            entry.kind === 'lectures' ? (
              <LectureCard key={entry.item.id} lecture={entry.item} />
            ) : entry.kind === 'papers' ? (
              <PaperCard key={entry.item.id} paper={entry.item} />
            ) : (
              <VideoCard key={entry.item.id} video={entry.item} />
            ),
          )}
        </CardGrid>
      ) : null}

      <div className="flex flex-col items-center gap-2" aria-live="polite">
        {status === 'error' ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Could not load more. Check your connection and try again.
          </p>
        ) : null}
        {cursor !== null ? (
          <button
            type="button"
            onClick={loadNext}
            disabled={status === 'loading'}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {status === 'loading' ? 'Loading…' : 'Load more'}
          </button>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">That&apos;s everything.</p>
        )}
      </div>
    </div>
  )
}
