import type { CollectionConfig } from 'payload'

import { accessTierField } from '@/fields/shared'
import { setDomainFromTopic } from '@/hooks/derive'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { adminOrPublished, isAdmin } from '@/server/access'

const revalidate = createRevalidateHooks('flashcards', { drafts: true })

/**
 * No per-user scheduling fields live here. Review state is client-side and keyed by this
 * document's id (AGENTS.md §9), so ids and `updatedAt` must stay stable.
 */
export const Flashcards: CollectionConfig = {
  slug: 'flashcards',
  admin: {
    useAsTitle: 'front',
    group: 'Content',
    defaultColumns: ['front', 'topic', 'domain', '_status', 'updatedAt'],
  },
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    read: adminOrPublished,
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [setDomainFromTopic],
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'front', type: 'textarea', required: true },
    { name: 'frontImage', type: 'upload', relationTo: 'media' },
    { name: 'back', type: 'richText', required: true },
    { name: 'topic', type: 'relationship', relationTo: 'topics', required: true, index: true },
    {
      name: 'domain',
      type: 'relationship',
      relationTo: 'domains',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Set automatically from the topic.',
      },
    },
    { name: 'tags', type: 'text', hasMany: true },
    accessTierField,
  ],
}
