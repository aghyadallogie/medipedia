import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { handler, ok } from '@/server/http'
import { getLecture } from '@/server/public-queries'

export const GET = handler(
  async (_request: Request, { params }: RouteContext<{ slug: string }>) => {
    const lecture = await getLecture((await params).slug)
    if (!lecture) throw notFound('Lecture')
    assertCanRead(null, lecture)
    return ok(lecture, { cache: 'public' })
  },
)
