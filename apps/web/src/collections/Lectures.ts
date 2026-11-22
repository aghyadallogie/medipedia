import type { CollectionConfig } from 'payload'

import { accessTierField, citationsField, seoFields, slugField } from '@/fields/shared'
import { stampPublishedAt } from '@/hooks/derive'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { adminOrPublished, isAdmin } from '@/server/access'

const revalidate = createRevalidateHooks('lectures', { drafts: true })

export const Lectures: CollectionConfig = {
  slug: 'lectures',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'domains', '_status', 'lastReviewedAt', 'updatedAt'],
  },
  versions: { drafts: true, maxPerDoc: 25 },
  access: {
    read: adminOrPublished,
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [stampPublishedAt],
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField({ from: 'title' }),
    { name: 'summary', type: 'textarea', maxLength: 400 },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    {
      name: 'domains',
      type: 'relationship',
      relationTo: 'domains',
      hasMany: true,
      required: true,
      minRows: 1,
    },
    { name: 'body', type: 'richText', required: true },
    citationsField,
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Set automatically on first publish.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'lastReviewedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Update when the content is re-checked against current guidance.',
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    accessTierField,
    seoFields,
  ],
}
