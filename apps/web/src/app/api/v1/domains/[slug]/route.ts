import { notFound, type RouteContext } from '@/server/api-route'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getDomain } from '@/server/public-queries'

export const GET = handler(async (request: Request, { params }: RouteContext<{ slug: string }>) => {
  await requireUser(request)
  const domain = await getDomain((await params).slug)
  if (!domain) throw notFound('Domain')
  return ok(domain, { cache: 'private' })
})
