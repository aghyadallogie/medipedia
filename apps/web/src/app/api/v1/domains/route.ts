import { handler, okList } from '@/server/http'
import { listDomains } from '@/server/public-queries'

/** All domains. Bounded and small, so there is one page and `nextCursor` is always null. */
export const GET = handler(async () => {
  return okList(await listDomains(), null, { cache: 'public' })
})
