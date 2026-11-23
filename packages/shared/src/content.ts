/**
 * Response DTO schemas for content (AGENTS.md §6). Types are derived with `z.infer`,
 * never hand-written. These describe what `/api/v1` returns, not what Payload stores.
 */
import { z } from 'zod'

import { CHOICE_LABELS, CLINICAL_RELEVANCE, QUESTION_CHOICES } from './constants'
import { AccessTierSchema, DifficultySchema, VideoProviderSchema } from './enums'
import { SLUG_PATTERN } from './slug'

// ---------- primitives ----------

export const IdSchema = z.uuid()
export const SlugSchema = z.string().regex(SLUG_PATTERN)
export const IsoDateTimeSchema = z.iso.datetime()
export const ChoiceLabelSchema = z.enum(CHOICE_LABELS)

/** Rich text is always returned as server-rendered HTML, never raw Lexical JSON. */
export const RichTextSchema = z.object({ html: z.string() })
export type RichText = z.infer<typeof RichTextSchema>

export const CitationSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
})
export type Citation = z.infer<typeof CitationSchema>

/** `url` may be site-relative in development and absolute (Vercel Blob) in production. */
export const MediaSchema = z.object({
  url: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
})
export type Media = z.infer<typeof MediaSchema>

// ---------- taxonomy ----------

export const DomainRefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: SlugSchema,
})
export type DomainRef = z.infer<typeof DomainRefSchema>

export const TopicRefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: SlugSchema,
})
export type TopicRef = z.infer<typeof TopicRefSchema>

export const DomainSchema = DomainRefSchema.extend({
  description: z.string().nullable(),
  parentId: IdSchema.nullable(),
  order: z.number().int(),
  updatedAt: IsoDateTimeSchema,
})
export type Domain = z.infer<typeof DomainSchema>

export const TopicSchema = TopicRefSchema.extend({
  domain: DomainRefSchema,
  order: z.number().int(),
  updatedAt: IsoDateTimeSchema,
})
export type Topic = z.infer<typeof TopicSchema>

// ---------- lectures ----------

export const LectureSummarySchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  title: z.string(),
  summary: z.string().nullable(),
  coverImage: MediaSchema.nullable(),
  domains: z.array(DomainRefSchema),
  accessTier: AccessTierSchema,
  publishedAt: IsoDateTimeSchema.nullable(),
  lastReviewedAt: IsoDateTimeSchema.nullable(),
  updatedAt: IsoDateTimeSchema,
})
export type LectureSummary = z.infer<typeof LectureSummarySchema>

export const LectureSchema = LectureSummarySchema.extend({
  body: RichTextSchema,
  citations: z.array(CitationSchema),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
})
export type Lecture = z.infer<typeof LectureSchema>

// ---------- flashcards ----------

/**
 * `back` is omitted until revealed (`GET /flashcards/:id/back`) and always for `?client=mobile`.
 * Review state is keyed by `id`, so `id` and `updatedAt` are always present (AGENTS.md §9).
 */
export const FlashcardSchema = z.object({
  id: IdSchema,
  front: z.string(),
  frontImage: MediaSchema.nullable(),
  tags: z.array(z.string()),
  topic: TopicRefSchema,
  domain: DomainRefSchema,
  accessTier: AccessTierSchema,
  updatedAt: IsoDateTimeSchema,
  back: RichTextSchema.optional(),
})
export type Flashcard = z.infer<typeof FlashcardSchema>

export const FlashcardBackSchema = z.object({
  id: IdSchema,
  back: RichTextSchema,
})
export type FlashcardBack = z.infer<typeof FlashcardBackSchema>

// ---------- questions ----------

/** Strict on purpose: a stray `isCorrect` or `explanation` fails parsing instead of leaking. */
export const QuestionChoiceSchema = z.strictObject({
  label: ChoiceLabelSchema,
  text: z.string(),
})
export type QuestionChoice = z.infer<typeof QuestionChoiceSchema>

/** What `GET /questions/:id` and `GET /me/questions/next` return. Never includes correctness. */
export const QuestionSchema = z.strictObject({
  id: IdSchema,
  vignette: RichTextSchema,
  stem: z.string(),
  choices: z.array(QuestionChoiceSchema).min(QUESTION_CHOICES.min).max(QUESTION_CHOICES.max),
  topic: TopicRefSchema,
  domain: DomainRefSchema,
  difficulty: DifficultySchema,
  accessTier: AccessTierSchema,
  updatedAt: IsoDateTimeSchema,
})
export type Question = z.infer<typeof QuestionSchema>

/** `POST /questions/:id/answer` request body. */
export const SubmitAnswerBodySchema = z.object({
  selectedLabel: ChoiceLabelSchema,
})
export type SubmitAnswerBody = z.infer<typeof SubmitAnswerBodySchema>

/** `POST /questions/:id/answer` response: the only place correctness and explanations appear. */
export const AnswerResultSchema = z.object({
  questionId: IdSchema,
  selectedLabel: ChoiceLabelSchema,
  isCorrect: z.boolean(),
  correctLabel: ChoiceLabelSchema,
  choices: z
    .array(
      z.object({
        label: ChoiceLabelSchema,
        isCorrect: z.boolean(),
        explanation: RichTextSchema,
      }),
    )
    .min(QUESTION_CHOICES.min)
    .max(QUESTION_CHOICES.max),
  overallExplanation: RichTextSchema,
  citations: z.array(CitationSchema),
})
export type AnswerResult = z.infer<typeof AnswerResultSchema>

/** `GET /questions/stats`: the only public question data. Counts only, never content. */
export const QuestionStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  byDomain: z.array(DomainRefSchema.extend({ count: z.number().int().nonnegative() })),
  byTopic: z.array(
    TopicRefSchema.extend({ domainId: IdSchema, count: z.number().int().nonnegative() }),
  ),
})
export type QuestionStats = z.infer<typeof QuestionStatsSchema>

// ---------- papers ----------

export const PaperSummarySchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().nullable(),
  year: z.number().int().nullable(),
  doi: z.string().nullable(),
  pubmedUrl: z.url().nullable(),
  citationCount: z.number().int().nonnegative().nullable(),
  leadAuthorHIndex: z.number().int().nonnegative().nullable(),
  clinicalRelevance: z
    .number()
    .int()
    .min(CLINICAL_RELEVANCE.min)
    .max(CLINICAL_RELEVANCE.max)
    .nullable(),
  domain: DomainRefSchema.nullable(),
  accessTier: AccessTierSchema,
  updatedAt: IsoDateTimeSchema,
})
export type PaperSummary = z.infer<typeof PaperSummarySchema>

export const PaperSchema = PaperSummarySchema.extend({
  abstract: RichTextSchema,
  sparkNotes: RichTextSchema,
})
export type Paper = z.infer<typeof PaperSchema>

// ---------- videos ----------

/** What a video list carries: everything but the description, which only the detail page shows. */
export const VideoSummarySchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  title: z.string(),
  provider: VideoProviderSchema,
  embedUrl: z.url(),
  thumbnailUrl: z.string().nullable(),
  domain: DomainRefSchema.nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  reviewedAt: IsoDateTimeSchema.nullable(),
  accessTier: AccessTierSchema,
  updatedAt: IsoDateTimeSchema,
})
export type VideoSummary = z.infer<typeof VideoSummarySchema>

export const VideoSchema = VideoSummarySchema.extend({
  description: RichTextSchema,
})
export type Video = z.infer<typeof VideoSchema>
