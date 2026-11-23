import type { Metadata } from 'next'

import { CardGrid, LectureCard } from '@/components/cards'
import { LoadMore } from '@/components/load-more'
import { Container, EmptyState, PageHeading } from '@/components/site-chrome'
import { PAGE_SIZE } from '@/lib/constants'
import { pageMetadata } from '@/lib/seo'
import { listLectures } from '@/server/public-queries'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Lectures',
  description: 'Curated, regularly reviewed lectures organised by medical domain.',
  path: '/lectures',
})

export default async function LecturesPage() {
  const page = await listLectures({ limit: PAGE_SIZE })

  return (
    <Container>
      <PageHeading
        eyebrow="Lectures"
        title="Curated lectures"
        description="Concise, regularly reviewed teaching notes with their sources."
      />
      {page.items.length === 0 ? (
        <EmptyState title="No lectures yet">Published lectures will appear here.</EmptyState>
      ) : (
        <>
          <CardGrid>
            {page.items.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} />
            ))}
          </CardGrid>
          <LoadMore kind="lectures" initialCursor={page.nextCursor} pageSize={PAGE_SIZE} />
        </>
      )}
    </Container>
  )
}
