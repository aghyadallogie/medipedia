import { DeleteMeBodySchema, UpdateMeBodySchema } from '@medipedia/shared'

import {
  ackResponse,
  readJson,
  readOptionalJson,
  signedOutCookies,
  toUserDto,
} from '@/server/auth/http'
import { deleteAccount, updateProfile } from '@/server/auth/service'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getClient } from '@/server/payload'
import { enforceRateLimit, RATE_RULES } from '@/server/rate-limit'

/** The signed-in user. */
export const GET = handler(async (request: Request) => {
  const user = await requireUser(request)
  return ok(toUserDto(user), { cache: 'private' })
})

export const PATCH = handler(async (request: Request) => {
  const user = await requireUser(request)
  const body = await readJson(request, UpdateMeBodySchema)
  const updated = await updateProfile(await getClient(), user.id, body.name)
  return ok(toUserDto(updated), { cache: 'private' })
})

/** Deletes the account with its answers and sessions (App Store account-deletion requirement). */
export const DELETE = handler(async (request: Request) => {
  const user = await requireUser(request)
  await enforceRateLimit(RATE_RULES.deleteAccount, user.id)
  const body = await readOptionalJson(request, DeleteMeBodySchema)
  await deleteAccount(await getClient(), user, body)
  return ackResponse({ cookies: signedOutCookies() })
})
