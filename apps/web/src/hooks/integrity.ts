/** Hooks that protect referential integrity where Postgres foreign keys would only null things out. */
import { APIError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeDeleteHook,
  CollectionSlug,
  PayloadRequest,
} from 'payload'

import { CONTENT_TAG } from '@/server/cache-tags'
import { idOf } from '@/server/ids'
import { revalidateTags } from '@/hooks/revalidate'

type Reference = { collection: CollectionSlug; field: string; label: string }

/** Refuse to delete a document that other documents still point at. */
export function blockDeleteIfReferenced(
  references: readonly Reference[],
): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    for (const { collection, field, label } of references) {
      const { totalDocs } = await req.payload.count({
        collection,
        where: { [field]: { equals: id } },
        req,
        overrideAccess: true,
      })
      if (totalDocs > 0) {
        throw new APIError(
          `Cannot delete: ${totalDocs} ${label} still use it. Reassign or delete them first.`,
          409,
          undefined,
          true,
        )
      }
    }
  }
}

/**
 * Flashcards and questions copy `domain` from their topic. When a topic moves to another
 * domain, update them directly in the database. This skips validation and versions on purpose:
 * only the denormalized column changes, and incomplete drafts must not block it.
 */
export const propagateTopicDomain: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (operation !== 'update') return doc
  const before = idOf(previousDoc?.domain)
  const after = idOf(doc.domain)
  if (after === null || before === after) return doc

  const updatedAt = new Date().toISOString()
  for (const collection of ['flashcards', 'questions'] as const) {
    await req.payload.db.updateMany({
      collection,
      where: { topic: { equals: doc.id } },
      data: { domain: after, updatedAt },
      req,
    })
  }

  if (!context.disableRevalidate) {
    revalidateTags(['flashcards', 'questions', CONTENT_TAG], req as PayloadRequest)
  }
  return doc
}
