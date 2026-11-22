import type { CollectionConfig, PayloadRequest, Where } from 'payload'

import { slugField } from '@/fields/shared'
import { blockDeleteIfReferenced } from '@/hooks/integrity'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { anyone, isAdmin } from '@/server/access'
import { idOf } from '@/server/ids'

const revalidate = createRevalidateHooks('domains', { drafts: false })

export const Domains: CollectionConfig = {
  slug: 'domains',
  admin: {
    useAsTitle: 'name',
    group: 'Taxonomy',
    defaultColumns: ['name', 'slug', 'parent', 'order'],
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
        { collection: 'domains', field: 'parent', label: 'sub-domains' },
        { collection: 'topics', field: 'domain', label: 'topics' },
        { collection: 'lectures', field: 'domains', label: 'lectures' },
        { collection: 'papers', field: 'domain', label: 'papers' },
        { collection: 'videos', field: 'domain', label: 'videos' },
      ]),
    ],
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField({ from: 'name' }),
    { name: 'description', type: 'textarea' },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'domains',
      admin: {
        description:
          'Optional. Domains nest one level deep: a sub-domain cannot have its own sub-domains.',
      },
      filterOptions: ({ id }) => {
        const where: Where[] = [{ parent: { exists: false } }]
        if (id !== undefined) where.push({ id: { not_equals: id } })
        return { and: where }
      },
      validate: async (
        value: unknown,
        { req, id }: { req: PayloadRequest; id?: number | string },
      ) => {
        const parentId = idOf(value)
        if (parentId === null) return true
        if (parentId === id) return 'A domain cannot be its own parent.'

        const parent = await req.payload.findByID({
          collection: 'domains',
          id: parentId,
          depth: 0,
          req,
          overrideAccess: true,
        })
        if (idOf(parent.parent) !== null) {
          return 'The parent is already a sub-domain. Domains nest one level deep.'
        }

        if (typeof id === 'string') {
          const { totalDocs } = await req.payload.count({
            collection: 'domains',
            where: { parent: { equals: id } },
            req,
            overrideAccess: true,
          })
          if (totalDocs > 0) return 'This domain has sub-domains, so it cannot become one itself.'
        }
        return true
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Lower numbers are listed first.' },
    },
  ],
}
