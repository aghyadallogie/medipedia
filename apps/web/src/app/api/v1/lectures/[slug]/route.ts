import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getLecture } from '@/server/public-queries'

export const GET = handler(async (request: Request, { params }: RouteContext<{ slug: string }>) => {
  const user = await requireUser(request)
  const lecture = await getLecture((await params).slug)
  if (!lecture) throw notFound('Lecture')
  assertCanRead(user, lecture)
  return ok(lecture, { cache: 'private' })
})
