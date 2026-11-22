/** Cursor pagination limits for list endpoints (AGENTS.md §6). */
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const

/** Token lifetimes in seconds (AGENTS.md §5). */
export const TOKEN_TTL_SECONDS = {
  access: 15 * 60,
  refreshWeb: 7 * 24 * 60 * 60,
  refreshMobile: 30 * 24 * 60 * 60,
} as const

/** Choice labels, assigned to a question's choices in order (AGENTS.md §4). */
export const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type ChoiceLabel = (typeof CHOICE_LABELS)[number]

/** Question choice count bounds (AGENTS.md §4). */
export const QUESTION_CHOICES = {
  min: 2,
  max: CHOICE_LABELS.length,
} as const

/** A domain needs at least this many first attempts to be ranked "weakest". */
export const WEAKEST_DOMAIN_MIN_ANSWERS = 10

/** Clinical relevance score bounds for Papers. */
export const CLINICAL_RELEVANCE = {
  min: 1,
  max: 5,
} as const
