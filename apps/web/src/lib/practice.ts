import {
  ChoiceLabelSchema,
  type ChoiceLabel,
  type Domain,
  type QuestionStats,
} from '@medipedia/shared'

/** A top-level domain on the setup screen. Its count includes its sub-domains' questions. */
export type DomainOption = { slug: string; name: string; count: number }

/** A topic on the setup screen, filed under the top-level domain it belongs to. */
export type TopicOption = { slug: string; name: string; domainSlug: string; count: number }

export type PracticeOptions = { domains: DomainOption[]; topics: TopicOption[] }

/**
 * What a learner can choose to practise: top-level domains and topics that have at least one
 * published question, with counts. Sub-domains are rolled into their parent because the API
 * treats a domain as including its sub-domains (AGENTS.md §6). Order follows the input.
 */
export function buildPracticeOptions(
  domains: readonly Domain[],
  stats: QuestionStats,
): PracticeOptions {
  const byId = new Map(domains.map((domain) => [domain.id, domain]))
  const topLevelOf = (id: string): Domain | null => {
    let current = byId.get(id) ?? null
    // Depth is capped at 2, but a loop guard keeps bad data from hanging the page.
    for (let hops = 0; current?.parentId && hops < 5; hops += 1) {
      current = byId.get(current.parentId) ?? null
    }
    return current
  }

  const domainCounts = new Map<string, number>()
  for (const entry of stats.byDomain) {
    const top = topLevelOf(entry.id)
    if (top) domainCounts.set(top.id, (domainCounts.get(top.id) ?? 0) + entry.count)
  }

  const topics: TopicOption[] = []
  for (const entry of stats.byTopic) {
    const top = topLevelOf(entry.domainId)
    if (top && entry.count > 0) {
      topics.push({ slug: entry.slug, name: entry.name, domainSlug: top.slug, count: entry.count })
    }
  }

  return {
    domains: domains
      .filter((domain) => domain.parentId === null && (domainCounts.get(domain.id) ?? 0) > 0)
      .map((domain) => ({
        slug: domain.slug,
        name: domain.name,
        count: domainCounts.get(domain.id) ?? 0,
      })),
    topics,
  }
}

/** Topics to offer: those under the chosen domains, or all of them when no domain is chosen. */
export function topicsFor(
  options: PracticeOptions,
  selectedDomains: readonly string[],
): TopicOption[] {
  if (selectedDomains.length === 0) return options.topics
  return options.topics.filter((topic) => selectedDomains.includes(topic.domainSlug))
}

/**
 * Chosen topics that are still on offer. Dropping a domain must also drop its topics: the API
 * wants a question to match both lists, so a leftover topic would match nothing.
 */
export function pruneTopics(
  options: PracticeOptions,
  selectedDomains: readonly string[],
  selectedTopics: readonly string[],
): string[] {
  const offered = new Set(topicsFor(options, selectedDomains).map((topic) => topic.slug))
  return selectedTopics.filter((slug) => offered.has(slug))
}

/** Only web links are made clickable, whatever an author typed as a source URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** The choice a key press picks: "a" or "B" for the choice with that label, else null. */
export function choiceForKey(key: string, labels: readonly string[]): ChoiceLabel | null {
  if (key.length !== 1) return null
  const parsed = ChoiceLabelSchema.safeParse(key.toUpperCase())
  return parsed.success && labels.includes(parsed.data) ? parsed.data : null
}
