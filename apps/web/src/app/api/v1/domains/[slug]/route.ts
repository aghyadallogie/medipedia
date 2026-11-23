import { notFound, type RouteContext } from '@/server/api-route'
import { handler, ok } from '@/server/http'
import { getDomain } from '@/server/public-queries'

export const GET = handler(
  async (_request: Request, { params }: RouteContext<{ slug: string }>) => {
    const domain = await getDomain((await params).slug)
    if (!domain) throw notFound('Domain')
    return ok(domain, { cache: 'public' })
  },
)
