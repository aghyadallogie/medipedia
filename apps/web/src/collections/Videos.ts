import { parseVideoUrl, VIDEO_PROVIDERS } from '@medipedia/shared'
import type { CollectionConfig } from 'payload'

import { accessTierField, slugField, toOptions, wholeNumber } from '@/fields/shared'
import { deriveVideoFields } from '@/hooks/derive'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { adminOrPublished, isAdmin } from '@/server/access'

const revalidate = createRevalidateHooks('videos', { drafts: true })

export const Videos: CollectionConfig = {
  slug: 'videos',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'provider', 'domain', 'reviewedAt', '_status'],
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
    beforeChange: [deriveVideoFields],
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField({ from: 'title' }),
    {
      name: 'embedUrl',
      type: 'text',
      required: true,
      admin: {
        description: 'A YouTube or Vimeo link. It is converted to the canonical embed URL on save.',
      },
      validate: (value: unknown) =>
        (typeof value === 'string' && parseVideoUrl(value) !== null) ||
        'Enter a YouTube or Vimeo video URL.',
    },
    {
      name: 'provider',
      type: 'select',
      options: toOptions(VIDEO_PROVIDERS),
      admin: { readOnly: true, position: 'sidebar', description: 'Derived from the URL.' },
    },
    {
      name: 'providerVideoId',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: "Derived from the URL. Used to build the provider's thumbnail.",
      },
    },
    { name: 'description', type: 'richText', required: true },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      admin: { description: "Optional. YouTube's own thumbnail is used when empty." },
    },
    { name: 'domain', type: 'relationship', relationTo: 'domains', required: true, index: true },
    { name: 'durationSeconds', type: 'number', validate: wholeNumber({ min: 0 }) },
    {
      name: 'reviewedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When the video was last vetted.',
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
      filterOptions: { role: { equals: 'admin' } },
      admin: { position: 'sidebar' },
    },
    accessTierField,
  ],
}
