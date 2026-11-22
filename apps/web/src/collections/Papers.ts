import { CLINICAL_RELEVANCE, isHttpUrl, isValidDoi, normalizeDoi } from '@medipedia/shared'
import type { CollectionConfig } from 'payload'

import { accessTierField, slugField, wholeNumber } from '@/fields/shared'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { adminOrPublished, isAdmin } from '@/server/access'

const revalidate = createRevalidateHooks('papers', { drafts: true })

export const Papers: CollectionConfig = {
  slug: 'papers',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'journal', 'year', 'domain', 'clinicalRelevance', '_status'],
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
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField({ from: 'title' }),
    { name: 'authors', type: 'text', hasMany: true, required: true },
    { name: 'journal', type: 'text' },
    {
      name: 'year',
      type: 'number',
      validate: wholeNumber({ min: 1800, max: new Date().getFullYear() + 1 }),
    },
    {
      name: 'doi',
      type: 'text',
      label: 'DOI',
      admin: { description: 'e.g. 10.1016/S0140-6736(94)90566-5. A doi.org link is converted.' },
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? normalizeDoi(value) : value)],
      },
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && isValidDoi(value)) ||
        'Enter a DOI like 10.1000/xyz123.',
    },
    {
      name: 'pubmedUrl',
      type: 'text',
      label: 'PubMed URL',
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && isHttpUrl(value)) ||
        'Enter a full http(s) URL.',
    },
    {
      name: 'citationCount',
      type: 'number',
      validate: wholeNumber({ min: 0 }),
      admin: { description: 'Entered by hand. Not synced from any external service.' },
    },
    {
      name: 'leadAuthorHIndex',
      type: 'number',
      label: 'Lead author h-index',
      validate: wholeNumber({ min: 0 }),
      admin: { description: "The lead author's h-index, entered by hand." },
    },
    {
      name: 'clinicalRelevance',
      type: 'number',
      validate: wholeNumber({ min: CLINICAL_RELEVANCE.min, max: CLINICAL_RELEVANCE.max }),
      admin: {
        description: `${CLINICAL_RELEVANCE.min} (low) to ${CLINICAL_RELEVANCE.max} (high).`,
      },
    },
    { name: 'abstract', type: 'richText', required: true },
    { name: 'sparkNotes', type: 'richText', required: true },
    { name: 'domain', type: 'relationship', relationTo: 'domains', required: true, index: true },
    accessTierField,
  ],
}
