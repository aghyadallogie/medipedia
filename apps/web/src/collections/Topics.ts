import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/shared'
import { blockDeleteIfReferenced, propagateTopicDomain } from '@/hooks/integrity'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { anyone, isAdmin } from '@/server/access'

const revalidate = createRevalidateHooks('topics', { drafts: false })

export const Topics: CollectionConfig = {
  slug: 'topics',
  admin: {
    useAsTitle: 'name',
    group: 'Taxonomy',
    defaultColumns: ['name', 'domain', 'slug', 'order'],
  },
  defaultSort: 'order',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeDelete: [
      blockDeleteIfReferenced([
        { collection: 'flashcards', field: 'topic', label: 'flashcards' },
        { collection: 'questions', field: 'topic', label: 'questions' },
      ]),
    ],
    afterChange: [propagateTopicDomain, revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField({ from: 'name' }),
    { name: 'domain', type: 'relationship', relationTo: 'domains', required: true, index: true },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Lower numbers are listed first.' },
    },
  ],
}
