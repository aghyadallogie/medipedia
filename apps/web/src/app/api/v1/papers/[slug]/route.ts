import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getPaper } from '@/server/public-queries'

export const GET = handler(async (request: Request, { params }: RouteContext<{ slug: string }>) => {
  const user = await requireUser(request)
  const paper = await getPaper((await params).slug)
  if (!paper) throw notFound('Paper')
  assertCanRead(user, paper)
  return ok(paper, { cache: 'private' })
})
