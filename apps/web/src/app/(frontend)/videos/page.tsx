import type { Metadata } from 'next'

import { CardGrid, VideoCard } from '@/components/cards'
import { LoadMore } from '@/components/load-more'
import { Container, EmptyState, PageHeading } from '@/components/site-chrome'
import { PAGE_SIZE } from '@/lib/constants'
import { pageMetadata } from '@/lib/seo'
import { listVideos } from '@/server/public-queries'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Video log',
  description: 'A vetted catalogue of teaching videos, organised by medical domain.',
  path: '/videos',
})

export default async function VideosPage() {
  const page = await listVideos({ limit: PAGE_SIZE })

  return (
    <Container>
      <PageHeading
        eyebrow="Video log"
        title="Vetted videos"
        description="Teaching videos that have been reviewed before they are listed."
      />
      {page.items.length === 0 ? (
        <EmptyState title="No videos yet">Published videos will appear here.</EmptyState>
      ) : (
        <>
          <CardGrid>
            {page.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </CardGrid>
          <LoadMore kind="videos" initialCursor={page.nextCursor} pageSize={PAGE_SIZE} />
        </>
      )}
    </Container>
  )
}
