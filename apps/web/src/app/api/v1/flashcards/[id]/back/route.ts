import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getFlashcardBack } from '@/server/public-queries'

/** The answer side of one flashcard. */
export const GET = handler(async (request: Request, { params }: RouteContext<{ id: string }>) => {
  const user = await requireUser(request)
  const card = await getFlashcardBack((await params).id)
  if (!card) throw notFound('Flashcard')
  assertCanRead(user, card)
  return ok(card.back, { cache: 'private' })
})
