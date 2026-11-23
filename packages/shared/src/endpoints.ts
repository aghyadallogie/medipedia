/**
 * Query and response schemas for the public read endpoints under /api/v1 (AGENTS.md §6).
 * The route handlers parse requests with these and the api-client parses responses with them,
 * so both ends agree on the contract.
 */
import { z } from 'zod'

import { dataResponse, PaginationQuerySchema, paginatedResponse } from './api'
import {
  DomainSchema,
  FlashcardBackSchema,
  FlashcardSchema,
  LectureSchema,
  LectureSummarySchema,
  PaperSchema,
  PaperSummarySchema,
  QuestionStatsSchema,
  SlugSchema,
  TopicSchema,
  VideoSchema,
  VideoSummarySchema,
} from './content'
import { ClientKindSchema } from './enums'

// ---------- requests ----------

/** `?client=mobile` asks for lighter payloads. Anything else, or nothing, is the web shape. */
export const ClientQuerySchema = z.object({
  client: ClientKindSchema.default('web'),
})
export type ClientQuery = z.infer<typeof ClientQuerySchema>

const DomainFilterSchema = z.object({ domain: SlugSchema.optional() })

export const TopicListQuerySchema = DomainFilterSchema
export type TopicListQuery = z.infer<typeof TopicListQuerySchema>

export const LectureListQuerySchema = PaginationQuerySchema.extend(DomainFilterSchema.shape)
export type LectureListQuery = z.infer<typeof LectureListQuerySchema>

export const PaperListQuerySchema = PaginationQuerySchema.extend(DomainFilterSchema.shape)
export type PaperListQuery = z.infer<typeof PaperListQuerySchema>

export const VideoListQuerySchema = PaginationQuerySchema.extend(DomainFilterSchema.shape)
export type VideoListQuery = z.infer<typeof VideoListQuerySchema>

export const FlashcardListQuerySchema = PaginationQuerySchema.extend({
  ...DomainFilterSchema.shape,
  topic: SlugSchema.optional(),
  ...ClientQuerySchema.shape,
})
export type FlashcardListQuery = z.infer<typeof FlashcardListQuerySchema>

// ---------- responses ----------
// Domains and topics are small and bounded, so their lists return everything and `nextCursor`
// is always null. They keep the paginated envelope so every list endpoint looks the same.

export const DomainListResponseSchema = paginatedResponse(DomainSchema)
export const DomainResponseSchema = dataResponse(DomainSchema)

export const TopicListResponseSchema = paginatedResponse(TopicSchema)

export const LectureListResponseSchema = paginatedResponse(LectureSummarySchema)
export const LectureResponseSchema = dataResponse(LectureSchema)

export const PaperListResponseSchema = paginatedResponse(PaperSummarySchema)
export const PaperResponseSchema = dataResponse(PaperSchema)

export const VideoListResponseSchema = paginatedResponse(VideoSummarySchema)
export const VideoResponseSchema = dataResponse(VideoSchema)

export const FlashcardListResponseSchema = paginatedResponse(FlashcardSchema)
export const FlashcardBackResponseSchema = dataResponse(FlashcardBackSchema)

export const QuestionStatsResponseSchema = dataResponse(QuestionStatsSchema)
