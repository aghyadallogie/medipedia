/**
 * Publish -> cache invalidation (AGENTS.md §7). Payload hooks call these; nothing else
 * invalidates the cache by hand.
 */
import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { type CachedCollection, type TagSource, tagsFor } from '@/server/cache-tags'
import { idOf, idsOf } from '@/server/ids'

export type RevalidateFn = (tags: readonly string[], req: PayloadRequest) => void

/** Expire immediately so the next read after a publish is fresh. */
export const revalidateTags: RevalidateFn = (tags, req) => {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch (error) {
      // Outside a Next.js request (seed script, CLI, tests) there is no cache to invalidate.
      req.payload.logger.warn({ err: error, tag }, 'revalidateTag skipped')
    }
  }
}

async function slugsFor(
  req: PayloadRequest,
  collection: 'domains' | 'topics',
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return []
  const { docs } = await req.payload.find({
    collection,
    where: { id: { in: [...ids] } },
    depth: 0,
    pagination: false,
    req,
    overrideAccess: true,
  })
  return docs.map((doc) => doc.slug).filter((slug): slug is string => typeof slug === 'string')
}

/** Reads the identity and relations of a document, resolving related slugs. */
async function sourceOf(
  collection: CachedCollection,
  doc: Record<string, unknown>,
  req: PayloadRequest,
): Promise<TagSource> {
  const domainIds =
    collection === 'lectures'
      ? idsOf(doc.domains)
      : [idOf(doc.domain)].filter((id): id is string => id !== null)
  const topicId = idOf(doc.topic)

  const [domainSlugs, topicSlugs] = await Promise.all([
    slugsFor(req, 'domains', domainIds),
    topicId === null ? Promise.resolve([]) : slugsFor(req, 'topics', [topicId]),
  ])

  return {
    id: idOf(doc.id),
    slug: typeof doc.slug === 'string' ? doc.slug : null,
    domainSlugs,
    topicSlug: topicSlugs[0] ?? null,
  }
}

type Options = {
  /** Collections with drafts only invalidate when published content changes. */
  drafts: boolean
  /** Injectable for tests. */
  revalidate?: RevalidateFn
}

/**
 * `afterChange` and `afterDelete` hooks for a collection. Both the new and the previous
 * document are tagged, so a changed slug or domain also clears the old pages.
 *
 * Saving a draft over a published document also invalidates (we cannot tell it apart from
 * an unpublish here). That over-invalidates harmlessly.
 */
export function createRevalidateHooks(
  collection: CachedCollection,
  { drafts, revalidate = revalidateTags }: Options,
): { afterChange: CollectionAfterChangeHook; afterDelete: CollectionAfterDeleteHook } {
  const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
    if (context.disableRevalidate) return doc

    const hasPrevious = previousDoc != null && Object.keys(previousDoc).length > 0
    if (drafts) {
      const touchesPublished =
        doc._status === 'published' || (hasPrevious && previousDoc._status === 'published')
      if (!touchesPublished) return doc
    }

    const sources = [await sourceOf(collection, doc, req)]
    if (hasPrevious) sources.push(await sourceOf(collection, previousDoc, req))

    revalidate([...new Set(sources.flatMap((source) => tagsFor(collection, source)))], req)
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
    if (context.disableRevalidate) return doc
    if (drafts && doc._status !== 'published') return doc
    revalidate(tagsFor(collection, await sourceOf(collection, doc, req)), req)
    return doc
  }

  return { afterChange, afterDelete }
}
