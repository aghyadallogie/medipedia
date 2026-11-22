/** Field builders reused across collections. Keep these dumb; behaviour lives in src/hooks. */
import { ACCESS_TIERS, isHttpUrl, isValidSlug, slugify, SLUG_MAX_LENGTH } from '@medipedia/shared'
import type { ArrayField, CollapsibleField, SelectField, TextField } from 'payload'

export const toOptions = (values: readonly string[]) =>
  values.map((value) => ({ label: (value[0] ?? '').toUpperCase() + value.slice(1), value }))

/**
 * Unique, indexed, URL-safe identifier. When left empty it is generated once from `from`
 * (e.g. the title) and then stays stable so published URLs do not change under readers.
 */
export function slugField({ from }: { from: string }): TextField {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    maxLength: SLUG_MAX_LENGTH,
    admin: {
      position: 'sidebar',
      description: `Public URL identifier. Generated from "${from}" when left empty.`,
    },
    hooks: {
      beforeValidate: [
        ({ value, data, originalDoc }) => {
          if (typeof value === 'string' && value.trim() !== '') return value.trim()
          const existing = (originalDoc as { slug?: unknown } | undefined)?.slug
          if (typeof existing === 'string' && existing !== '') return existing
          const source = (data as Record<string, unknown> | undefined)?.[from]
          return typeof source === 'string' ? slugify(source) || undefined : undefined
        },
      ],
    },
    validate: (value) => {
      if (typeof value !== 'string' || value === '') {
        return 'Slug is required. It is generated from the title or name when left empty.'
      }
      return isValidSlug(value) || 'Use lowercase letters, numbers and single hyphens only.'
    },
  }
}

export const accessTierField: SelectField = {
  name: 'accessTier',
  type: 'select',
  required: true,
  defaultValue: 'free',
  options: toOptions(ACCESS_TIERS),
  admin: {
    position: 'sidebar',
    description: 'Reserved for future gating. Everything is free in v1.',
  },
}

export const citationsField: ArrayField = {
  name: 'citations',
  type: 'array',
  labels: { singular: 'Citation', plural: 'Citations' },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'url',
      type: 'text',
      required: true,
      validate: (value: unknown) =>
        (typeof value === 'string' && isHttpUrl(value)) || 'Enter a full http(s) URL.',
    },
  ],
}

export const seoFields: CollapsibleField = {
  type: 'collapsible',
  label: 'SEO',
  admin: { initCollapsed: true },
  fields: [
    {
      name: 'metaTitle',
      type: 'text',
      maxLength: 70,
      admin: { description: 'Defaults to the title. Around 60 characters reads best in search.' },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      maxLength: 200,
      admin: { description: 'Around 150 characters reads best in search.' },
    },
  ],
}

/** Validator for optional whole-number fields with an inclusive range. */
export function wholeNumber({ min, max }: { min?: number; max?: number } = {}) {
  return (value: unknown): true | string => {
    if (value === null || value === undefined || value === '') return true
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Enter a whole number.'
    if (min !== undefined && value < min) return `Must be at least ${min}.`
    if (max !== undefined && value > max) return `Must be at most ${max}.`
    return true
  }
}
