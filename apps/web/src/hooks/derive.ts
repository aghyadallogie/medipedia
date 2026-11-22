/** Hooks that fill in derived or denormalized fields. No side effects beyond the document itself. */
import { parseVideoUrl } from '@medipedia/shared'
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from 'payload'

import { idOf } from '@/server/ids'
import { assignChoiceLabels } from '@/server/question-choices'

/**
 * Flashcards and questions store `domain` denormalized from `topic` so list and analytics
 * queries can filter by domain without a join. The editor never sets it.
 */
export const setDomainFromTopic: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const topicId = idOf(data.topic ?? originalDoc?.topic)
  if (topicId === null) return data
  try {
    const topic = await req.payload.findByID({
      collection: 'topics',
      id: topicId,
      depth: 0,
      req,
      overrideAccess: true,
    })
    return { ...data, domain: idOf(topic.domain) }
  } catch {
    // Unknown topic: relationship validation reports it. Do not mask that error here.
    return data
  }
}

/** First publish stamps `publishedAt`. Editors can still change it afterwards. */
export const stampPublishedAt: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const publishing = data._status === 'published'
  const alreadySet = Boolean(data.publishedAt ?? originalDoc?.publishedAt)
  if (publishing && !alreadySet) {
    return { ...data, publishedAt: new Date().toISOString() }
  }
  return data
}

/** Choice labels are positional, so editors never type them and reordering relabels. */
export const labelQuestionChoices: CollectionBeforeValidateHook = ({ data }) => {
  if (data && Array.isArray(data.choices)) {
    return { ...data, choices: assignChoiceLabels(data.choices) }
  }
  return data
}

/**
 * Normalize `embedUrl` to the canonical privacy-friendly embed URL and derive the provider
 * fields from it. Invalid URLs are left alone: the field validator rejects them on publish
 * and drafts may be incomplete.
 */
export const deriveVideoFields: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const input: unknown = data.embedUrl ?? originalDoc?.embedUrl
  if (typeof input !== 'string') return data
  const parsed = parseVideoUrl(input)
  if (parsed === null) return data
  return {
    ...data,
    embedUrl: parsed.embedUrl,
    provider: parsed.provider,
    providerVideoId: parsed.videoId,
  }
}
