/**
 * Creates the sample content from seed-data.ts through the Local API, so every item passes
 * the same validation an editor's would. Safe to re-run: items are matched by slug (or text)
 * and skipped when they already exist. Returns a description of what it created.
 */
import { slugify } from '@medipedia/shared'
import type { Payload } from 'payload'

import { paragraphsToLexical } from '../server/lexical'
import * as data from './seed-data'

type SlugCollection = 'domains' | 'topics' | 'lectures' | 'papers' | 'videos'

export async function seedSampleContent(payload: Payload): Promise<string[]> {
  // No Next.js cache exists here, and nothing needs invalidating.
  const context = { disableRevalidate: true }
  const published = { _status: 'published' } as const
  const created: string[] = []

  const domainIds = new Map<string, string>()
  const topicIds = new Map<string, string>()

  const bySlug = async (collection: SlugCollection, slug: string) => {
    const { docs } = await payload.find({
      collection,
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      draft: true,
      context,
    })
    return docs[0] ?? null
  }

  const need = (map: Map<string, string>, key: string, kind: string): string => {
    const id = map.get(key)
    if (id === undefined) throw new Error(`Seed data refers to unknown ${kind} "${key}"`)
    return id
  }

  for (const d of data.domains) {
    const slug = slugify(d.name)
    let doc = await bySlug('domains', slug)
    if (!doc) {
      doc = await payload.create({
        collection: 'domains',
        data: { name: d.name, slug, description: d.description, order: d.order },
        context,
      })
      created.push(`domain ${slug}`)
    }
    domainIds.set(d.name, doc.id)
  }

  for (const d of data.subDomains) {
    const slug = slugify(d.name)
    let doc = await bySlug('domains', slug)
    if (!doc) {
      doc = await payload.create({
        collection: 'domains',
        data: {
          name: d.name,
          slug,
          description: d.description,
          order: d.order,
          parent: need(domainIds, d.parent, 'domain'),
        },
        context,
      })
      created.push(`domain ${slug}`)
    }
    domainIds.set(d.name, doc.id)
  }

  for (const t of data.topics) {
    const slug = slugify(t.name)
    let doc = await bySlug('topics', slug)
    if (!doc) {
      doc = await payload.create({
        collection: 'topics',
        data: { name: t.name, slug, order: t.order, domain: need(domainIds, t.domain, 'domain') },
        context,
      })
      created.push(`topic ${slug}`)
    }
    topicIds.set(t.name, doc.id)
  }

  for (const lecture of data.lectures) {
    const slug = slugify(lecture.title)
    if (await bySlug('lectures', slug)) continue
    await payload.create({
      collection: 'lectures',
      data: {
        title: lecture.title,
        slug,
        summary: lecture.summary,
        domains: lecture.domains.map((name) => need(domainIds, name, 'domain')),
        body: paragraphsToLexical(lecture.body),
        accessTier: 'free',
        lastReviewedAt: new Date().toISOString(),
        ...published,
      },
      context,
    })
    created.push(`lecture ${slug}`)
  }

  for (const card of data.flashcards) {
    const { totalDocs } = await payload.count({
      collection: 'flashcards',
      where: { front: { equals: card.front } },
      context,
    })
    if (totalDocs > 0) continue
    await payload.create({
      collection: 'flashcards',
      data: {
        front: card.front,
        back: paragraphsToLexical(card.back),
        topic: need(topicIds, card.topic, 'topic'),
        tags: [...card.tags],
        accessTier: 'free',
        ...published,
      },
      context,
    })
    created.push(`flashcard "${card.front.slice(0, 40)}"`)
  }

  for (const q of data.questions) {
    const topic = need(topicIds, q.topic, 'topic')
    const { totalDocs } = await payload.count({
      collection: 'questions',
      where: { stem: { equals: q.stem }, topic: { equals: topic } },
      context,
    })
    if (totalDocs > 0) continue
    await payload.create({
      collection: 'questions',
      data: {
        vignette: paragraphsToLexical(q.vignette),
        stem: q.stem,
        choices: q.choices.map((choice) => ({
          text: choice.text,
          isCorrect: choice.correct,
          explanation: paragraphsToLexical([choice.explanation]),
        })),
        overallExplanation: paragraphsToLexical(q.overall),
        topic,
        difficulty: q.difficulty,
        accessTier: 'free',
        ...published,
      },
      context,
    })
    created.push(`question "${q.stem.slice(0, 40)}"`)
  }

  for (const paper of data.papers) {
    const slug = slugify(paper.title)
    if (await bySlug('papers', slug)) continue
    await payload.create({
      collection: 'papers',
      data: {
        title: paper.title,
        slug,
        authors: [...paper.authors],
        journal: paper.journal,
        year: paper.year,
        clinicalRelevance: paper.clinicalRelevance,
        abstract: paragraphsToLexical(paper.abstract),
        sparkNotes: paragraphsToLexical(paper.sparkNotes),
        domain: need(domainIds, paper.domain, 'domain'),
        accessTier: 'free',
        ...published,
      },
      context,
    })
    created.push(`paper ${slug.slice(0, 40)}`)
  }

  const { docs: admins } = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
    depth: 0,
    context,
  })
  const reviewer = admins[0]

  for (const video of data.videos) {
    const slug = slugify(video.title)
    if (await bySlug('videos', slug)) continue
    await payload.create({
      collection: 'videos',
      data: {
        title: video.title,
        slug,
        embedUrl: video.embedUrl,
        description: paragraphsToLexical(video.description),
        domain: need(domainIds, video.domain, 'domain'),
        durationSeconds: video.durationSeconds,
        reviewedAt: new Date().toISOString(),
        ...(reviewer ? { reviewedBy: reviewer.id } : {}),
        accessTier: 'free',
        ...published,
      },
      context,
    })
    created.push(`video ${slug}`)
  }

  return created
}
