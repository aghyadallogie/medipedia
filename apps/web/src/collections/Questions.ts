import { DIFFICULTIES, QUESTION_CHOICES } from '@medipedia/shared'
import type { CollectionConfig } from 'payload'

import { accessTierField, citationsField, toOptions } from '@/fields/shared'
import { labelQuestionChoices, setDomainFromTopic } from '@/hooks/derive'
import { createRevalidateHooks } from '@/hooks/revalidate'
import { isAdmin, isAdminFieldLevel, signedInPublishedOrAdmin } from '@/server/access'
import { validateChoices } from '@/server/question-choices'

const revalidate = createRevalidateHooks('questions', { drafts: true })

/**
 * Answer correctness and explanations are hidden from everyone but admins at the field level,
 * so they stay hidden on Payload's own REST API (/api/cms/questions) as well as /api/v1.
 * The answer endpoint reads them with the Local API and `overrideAccess: true`, server-side only.
 * Version history is admin-only for the same reason.
 */
export const Questions: CollectionConfig = {
  slug: 'questions',
  admin: {
    useAsTitle: 'stem',
    group: 'Content',
    defaultColumns: ['stem', 'topic', 'domain', 'difficulty', '_status', 'updatedAt'],
  },
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    // Signed-in learners read published questions. Anonymous callers get nothing.
    read: signedInPublishedOrAdmin,
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [labelQuestionChoices],
    beforeChange: [setDomainFromTopic],
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    { name: 'vignette', type: 'richText', required: true },
    { name: 'stem', type: 'textarea', required: true },
    {
      name: 'choices',
      type: 'array',
      minRows: QUESTION_CHOICES.min,
      maxRows: QUESTION_CHOICES.max,
      labels: { singular: 'Choice', plural: 'Choices' },
      validate: validateChoices,
      admin: {
        description: 'Two to six choices. Mark exactly one as correct. Labels A-F are automatic.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: { readOnly: true, description: 'Assigned automatically by position.' },
        },
        { name: 'text', type: 'text', required: true },
        {
          name: 'isCorrect',
          type: 'checkbox',
          defaultValue: false,
          access: { read: isAdminFieldLevel },
        },
        {
          name: 'explanation',
          type: 'richText',
          required: true,
          access: { read: isAdminFieldLevel },
          admin: { description: 'Why this choice is right or wrong.' },
        },
      ],
    },
    {
      name: 'overallExplanation',
      type: 'richText',
      required: true,
      access: { read: isAdminFieldLevel },
    },
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
    {
      name: 'difficulty',
      type: 'select',
      required: true,
      defaultValue: 'medium',
      options: toOptions(DIFFICULTIES),
      admin: { position: 'sidebar' },
    },
    citationsField,
    accessTierField,
  ],
}
