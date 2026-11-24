import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getVideo } from '@/server/public-queries'

export const GET = handler(async (request: Request, { params }: RouteContext<{ slug: string }>) => {
  const user = await requireUser(request)
  const video = await getVideo((await params).slug)
  if (!video) throw notFound('Video')
  assertCanRead(user, video)
  return ok(video, { cache: 'private' })
})
