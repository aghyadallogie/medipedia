import { requireUser } from '@/server/auth/session'
import { handler, okList } from '@/server/http'
import { listDomains } from '@/server/public-queries'

/** All domains. Bounded and small, so there is one page and `nextCursor` is always null. */
export const GET = handler(async (request: Request) => {
  await requireUser(request)
  return okList(await listDomains(), null, { cache: 'private' })
})
