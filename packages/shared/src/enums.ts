import { z } from 'zod'

/** Learner/admin role on the Users collection. */
export const USER_ROLES = ['learner', 'admin'] as const
export const UserRoleSchema = z.enum(USER_ROLES)
export type UserRole = z.infer<typeof UserRoleSchema>

/** How a user signs in. */
export const AUTH_PROVIDERS = ['email', 'google'] as const
export const AuthProviderSchema = z.enum(AUTH_PROVIDERS)
export type AuthProvider = z.infer<typeof AuthProviderSchema>

/** Content gating tier. All content is `free` in v1 (AGENTS.md §8). */
export const ACCESS_TIERS = ['free', 'premium'] as const
export const AccessTierSchema = z.enum(ACCESS_TIERS)
export type AccessTier = z.infer<typeof AccessTierSchema>

/** Payload drafts `_status` values. */
export const PUBLISH_STATUSES = ['draft', 'published'] as const
export const PublishStatusSchema = z.enum(PUBLISH_STATUSES)
export type PublishStatus = z.infer<typeof PublishStatusSchema>

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export const DifficultySchema = z.enum(DIFFICULTIES)
export type Difficulty = z.infer<typeof DifficultySchema>

export const VIDEO_PROVIDERS = ['youtube', 'vimeo', 'other'] as const
export const VideoProviderSchema = z.enum(VIDEO_PROVIDERS)
export type VideoProvider = z.infer<typeof VideoProviderSchema>

/** JWT / refresh-token audience (AGENTS.md §5). */
export const TOKEN_AUDIENCES = ['web', 'mobile'] as const
export const TokenAudienceSchema = z.enum(TOKEN_AUDIENCES)
export type TokenAudience = z.infer<typeof TokenAudienceSchema>

/** `?client=` query value selecting the response shape (AGENTS.md §6). */
export const CLIENT_KINDS = ['web', 'mobile'] as const
export const ClientKindSchema = z.enum(CLIENT_KINDS)
export type ClientKind = z.infer<typeof ClientKindSchema>

/** Filter for `GET /me/questions/next`. */
export const QUESTION_FILTERS = ['unused', 'incorrect', 'all'] as const
export const QuestionFilterSchema = z.enum(QUESTION_FILTERS)
export type QuestionFilter = z.infer<typeof QuestionFilterSchema>
