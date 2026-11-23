/**
 * The question bank contract (AGENTS.md §6, Phase 5). Every endpoint here needs a signed-in user.
 *
 * `Question` (content.ts) is what a learner may see BEFORE answering: the vignette, the stem and
 * the choice texts. It has no `isCorrect`, no explanations and no citations (a citation can name
 * the answer). Only `AnswerResult`, returned by `POST /questions/:id/answer`, carries the verdict.
 */
import { z } from 'zod'

import { dataResponse } from './api'
import { AnswerResultSchema, DomainRefSchema, QuestionSchema, SlugSchema } from './content'
import { QuestionFilterSchema } from './enums'

// ---------- reading a question (no answer key) ----------

const MAX_FILTER_SLUGS = 50

/** `?domains=cardiology,pharmacology`: comma-separated slugs. Empty or missing means no filter. */
const slugList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== ''),
  )
  .pipe(z.array(SlugSchema).max(MAX_FILTER_SLUGS))

/**
 * `GET /me/questions/next`. A domain includes its sub-domains. When both `domains` and `topics`
 * are given a question must match both.
 */
export const NextQuestionQuerySchema = z.object({
  domains: slugList.optional(),
  topics: slugList.optional(),
  /** unused: never answered. incorrect: your latest answer was wrong. all: anything. */
  filter: QuestionFilterSchema.default('unused'),
})
export type NextQuestionQuery = z.infer<typeof NextQuestionQuerySchema>

/** `question` is null when nothing matches (or everything has been answered). */
export const NextQuestionSchema = z.object({
  question: QuestionSchema.nullable(),
  /** How many questions match the filter, including this one. */
  remaining: z.number().int().nonnegative(),
})
export type NextQuestion = z.infer<typeof NextQuestionSchema>

export const QuestionResponseSchema = dataResponse(QuestionSchema)
export const NextQuestionResponseSchema = dataResponse(NextQuestionSchema)

// ---------- answering ----------
// The body and result schemas (`SubmitAnswerBodySchema`, `AnswerResultSchema`) live in content.ts.

export const AnswerResponseSchema = dataResponse(AnswerResultSchema)

// ---------- analytics ----------

/** A top-level domain, with sub-domains rolled up into it. Counts are first attempts only. */
export const DomainPerformanceSchema = DomainRefSchema.extend({
  answered: z.number().int().positive(),
  correct: z.number().int().nonnegative(),
  /** correct / answered, from 0 to 1. */
  accuracy: z.number().min(0).max(1),
})
export type DomainPerformance = z.infer<typeof DomainPerformanceSchema>

export const AnalyticsSchema = z.object({
  totals: z.object({
    /** Every answer submitted, including repeats. */
    attempts: z.number().int().nonnegative(),
    /** Distinct questions answered at least once (first attempts). */
    answered: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    /** Null until something has been answered. */
    accuracy: z.number().min(0).max(1).nullable(),
  }),
  /** Domains with at least one first attempt, in no particular order. */
  byDomain: z.array(DomainPerformanceSchema),
  /** Up to three lowest-accuracy domains with at least `WEAKEST_DOMAIN_MIN_ANSWERS` (10) first attempts. */
  weakest: z.array(DomainPerformanceSchema).max(3),
})
export type Analytics = z.infer<typeof AnalyticsSchema>

export const AnalyticsResponseSchema = dataResponse(AnalyticsSchema)
