import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { handler, ok } from '@/server/http'
import { getFlashcardBack } from '@/server/public-queries'

/** The answer side of one flashcard. */
export const GET = handler(async (_request: Request, { params }: RouteContext<{ id: string }>) => {
  const card = await getFlashcardBack((await params).id)
  if (!card) throw notFound('Flashcard')
  assertCanRead(null, card)
  return ok(card.back, { cache: 'public' })
})
