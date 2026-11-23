import { unstable_cache } from 'next/cache'

/**
 * Data Cache wrapper for public reads (AGENTS.md §7). `unstable_cache` is Next 16's supported
 * cache for non-fetch data: entries are keyed by name and arguments, carry tags that the publish
 * hooks invalidate with `revalidateTag`, and survive deployments. `revalidate` is only a safety
 * net for a missed invalidation (for example a rename that changes a related document).
 *
 * Results are stored as JSON, so cached functions must return plain data.
 */
const SAFETY_NET_SECONDS = 60 * 60

export function cachedQuery<Args extends unknown[], Result>(
  name: string,
  query: (...args: Args) => Promise<Result>,
  tags: (...args: Args) => readonly string[],
): (...args: Args) => Promise<Result> {
  return (...args) =>
    unstable_cache(query, [name, JSON.stringify(args)], {
      tags: [...tags(...args)],
      revalidate: SAFETY_NET_SECONDS,
    })(...args)
}
