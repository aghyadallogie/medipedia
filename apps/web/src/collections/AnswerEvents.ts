import { CHOICE_LABELS } from '@medipedia/shared'
import type { CollectionConfig } from 'payload'

import { toOptions } from '@/fields/shared'
import { adminOrOwnRows, isAdmin, nobody } from '@/server/access'

/**
 * One row per answer a learner submits. Written only by the answer endpoint through the Local
 * API, never through Payload's own REST API. Analytics read these rows, so `domain` and `topic`
 * are denormalized and survive later edits to the question.
 */
export const AnswerEvents: CollectionConfig = {
  slug: 'answer-events',
  labels: { singular: 'Answer event', plural: 'Answer events' },
  admin: {
    // Individual learner answers are not browsed in the admin panel.
    hidden: true,
    group: 'System',
  },
  access: {
    read: adminOrOwnRows,
    create: nobody,
    update: nobody,
    delete: isAdmin,
  },
  indexes: [{ fields: ['user', 'question'] }, { fields: ['user', 'answeredAt'] }],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'question',
      type: 'relationship',
      relationTo: 'questions',
      required: true,
      index: true,
    },
    { name: 'selectedLabel', type: 'select', required: true, options: toOptions(CHOICE_LABELS) },
    { name: 'isCorrect', type: 'checkbox', required: true },
    {
      name: 'isFirstAttempt',
      type: 'checkbox',
      required: true,
      admin: {
        description: "True for the user's first answer to this question. Accuracy uses these.",
      },
    },
    { name: 'domain', type: 'relationship', relationTo: 'domains', index: true },
    { name: 'topic', type: 'relationship', relationTo: 'topics', index: true },
    {
      name: 'answeredAt',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
    },
  ],
}
