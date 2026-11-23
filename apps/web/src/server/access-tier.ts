import type { AccessTier } from '@medipedia/shared'

/**
 * The single place content gating is decided (AGENTS.md §8). Every endpoint and page that returns
 * a lecture, paper, video, flashcard or question calls this before it does.
 *
 * In v1 all content is free, so nothing is ever refused. When gating is turned on, the tier
 * logic goes here and only here, and it will throw `ApiError('forbidden', ...)` for a premium
 * resource and a user without access.
 */
export function assertCanRead(_user: unknown, _resource: { accessTier: AccessTier }): void {}
