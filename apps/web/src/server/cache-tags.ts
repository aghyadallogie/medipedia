/**
 * Cache tag names for public content (AGENTS.md §7). Pure functions so both the
 * Payload hooks that invalidate and the (Phase 3) readers that tag use the same names.
 */

/** Present on every public content read; revalidating it clears everything. */
export const CONTENT_TAG = 'content'

export const CACHED_COLLECTIONS = [
  'lectures',
  'papers',
  'videos',
  'flashcards',
  'questions',
  'domains',
  'topics',
] as const
export type CachedCollection = (typeof CACHED_COLLECTIONS)[number]

/** Item tag prefix. Questions have no public item pages, so they have none. */
const ITEM_PREFIX: Record<CachedCollection, string | null> = {
  lectures: 'lecture',
  papers: 'paper',
  videos: 'video',
  flashcards: 'flashcard',
  questions: null,
  domains: 'domain',
  topics: 'topic',
}

/** Collections whose item tag is keyed by id (they have no slug). */
const ITEM_BY_ID = new Set<CachedCollection>(['flashcards'])

export const tag = {
  collection: (collection: CachedCollection): string => collection,
  lecture: (slug: string) => `lecture:${slug}`,
  paper: (slug: string) => `paper:${slug}`,
  video: (slug: string) => `video:${slug}`,
  flashcard: (id: string) => `flashcard:${id}`,
  domain: (slug: string) => `domain:${slug}`,
  topic: (slug: string) => `topic:${slug}`,
} as const

export type TagSource = {
  id?: string | null
  slug?: string | null
  /** Slugs of the domains the document belongs to. */
  domainSlugs?: readonly string[]
  /** Slug of the topic the document belongs to. */
  topicSlug?: string | null
}

/**
 * Every tag a change to one document invalidates: the item tag, the collection tag
 * (index pages), each related domain and topic, and the global `content` tag.
 */
export function tagsFor(collection: CachedCollection, source: TagSource): string[] {
  const tags = new Set<string>([CONTENT_TAG, tag.collection(collection)])

  const prefix = ITEM_PREFIX[collection]
  if (prefix !== null) {
    const key = ITEM_BY_ID.has(collection) ? source.id : source.slug
    if (key) tags.add(`${prefix}:${key}`)
  }

  for (const slug of source.domainSlugs ?? []) tags.add(tag.domain(slug))
  if (source.topicSlug) tags.add(tag.topic(source.topicSlug))

  return [...tags]
}
