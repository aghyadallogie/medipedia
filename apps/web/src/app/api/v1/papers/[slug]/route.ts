import { notFound, type RouteContext } from '@/server/api-route'
import { assertCanRead } from '@/server/access-tier'
import { handler, ok } from '@/server/http'
import { getPaper } from '@/server/public-queries'

export const GET = handler(
  async (_request: Request, { params }: RouteContext<{ slug: string }>) => {
    const paper = await getPaper((await params).slug)
    if (!paper) throw notFound('Paper')
    assertCanRead(null, paper)
    return ok(paper, { cache: 'public' })
  },
)
