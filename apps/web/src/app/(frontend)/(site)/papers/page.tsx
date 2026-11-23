import type { Metadata } from 'next'

import { CardGrid, PaperCard } from '@/components/cards'
import { LoadMore } from '@/components/load-more'
import { Container, EmptyState, PageHeading } from '@/components/site-chrome'
import { PAGE_SIZE } from '@/lib/constants'
import { pageMetadata } from '@/lib/seo'
import { listPapers } from '@/server/public-queries'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Paper archive',
  description: 'Landmark papers with plain-language spark notes and citation details.',
  path: '/papers',
})

export default async function PapersPage() {
  const page = await listPapers({ limit: PAGE_SIZE })

  return (
    <Container>
      <PageHeading
        eyebrow="Paper archive"
        title="Landmark papers"
        description="The studies that changed practice, each with a short summary of what mattered."
      />
      {page.items.length === 0 ? (
        <EmptyState title="No papers yet">Published papers will appear here.</EmptyState>
      ) : (
        <>
          <CardGrid>
            {page.items.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </CardGrid>
          <LoadMore kind="papers" initialCursor={page.nextCursor} pageSize={PAGE_SIZE} />
        </>
      )}
    </Container>
  )
}
