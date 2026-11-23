import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FlashcardStudy } from '@/components/flashcards/study'
import { JsonLd } from '@/components/json-ld'
import { Breadcrumbs, Container, PageHeading } from '@/components/site-chrome'
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo'
import { getFlashcardTopic } from '@/server/public-queries'

export const revalidate = 3600

// Rendered on first request, then cached and refreshed when the topic or its cards change.
export const generateStaticParams = async () => []

type Props = { params: Promise<{ topic: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = await getFlashcardTopic((await params).topic)
  if (!topic) return { title: 'Flashcards not found' }
  return pageMetadata({
    title: `${topic.name} flashcards`,
    description: `${topic.cardCount} spaced-repetition flashcards on ${topic.name} (${topic.domain.name}).`,
    path: `/flashcards/${topic.slug}`,
  })
}

export default async function FlashcardTopicPage({ params }: Props) {
  const topic = await getFlashcardTopic((await params).topic)
  if (!topic) notFound()

  return (
    <Container>
      <Breadcrumbs items={[{ name: 'Flashcards', href: '/flashcards' }, { name: topic.name }]} />
      <PageHeading eyebrow={topic.domain.name} title={topic.name} />
      <FlashcardStudy
        key={topic.slug}
        topic={{ slug: topic.slug, name: topic.name, cardCount: topic.cardCount }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Flashcards', path: '/flashcards' },
          { name: topic.name, path: `/flashcards/${topic.slug}` },
        ])}
      />
    </Container>
  )
}
