import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/server/access'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Images for lectures, flashcards and videos. Stored in Vercel Blob when
 * BLOB_READ_WRITE_TOKEN is set (see payload.config.ts), otherwise on local disk for development.
 * SVG is deliberately excluded: it can carry scripts.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'alt',
    group: 'Content',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize'],
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    adminThumbnail: 'thumbnail',
    imageSizes: [
      { name: 'thumbnail', width: 320 },
      { name: 'card', width: 768 },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describe the image for screen readers and search engines.' },
    },
    { name: 'caption', type: 'text' },
  ],
}
