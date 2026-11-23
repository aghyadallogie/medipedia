import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { handler, ok } from '@/server/http'
import { getVideo } from '@/server/public-queries'

export const GET = handler(
  async (_request: Request, { params }: RouteContext<{ slug: string }>) => {
    const video = await getVideo((await params).slug)
    if (!video) throw notFound('Video')
    assertCanRead(null, video)
    return ok(video, { cache: 'public' })
  },
)
