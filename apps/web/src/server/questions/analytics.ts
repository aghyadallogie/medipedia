/**
 * A learner's own results (AGENTS.md §15: no peer comparison). Accuracy counts first attempts
 * only, so retrying a question after reading its explanation cannot inflate it, and sub-domains
 * roll up into their top-level domain.
 */
import {
  WEAKEST_DOMAIN_MIN_ANSWERS,
  type Analytics,
  type Domain,
  type DomainPerformance,
} from '@medipedia/shared'

import type { User } from '@/payload-types'
import { idOf } from '@/server/ids'
import { getClient } from '@/server/payload'
import { listDomains } from '@/server/public-queries'

const WEAKEST_COUNT = 3
/** Domains nest at most two deep (AGENTS.md §4); the cap only guards against a corrupt cycle. */
const MAX_DEPTH = 4

function topLevelId(domains: ReadonlyMap<string, Domain>, id: string): string | null {
  let current = domains.get(id)
  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    const parent = current.parentId ? domains.get(current.parentId) : undefined
    if (!parent) return current.id
    current = parent
  }
  return current?.id ?? null
}

const ratio = (correct: number, answered: number) => (answered === 0 ? 0 : correct / answered)

export async function getAnalytics(user: User): Promise<Analytics> {
  const payload = await getClient()
  const mine = { user: { equals: user.id } }

  const [{ totalDocs: attempts }, { docs: firstAttempts }, domainList] = await Promise.all([
    payload.count({ collection: 'answer-events', where: mine, overrideAccess: true }),
    payload.find({
      collection: 'answer-events',
      where: { and: [mine, { isFirstAttempt: { equals: true } }] },
      select: { domain: true, isCorrect: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    listDomains(),
  ])

  const byId = new Map(domainList.map((domain) => [domain.id, domain]))
  const tally = new Map<string, { answered: number; correct: number }>()
  let correctTotal = 0
  for (const event of firstAttempts) {
    if (event.isCorrect) correctTotal++
    const domainId = idOf(event.domain)
    // A deleted domain leaves the event in the totals but has nowhere to be listed.
    const topId = domainId ? topLevelId(byId, domainId) : null
    if (!topId) continue
    const entry = tally.get(topId) ?? { answered: 0, correct: 0 }
    entry.answered++
    if (event.isCorrect) entry.correct++
    tally.set(topId, entry)
  }

  // In display order: the domain list is already sorted by `order`, then name.
  const byDomain: DomainPerformance[] = domainList.flatMap((domain) => {
    const entry = tally.get(domain.id)
    return entry
      ? [
          {
            id: domain.id,
            name: domain.name,
            slug: domain.slug,
            answered: entry.answered,
            correct: entry.correct,
            accuracy: ratio(entry.correct, entry.answered),
          },
        ]
      : []
  })

  const weakest = byDomain
    .filter((domain) => domain.answered >= WEAKEST_DOMAIN_MIN_ANSWERS)
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, WEAKEST_COUNT)

  const answered = firstAttempts.length
  return {
    totals: {
      attempts,
      answered,
      correct: correctTotal,
      accuracy: answered === 0 ? null : ratio(correctTotal, answered),
    },
    byDomain,
    weakest,
  }
}
